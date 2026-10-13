"""Private, expiring draft links with revision checks and atomic submission."""

from datetime import timedelta
from functools import wraps
import hashlib
import json
import math
import re
import secrets

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods, require_POST
from rest_framework.exceptions import ValidationError

from .models import QuestionnaireDraft
from .questionnaire import QUESTION_COLUMNS, SCOPE_FIELDS
from .serializers import QuestionnaireResponseSerializer


MAX_DRAFT_BYTES = 2_000_000
MAX_DEPTH = 12
MAX_FIELDS = 200
MAX_ENTRIES = 100
CURRENT_VERSION = 14
LINK_LIFETIME = timedelta(days=90)
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}")
IDENTITY_LIMITS = {
    "respondentName": 200,
    "respondentEmail": 254,
    "providerName": 200,
    "solutionName": 200,
}


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def validate_tree(value, depth=0):  # noqa: C901 - bounded recursive JSON validation
    """Allow partially typed values, but bound and validate the JSON tree."""
    if depth > MAX_DEPTH:
        raise ValidationError("The draft is too deeply nested.")
    if isinstance(value, dict):
        if len(value) > MAX_FIELDS or any(
            key in {"__proto__", "constructor", "prototype"} for key in value
        ):
            raise ValidationError("Invalid draft fields.")
        for child in value.values():
            validate_tree(child, depth + 1)
    elif isinstance(value, list):
        if len(value) > MAX_ENTRIES:
            raise ValidationError("The draft contains too many entries.")
        for child in value:
            validate_tree(child, depth + 1)
    elif isinstance(value, float) and not math.isfinite(value):
        raise ValidationError("Invalid numeric draft value.")
    elif not isinstance(value, (str, bool, int, float)) and value is not None:
        raise ValidationError("Invalid draft value.")


def string_list(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def string_map(value):
    return isinstance(value, dict) and all(isinstance(item, str) for item in value.values())


def validate_offering(offering):
    if not isinstance(offering, dict):
        raise ValidationError("Invalid draft product.")
    for key in ("functions", "specialties", "other_functions", "other_specialties", "purposes"):
        if not string_list(offering.get(key)):
            raise ValidationError("Invalid draft product tags.")
    for key in (
        "kind",
        "name",
        "description",
        "source",
        "developer",
        "purpose_other",
        "cis_relationship",
        "cis_relationship_other",
        "cis_integration",
    ):
        if not isinstance(offering.get(key), str):
            raise ValidationError("Invalid draft product fields.")
    workflow = offering.get("workflow")
    if not isinstance(workflow, dict) or not string_list(workflow.get("reused_data")):
        raise ValidationError("Invalid draft workflow.")
    if not string_map({key: value for key, value in workflow.items() if key != "reused_data"}):
        raise ValidationError("Invalid draft workflow fields.")


def validate_answer(answer):
    if not isinstance(answer, dict):
        raise ValidationError("Invalid draft answer.")
    if not isinstance(answer.get("selected"), list) or not all(
        isinstance(item, str) for item in answer["selected"]
    ):
        raise ValidationError("Invalid draft selections.")
    if not isinstance(answer.get("text"), str):
        raise ValidationError("Invalid draft text.")
    for key in ("details", "rows", "followups", "certification_details", "products"):
        if not isinstance(answer.get(key, {}), dict):
            raise ValidationError("Invalid draft answer fields.")
    for key in ("other_items", "offerings", "testing_events"):
        if not isinstance(answer.get(key, []), list):
            raise ValidationError("Invalid draft answer entries.")
    validate_nested_answer(answer)


def validate_nested_answer(answer):  # noqa: C901 - different nested draft answer formats
    if not string_map(answer.get("details", {})) or not all(
        string_map(row) for row in answer.get("rows", {}).values()
    ):
        raise ValidationError("Invalid draft text fields.")
    if not string_list(answer.get("other_items", [])) or not all(
        string_list(values) for values in answer.get("followups", {}).values()
    ):
        raise ValidationError("Invalid draft answer lists.")
    for offering in answer.get("offerings", []):
        validate_offering(offering)
    if not all(string_map(event) for event in answer.get("testing_events", [])):
        raise ValidationError("Invalid draft testing event.")
    for entry in answer.get("certification_details", {}).values():
        if not isinstance(entry, dict) or not string_list(entry.get("scopes")):
            raise ValidationError("Invalid draft certificate scope.")
    for products in answer.get("products", {}).values():
        if not isinstance(products, list) or not all(
            isinstance(product, dict)
            and all(isinstance(product.get(key), str) for key in ("name", "description", "source"))
            for product in products
        ):
            raise ValidationError("Invalid draft product list.")


def validate_data(data):
    if (
        not isinstance(data, dict)
        or set(data) != {"version", "scopes", "identity", "answers"}
        or data["version"] != CURRENT_VERSION
    ):
        raise ValidationError("Invalid questionnaire draft version or fields.")
    scopes = data["scopes"]
    if (
        not isinstance(scopes, list)
        or any(not isinstance(code, str) or code not in SCOPE_FIELDS for code in scopes)
        or len(scopes) != len(set(scopes))
    ):
        raise ValidationError("Invalid solution scopes.")
    identity = data["identity"]
    if not isinstance(identity, dict) or set(identity) != set(IDENTITY_LIMITS):
        raise ValidationError("Invalid respondent details.")
    for key, limit in IDENTITY_LIMITS.items():
        if not isinstance(identity[key], str) or len(identity[key]) > limit:
            raise ValidationError("Respondent details are too long or invalid.")
    answers = data["answers"]
    if not isinstance(answers, dict) or set(answers) - QUESTION_COLUMNS.keys():
        raise ValidationError("Invalid questionnaire questions.")
    validate_tree(data)
    for answer in answers.values():
        validate_answer(answer)
    return data


def payload(request):
    if len(request.body) > MAX_DRAFT_BYTES:
        raise ValidationError("The draft is too large to save.")
    try:
        result = json.loads(request.body)
    except (ValueError, TypeError) as error:
        raise ValidationError("Invalid request.") from error
    if not isinstance(result, dict):
        raise ValidationError("Invalid request.")
    return result


def json_errors(view):
    @wraps(view)
    def protected(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except ValidationError as error:
            return JsonResponse(
                {"error": "Check the draft details and try again.", "details": error.detail},
                status=400,
            )

    return protected


def draft_payload(draft):
    return {
        "data": draft.data,
        "revision": draft.revision,
        "updated_at": draft.updated_at.isoformat(),
        "expires_at": draft.expires_at.isoformat(),
        "submitted": draft.submitted_at is not None,
        "response_id": draft.response_id,
    }


def find_draft(request, *, lock=False):
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else ""
    if not TOKEN_PATTERN.fullmatch(token):
        return None
    queryset = (
        QuestionnaireDraft.objects.select_for_update() if lock else QuestionnaireDraft.objects
    )
    return queryset.filter(token_hash=token_hash(token), expires_at__gt=timezone.now()).first()


def unavailable():
    return JsonResponse(
        {"error": "This draft link is invalid, expired, or has been replaced."}, status=404
    )


def conflict(draft):
    return JsonResponse(
        {
            "error": "A colleague saved newer changes. Load the latest draft before continuing.",
            "draft": draft_payload(draft),
        },
        status=409,
    )


def check_revision(body, draft):
    revision = body.get("revision")
    if type(revision) is not int or revision <= 0:
        raise ValidationError("Invalid draft revision.")
    return revision == draft.revision


@never_cache
@csrf_protect
@require_POST
@json_errors
def create_draft(request):
    body = payload(request)
    data = validate_data(body.get("data"))
    token = secrets.token_urlsafe(32)
    draft = QuestionnaireDraft.objects.create(
        token_hash=token_hash(token), data=data, expires_at=timezone.now() + LINK_LIFETIME
    )
    return JsonResponse({**draft_payload(draft), "token": token}, status=201)


@never_cache
@csrf_protect
@require_http_methods(["GET", "PATCH"])
@json_errors
def current_draft(request):
    if request.method == "GET":
        draft = find_draft(request)
        return JsonResponse(draft_payload(draft)) if draft else unavailable()
    body = payload(request)
    data = validate_data(body.get("data"))
    with transaction.atomic():
        draft = find_draft(request, lock=True)
        if draft is None:
            return unavailable()
        if draft.submitted_at is not None or not check_revision(body, draft):
            return conflict(draft)
        draft.data = data
        draft.revision += 1
        draft.save(update_fields=["data", "revision", "updated_at"])
    return JsonResponse(draft_payload(draft))


@never_cache
@csrf_protect
@require_POST
@json_errors
def rotate_draft_link(request):
    body = payload(request)
    with transaction.atomic():
        draft = find_draft(request, lock=True)
        if draft is None:
            return unavailable()
        if draft.submitted_at is not None or not check_revision(body, draft):
            return conflict(draft)
        # A client-generated candidate can be recovered if the HTTP response is lost.
        token = body.get("new_token", secrets.token_urlsafe(32))
        if (
            not isinstance(token, str)
            or not TOKEN_PATTERN.fullmatch(token)
            or QuestionnaireDraft.objects.filter(token_hash=token_hash(token)).exists()
        ):
            raise ValidationError("Invalid replacement link.")
        draft.token_hash = token_hash(token)
        draft.expires_at = timezone.now() + LINK_LIFETIME
        draft.revision += 1
        draft.save(update_fields=["token_hash", "expires_at", "revision", "updated_at"])
    return JsonResponse({**draft_payload(draft), "token": token})


def submission_serializer(body, draft, data):
    response = body.get("response")
    if not isinstance(response, dict):
        raise ValidationError("A response is required.")
    # The stable server-owned UUID makes a retry return the same response.
    response = {**response, "submission_id": str(draft.submission_id)}
    identity = data["identity"]
    expected = {
        "respondent_name": identity["respondentName"].strip(),
        "respondent_email": identity["respondentEmail"].strip(),
        "provider_name": identity["providerName"].strip(),
        "solution_name": identity["solutionName"].strip(),
        **{field: code in data["scopes"] for code, field in SCOPE_FIELDS.items()},
    }
    if any(
        response.get(key, "" if isinstance(value, str) else False) != value
        for key, value in expected.items()
    ):
        raise ValidationError("The response details do not match the draft.")
    serializer = QuestionnaireResponseSerializer(data=response)
    serializer.is_valid(raise_exception=True)
    return serializer


@never_cache
@csrf_protect
@require_POST
@json_errors
def submit_draft(request):
    body = payload(request)
    with transaction.atomic():
        draft = find_draft(request, lock=True)
        if draft is None:
            return unavailable()
        if draft.submitted_at is not None:
            return JsonResponse(draft_payload(draft))
        if not check_revision(body, draft):
            return conflict(draft)
        data = validate_data(body.get("data"))
        serializer = submission_serializer(body, draft, data)
        draft.response = serializer.save()
        draft.data = data
        draft.submitted_at = timezone.now()
        draft.revision += 1
        draft.save(update_fields=["response", "data", "submitted_at", "revision", "updated_at"])
    return JsonResponse(draft_payload(draft), status=201)
