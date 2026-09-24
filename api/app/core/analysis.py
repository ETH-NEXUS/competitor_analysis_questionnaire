"""Superuser-only questionnaire analysis and spreadsheet-safe CSV export."""

import csv
from functools import wraps
import json
from pathlib import Path

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.cache import never_cache

from .models import QuestionnaireResponse
from .questionnaire import QUESTION_COLUMNS, SCOPE_FIELDS


def superuser_only(view):
    @never_cache
    @login_required(login_url="/admin/login/")
    @wraps(view)
    def protected(request, *args, **kwargs):
        if not request.user.is_active or not request.user.is_superuser:
            raise PermissionDenied
        return view(request, *args, **kwargs)

    return protected


def responses(request):
    queryset = QuestionnaireResponse.objects.all()
    if provider := request.GET.get("provider"):
        queryset = queryset.filter(provider_name=provider)
    if (scope := request.GET.get("scope")) in SCOPE_FIELDS:
        queryset = queryset.filter(**{SCOPE_FIELDS[scope]: True})
    return queryset


@superuser_only
def analysis(request):
    schema = json.loads(Path(__file__).with_name("analysis_schema.json").read_text())
    data = {
        "questions": [
            dict(id=key, title=title, **schema.get(key, {"kind": "text", "label": title}))
            for key, (_, title) in QUESTION_COLUMNS.items()
        ],
        "scopes": {
            code: str(QuestionnaireResponse._meta.get_field(field).verbose_name)
            for code, field in SCOPE_FIELDS.items()
        },
        "responses": [
            {
                "id": row.pk,
                "provider": row.provider_name,
                "solution": row.solution_name,
                "email": row.respondent_email,
                "submitted": row.submitted_at.isoformat(),
                "scopes": [code for code, field in SCOPE_FIELDS.items() if getattr(row, field)],
                "answers": {
                    key: getattr(row, field) for key, (field, _) in QUESTION_COLUMNS.items()
                },
            }
            for row in responses(request)
        ],
    }
    return render(request, "core/analysis.html", {"analysis_data": data})


def analysis_asset(filename, content_type):
    """Serve dashboard assets through the same authenticated admin route."""
    return HttpResponse(
        (Path(__file__).parent / "static" / "core" / filename).read_bytes(),
        content_type=content_type,
    )


@superuser_only
def analysis_css(request):  # noqa: ARG001 - authentication handled by decorator
    return analysis_asset("analysis.css", "text/css")


@superuser_only
def analysis_js(request):  # noqa: ARG001 - authentication handled by decorator
    return analysis_asset("analysis.js", "text/javascript")


def csv_cell(value):
    value = str(value) if value is not None else "Not asked"
    # Prevent spreadsheet applications from executing user-provided formulas.
    if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")):
        return "'" + value
    return value


@superuser_only
def export_csv(request):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="questionnaire-responses.csv"'
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerow(
        [
            "Company / provider",
            "Solution scope",
            "Solution",
            "Respondent email",
            "Submitted",
            "Response ID",
            *(f"Q{index}. {label}" for index, (_, label) in enumerate(QUESTION_COLUMNS.values(), 1)),
        ]
    )
    for row in responses(request):
        writer.writerow(
            [
                csv_cell(value)
                for value in [
                    row.provider_name,
                    ", ".join(code for code, field in SCOPE_FIELDS.items() if getattr(row, field)),
                    row.solution_name,
                    row.respondent_email,
                    row.submitted_at.isoformat(),
                    row.pk,
                    *(getattr(row, field) for field, _ in QUESTION_COLUMNS.values()),
                ]
            ]
        )
    return response
