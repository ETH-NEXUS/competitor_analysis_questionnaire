"""Import response copies through the authenticated analysis dashboard."""

import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_POST
from pypdf import PdfReader
from pypdf.errors import PyPdfError
from rest_framework.exceptions import ValidationError as SerializerValidationError

from .analysis import CURRENT_QUESTIONNAIRE_VERSION, superuser_only
from .models import QuestionnaireResponse
from .pdf_offerings import recover_offerings
from .questionnaire import QUESTION_COLUMNS, SCOPE_FIELDS, answer_text
from .serializers import QuestionnaireAnswerSerializer


MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_RESPONSE_BYTES = 2_000_000
MAX_PAGES = 100
SCOPE_LABELS = {
    "A": "Hospital-wide clinical information system",
    "B": "Specialized clinical solution / module",
    "C": "Data / interoperability solution",
    "D": "Patient-facing solution",
}
SCHEMA = json.loads(Path(__file__).with_name("analysis_schema.json").read_text())


def normalize(value):
    return " ".join(value.split()).casefold()


def empty_answer(label, lines):
    return {
        "question": label,
        "selected": [],
        "text": "",
        "details": {},
        "rows": {},
        "readable_answer": lines,
    }


def recover_selections(question_id, lines):  # noqa: C901, PLR0912 - separate answer formats
    definition = SCHEMA[question_id]
    answer = empty_answer(definition["label"], lines)
    if definition["kind"] == "text":
        answer["text"] = "\n".join(lines)
    if definition["kind"] == "offerings":
        answer["offerings"] = recover_offerings(lines, SCHEMA)
    if definition["kind"] in {"single", "multi"}:
        for index, option in enumerate(definition.get("options", [])):
            matching = [
                line
                for line in lines
                if line == option or line.startswith((option + ":", option + ";"))
            ]
            if matching:
                answer["selected"].append(str(index))
                detail = matching[0][len(option) :].lstrip(": ")
                if detail:
                    answer["details"][str(index)] = detail
                if option.startswith("Other"):
                    answer["other_items"] = [
                        line[len(option) :].lstrip(": ") for line in matching if line != option
                    ]
    if question_id == "standards":
        answer["followups"] = {}
        for prefix, key, other in (
            ("Primary FHIR release used in production: ", "0", "fhir_other"),
            ("HL7 v2 message types: ", "1", "hl7v2_other"),
        ):
            for line in lines:
                if line.startswith(prefix):
                    values = line[len(prefix) :].split(", ")
                    answer["followups"][key] = [
                        "Other" if value.startswith("Other:") else value for value in values
                    ]
                    for value in values:
                        if value.startswith("Other:"):
                            answer["details"][other] = value[6:].strip()
    return answer


def text_response(reader):  # noqa: C901 - validate each part of a legacy response
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if len(text) > MAX_RESPONSE_BYTES:
        raise ValueError("The PDF contains too much text.")
    # ReportLab emits page furniture first. Remove it without disturbing wrapped answers.
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
        and not re.fullmatch(
            r"(?:HOSPITAL IT\s*/\s*VENDOR QUESTIONNAIRE|Response preview|Submitted response|Page \d+)",
            line.strip(),
        )
    ]
    text = "\n".join(lines)
    if "Hospital IT" not in text or "Questionnaire" not in text:
        raise ValueError("Upload a response PDF downloaded from this questionnaire.")
    question_ids = "|".join(re.escape(key) for key in QUESTION_COLUMNS)
    headings = list(re.finditer(r"(?m)^Q(?:\d+|" + question_ids + r")\s+", text))
    if not headings:
        raise ValueError("No questionnaire answers were found. Scanned PDFs cannot be imported.")
    summary = text[: headings[0].start()]
    labels = [
        "COMPANY / PROVIDER",
        "SOLUTION",
        "RESPONDENT",
        "EMAIL",
        "SOLUTION SCOPE",
        "RESPONSE REFERENCE",
    ]
    values = {}
    for index, label in enumerate(labels):
        ending = "|".join(re.escape(item) for item in labels[index + 1 :])
        match = re.search(
            r"(?m)^" + re.escape(label) + r"\s*\n(.*?)(?=\n(?:" + ending + r")\s*\n|\Z)",
            summary,
            re.DOTALL,
        )
        values[label] = " ".join(match.group(1).split()) if match else ""
    scope_text = normalize(values["SOLUTION SCOPE"])
    scopes = [code for code, label in SCOPE_LABELS.items() if normalize(label) in scope_text]
    answers = {}
    unmatched = []
    for index, heading in enumerate(headings):
        block = text[
            heading.end() : headings[index + 1].start() if index + 1 < len(headings) else len(text)
        ]
        # Answers have bullet markers; unanswered questions use the explicit placeholder.
        parts = re.split(r"(?m)^\s*(?:•\s*|Not answered\s*$)", block, maxsplit=1)
        label = normalize(parts[0])
        question_id = next(
            (
                key
                for key, definition in SCHEMA.items()
                if key in QUESTION_COLUMNS and normalize(definition["label"]) == label
            ),
            None,
        )
        if not question_id:
            unmatched.append(parts[0].strip())
            continue
        body = parts[1] if len(parts) > 1 else ""
        # A section heading can follow the final answer of a section.
        body = re.split(r"(?m)^\d+\.\d+\s", body)[0]
        readable = [
            " ".join(item.split()) for item in re.split(r"(?m)^\s*•\s*", body) if item.strip()
        ]
        if question_id in answers:
            raise ValueError("The PDF contains duplicate question headings.")
        answers[question_id] = recover_selections(question_id, readable)
    if unmatched:
        raise ValueError(
            "Some question wording could not be matched safely: " + "; ".join(unmatched)[:500]
        )
    if not answers:
        raise ValueError("No supported questionnaire questions were found.")
    reference = re.match(r"\d+", values["RESPONSE REFERENCE"])
    return {
        "version": CURRENT_QUESTIONNAIRE_VERSION,
        "responseReference": int(reference[0]) if reference else None,
        "respondent": {
            "providerName": values["COMPANY / PROVIDER"],
            "solutionName": values["SOLUTION"],
            "respondentName": values["RESPONDENT"],
            "respondentEmail": values["EMAIL"],
        },
        "scopes": scopes,
        "answers": answers,
        "warnings": [
            "This older PDF was recovered from text. Review the answers before importing. Product fields and known tags are recovered; custom area tags are listed as additional functions. Certificate and event details remain in the readable answers and original PDF, but their structured breakdowns may be unavailable."
        ],
    }


def read_response(content):  # noqa: C901 - bounded PDF and attached-payload validation
    if not content.startswith(b"%PDF-"):
        raise ValueError("Upload a valid PDF file.")
    reader = PdfReader(BytesIO(content))
    if reader.is_encrypted:
        raise ValueError("Upload a PDF without password protection.")
    if not 1 <= len(reader.pages) <= MAX_PAGES:
        raise ValueError("Upload a PDF with no more than 100 pages.")
    attachments = reader.attachments.get("questionnaire-response.json", [])
    if not attachments:
        return text_response(reader)
    if len(attachments) != 1 or len(attachments[0]) > MAX_RESPONSE_BYTES:
        raise TypeError("The PDF contains invalid response data.")
    payload = json.loads(attachments[0])
    if not isinstance(payload, dict) or not isinstance(payload.get("sections"), list):
        raise TypeError("The PDF contains invalid response data.")
    answers = {}
    for section in payload["sections"]:
        for question in section["questions"]:
            key = question["id"]
            if key not in QUESTION_COLUMNS or key in answers:
                raise ValueError("The PDF contains unknown or duplicate questions.")
            answer = empty_answer(question["question"], question["readableAnswer"])
            answer.update(question.get("answer", {}))
            answers[key] = answer
    return {
        "version": payload.get("version", CURRENT_QUESTIONNAIRE_VERSION),
        "responseReference": payload.get("responseReference"),
        "respondent": payload["respondent"],
        "scopes": [scope["id"] for scope in payload["scopes"]],
        "answers": answers,
        "warnings": [],
    }


def response_model(payload, *, validate_identity=True):
    identity = payload["respondent"]
    scopes = payload["scopes"]
    if (
        not isinstance(identity, dict)
        or not isinstance(scopes, list)
        or not scopes
        or set(scopes) - SCOPE_FIELDS.keys()
    ):
        raise ValueError("Select at least one valid solution scope.")
    version = payload["version"]
    if type(version) is not int or not 1 <= version <= CURRENT_QUESTIONNAIRE_VERSION:
        raise ValueError("The questionnaire version is invalid.")
    if not isinstance(payload["answers"], dict) or not 1 <= len(payload["answers"]) <= len(
        QUESTION_COLUMNS
    ):
        raise ValueError("The PDF contains an invalid answer list.")
    answers = {}
    for key, value in payload["answers"].items():
        if key not in QUESTION_COLUMNS:
            raise ValueError("The PDF contains an unknown question.")
        serializer = QuestionnaireAnswerSerializer(data=value)
        serializer.is_valid(raise_exception=True)
        answers[key] = dict(serializer.validated_data)
    row = QuestionnaireResponse(
        submission_id=uuid4(),
        provider_name=identity.get("providerName", "").strip(),
        solution_name=identity.get("solutionName", "").strip(),
        respondent_name=identity.get("respondentName", "").strip(),
        respondent_email=identity.get("respondentEmail", "").strip(),
        questionnaire_version=version,
        answer_data=answers,
        **{field: code in scopes for code, field in SCOPE_FIELDS.items()},
        **{QUESTION_COLUMNS[key][0]: answer_text(value) for key, value in answers.items()},
    )
    if validate_identity:
        row.full_clean(exclude=["imported_pdf", "imported_pdf_sha256"])
    return row


@superuser_only
@require_POST
def import_pdf(request):  # noqa: C901, PLR0911 - preview, duplicate and save responses
    upload = request.FILES.get("pdf")
    if not upload or upload.size > MAX_PDF_BYTES:
        return JsonResponse({"error": "Choose a questionnaire PDF up to 10 MB."}, status=400)
    content = upload.read()
    digest = hashlib.sha256(content).hexdigest()
    existing = QuestionnaireResponse.objects.filter(imported_pdf_sha256=digest).first()
    if existing:
        return JsonResponse(
            {"error": f"This PDF was already imported as response #{existing.pk}."}, status=409
        )
    try:
        payload = read_response(content)
        if request.POST.get("action") == "import":
            payload["respondent"] = {
                key: request.POST.get(key, "")
                for key in ("providerName", "solutionName", "respondentName", "respondentEmail")
            }
            payload["scopes"] = request.POST.getlist("scopes")
        row = response_model(payload, validate_identity=request.POST.get("action") != "preview")
        reference = payload.get("responseReference")
        existing = (
            QuestionnaireResponse.objects.filter(pk=reference).first()
            if type(reference) is int and reference > 0
            else None
        )
        if (
            existing
            and normalize(existing.provider_name) == normalize(row.provider_name)
            and normalize(existing.solution_name) == normalize(row.solution_name)
        ):
            return JsonResponse(
                {
                    "error": f"This PDF belongs to saved response #{existing.pk}; it does not need importing."
                },
                status=409,
            )
        if request.POST.get("action") == "preview":
            return JsonResponse({"preview": payload})
        if request.POST.get("action") != "import":
            raise ValueError("Choose preview or import.")
        row.imported_pdf = content
        row.imported_pdf_name = Path(upload.name).name[:255]
        row.imported_pdf_sha256 = digest
        with transaction.atomic():
            row.save()
    except IntegrityError:
        return JsonResponse({"error": "This PDF has already been imported."}, status=409)
    except (
        ValueError,
        TypeError,
        KeyError,
        AttributeError,
        PyPdfError,
        ValidationError,
        SerializerValidationError,
    ) as error:
        message = "; ".join(error.messages) if isinstance(error, ValidationError) else str(error)
        return JsonResponse({"error": "Could not import PDF: " + message[:800]}, status=400)
    return JsonResponse({"id": row.pk}, status=201)


@superuser_only
def imported_pdf(request, response_id):  # noqa: ARG001 - authentication handled by decorator
    row = QuestionnaireResponse.objects.filter(pk=response_id).first()
    if not row or not row.imported_pdf:
        return HttpResponse(status=404)
    response = HttpResponse(bytes(row.imported_pdf), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="questionnaire-response-{row.pk}.pdf"'
    return response
