"""Superuser-only questionnaire analysis and spreadsheet-safe CSV export."""

import csv
from functools import wraps
import json
from pathlib import Path

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST

from .models import OtherAnswerGrouping, QuestionnaireResponse, VendorInvitation
from .questionnaire import LEGACY_QUESTION_IDS, QUESTION_COLUMNS, SCOPE_FIELDS, introduced_version


MAX_OTHER_ANSWER_LENGTH = 2000
MAX_OTHER_GROUP_LENGTH = 200
CURRENT_QUESTIONNAIRE_VERSION = 11


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
    queryset = QuestionnaireResponse.objects.filter(
        questionnaire_version=CURRENT_QUESTIONNAIRE_VERSION
    )
    if provider := request.GET.get("provider"):
        queryset = queryset.filter(provider_name=provider)
    if (scope := request.GET.get("scope")) in SCOPE_FIELDS:
        queryset = queryset.filter(**{SCOPE_FIELDS[scope]: True})
    if request.GET.get("mode") == "latest_provider":
        seen = set()
        latest = []
        for row in queryset:
            key = " ".join(row.provider_name.split()).casefold() or f"response:{row.pk}"
            if key not in seen:
                seen.add(key)
                latest.append(row)
        return latest
    return queryset


@superuser_only
def analysis(request):
    schema = json.loads(Path(__file__).with_name("analysis_schema.json").read_text())
    data = {
        "viewer_id": request.user.pk,
        "current_version": CURRENT_QUESTIONNAIRE_VERSION,
        "vendor_categories": [
            {"value": value, "label": label}
            for value, label in VendorInvitation.CATEGORY_CHOICES
        ],
        "questions": [
            dict(
                id=key,
                title=title,
                legacy=key in LEGACY_QUESTION_IDS,
                introduced=introduced_version(key),
                **schema.get(key, {"kind": "text", "label": title}),
            )
            for key, (_, title) in QUESTION_COLUMNS.items()
            if key not in LEGACY_QUESTION_IDS
        ],
        "scopes": {
            code: str(QuestionnaireResponse._meta.get_field(field).verbose_name)
            for code, field in SCOPE_FIELDS.items()
        },
        "clinical_specialties": schema.get("specialties", {}).get("options", []),
        "responses": [
            {
                "id": row.pk,
                "provider": row.provider_name,
                "solution": row.solution_name,
                "email": row.respondent_email,
                "submitted": row.submitted_at.isoformat(),
                "version": row.questionnaire_version,
                "scopes": [code for code, field in SCOPE_FIELDS.items() if getattr(row, field)],
                "answers": {
                    key: getattr(row, field) for key, (field, _) in QUESTION_COLUMNS.items()
                },
                "answer_data": row.answer_data,
            }
            for row in responses(request)
        ],
        "submissions": [
            {
                "id": row.pk,
                "provider": row.provider_name,
                "solution": row.solution_name,
                "email": row.respondent_email,
                "submitted": row.submitted_at.isoformat(),
                "version": row.questionnaire_version,
                "scopes": [code for code, field in SCOPE_FIELDS.items() if getattr(row, field)],
            }
            for row in QuestionnaireResponse.objects.all()
        ],
        "invitations": [
            {"id": item.pk, "provider": item.provider_name, "category": item.category,
             "match_name": item.submission_match_name,
             "invitation_sent": item.invitation_sent,
             "reminder_sent": item.reminder_sent,
             "declined": item.declined, "notes": item.notes}
            for item in VendorInvitation.objects.all()
        ],
        "other_groupings": [
            {
                "question_id": item.question_id,
                "answer": item.normalized_answer,
                "group": item.group_label,
            }
            for item in OtherAnswerGrouping.objects.all()
        ],
    }
    return render(request, "core/analysis.html", {"analysis_data": data})


def _vendor_payload(item):
    return {
        "id": item.pk,
        "provider": item.provider_name,
        "category": item.category,
        "match_name": item.submission_match_name,
        "invitation_sent": item.invitation_sent,
        "reminder_sent": item.reminder_sent,
        "declined": item.declined,
        "notes": item.notes,
    }


def _delete_vendor_outreach(payload):
    if set(payload) != {"action", "id"} or type(payload["id"]) is not int or payload["id"] <= 0:
        return JsonResponse({"error": "Invalid vendor ID."}, status=400)
    with transaction.atomic():
        item = VendorInvitation.objects.select_for_update().filter(pk=payload["id"]).first()
        if item is None:
            return JsonResponse({"error": "Vendor not found."}, status=404)
        item.delete()
    return JsonResponse({"deleted_id": payload["id"]})


@superuser_only
@require_POST
def save_vendor_outreach(request):
    try:
        payload = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid request."}, status=400)
    if not isinstance(payload, dict) or payload.get("action") not in {"create", "update", "delete"}:
        return JsonResponse({"error": "Invalid action."}, status=400)
    if payload["action"] == "delete":
        return _delete_vendor_outreach(payload)

    with transaction.atomic():
        if payload["action"] == "create":
            item = VendorInvitation()
        else:
            item_id = payload.get("id")
            if type(item_id) is not int or item_id <= 0:
                return JsonResponse({"error": "Invalid vendor ID."}, status=400)
            item = VendorInvitation.objects.select_for_update().filter(pk=item_id).first()
            if item is None:
                return JsonResponse({"error": "Vendor not found."}, status=404)

        allowed = {"provider", "category", "match_name", "notes", "invitation_sent", "reminder_sent", "declined"}
        if any(key not in allowed | {"action", "id"} for key in payload):
            return JsonResponse({"error": "Unexpected field."}, status=400)
        for key, field in (("provider", "provider_name"), ("match_name", "submission_match_name"), ("notes", "notes")):
            if key in payload:
                value = payload[key]
                if not isinstance(value, str) or len(value) > (3000 if key == "notes" else 200):
                    return JsonResponse({"error": f"Invalid {key}."}, status=400)
                setattr(item, field, value.strip())
        for key in ("invitation_sent", "reminder_sent", "declined"):
            if key in payload:
                if type(payload[key]) is not bool:
                    return JsonResponse({"error": f"Invalid {key}."}, status=400)
                setattr(item, key, payload[key])
        if "category" in payload:
            category = payload["category"]
            if not isinstance(category, str) or (category and category not in dict(VendorInvitation.CATEGORY_CHOICES)):
                return JsonResponse({"error": "Invalid category."}, status=400)
            item.category = category
        if not item.provider_name:
            return JsonResponse({"error": "Enter a vendor name."}, status=400)

        # A response may only be linked to one vendor. Compare names with the same
        # case/spacing normalization used by the dashboard.
        own_names = {" ".join(name.split()).casefold() for name in (item.provider_name, item.submission_match_name) if name}
        for other in VendorInvitation.objects.exclude(pk=item.pk):
            other_names = {" ".join(name.split()).casefold() for name in (other.provider_name, other.submission_match_name) if name}
            if own_names & other_names:
                return JsonResponse({"error": "That vendor or questionnaire name is already linked to another row."}, status=400)
        try:
            item.full_clean()
            item.save()
        except ValidationError:
            return JsonResponse({"error": "Check the vendor name and questionnaire name."}, status=400)
    return JsonResponse({"vendor": _vendor_payload(item)}, status=201 if payload["action"] == "create" else 200)


@superuser_only
@require_POST
def delete_submissions(request):
    try:
        payload = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid request."}, status=400)
    ids = payload.get("ids") if isinstance(payload, dict) else None
    if (
        not isinstance(ids, list)
        or not ids
        or len(ids) > 1000
        or any(type(value) is not int or value <= 0 for value in ids)
        or len(set(ids)) != len(ids)
    ):
        return JsonResponse({"error": "Select valid submission IDs."}, status=400)
    with transaction.atomic():
        found = list(
            QuestionnaireResponse.objects.select_for_update()
            .filter(pk__in=ids)
            .values_list("pk", flat=True)
        )
        if len(found) != len(ids):
            return JsonResponse({"error": "One or more submissions no longer exist. Refresh the page."}, status=409)
        QuestionnaireResponse.objects.filter(pk__in=ids).delete()
    return JsonResponse({"deleted_ids": ids, "deleted_count": len(ids)})


@superuser_only
@require_POST
def save_other_grouping(request):
    try:
        payload = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid request."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "Invalid request."}, status=400)
    question_id = payload.get("question_id")
    answer = payload.get("answer")
    group = payload.get("group")
    if not all(isinstance(value, str) for value in (question_id, answer, group)):
        return JsonResponse({"error": "Question, answer and group must be text."}, status=400)
    normalized = " ".join(answer.split()).lower()
    group = " ".join(group.split())
    if (
        (question_id not in QUESTION_COLUMNS and question_id not in {"clinicalProduct", "clinicalFunction", "clinicalSpecialty"})
        or not normalized
        or len(normalized) > MAX_OTHER_ANSWER_LENGTH
        or len(group) > MAX_OTHER_GROUP_LENGTH
    ):
        return JsonResponse({"error": "Invalid question, answer or group."}, status=400)
    if group:
        OtherAnswerGrouping.objects.update_or_create(
            question_id=question_id,
            normalized_answer=normalized,
            defaults={"group_label": group},
        )
    else:
        OtherAnswerGrouping.objects.filter(
            question_id=question_id, normalized_answer=normalized
        ).delete()
    return JsonResponse({"question_id": question_id, "answer": normalized, "group": group})


def analysis_asset(filename, content_type):
    """Serve dashboard assets through the same authenticated admin route."""
    return HttpResponse(
        (Path(__file__).parent / "analysis_assets" / filename).read_bytes(),
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
    active_questions = {
        key: value for key, value in QUESTION_COLUMNS.items() if key not in LEGACY_QUESTION_IDS
    }
    writer.writerow(
        [
            "Company / provider",
            "Solution scope",
            "Solution",
            "Respondent email",
            "Submitted",
            "Response ID",
            *(f"Q{index}. {label}" for index, (_, label) in enumerate(active_questions.values(), 1)),
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
                    *(getattr(row, field) for field, _ in active_questions.values()),
                ]
            ]
        )
    return response
