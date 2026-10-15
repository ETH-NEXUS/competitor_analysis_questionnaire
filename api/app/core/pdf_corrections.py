"""Validate admin corrections and generate consistent readable analysis answers."""

from .pdf_offerings import KINDS, RELATIONSHIPS, REUSED, WORKFLOW
from .pdf_standards import supplemental_standards
from .serializers import QuestionnaireAnswerSerializer, validate_answer_details


COST_OPTIONS = [
    "Included",
    "One-time additional",
    "Recurring additional",
    "Depends on scope/contract",
    "Not applicable",
]
SOURCE_OPTIONS = ["Native — developed by your company", "Partner — third-party product"]
REQUIREMENT_OPTIONS = [
    "Integration with CIS/HIS",
    "Integration with patient administration/ADT",
    "Identity/SSO integration",
    "Other clinical-system integrations",
    "Data migration/import",
    "Hospital-specific interface development",
    "Vendor-specific customization/development",
    "Local infrastructure/components",
    "Clinical workflow/process configuration",
    "Other",
]
ANSWER_DEFAULTS = {
    "selected": [],
    "text": "",
    "details": {},
    "rows": {},
    "followups": {},
    "other_items": [],
    "products": {},
    "offerings": [],
    "testing_events": [],
    "certification_details": {},
}


def validate_choices(answer, definition):
    kind = definition["kind"]
    choices = {str(index) for index in range(len(definition.get("options", [])))}
    selected = answer["selected"]
    if set(selected) - choices or len(selected) != len(set(selected)):
        raise ValueError("Choose valid answer options without duplicates.")
    if kind == "single" and len(selected) > 1:
        raise ValueError("Choose only one answer for a single-choice question.")
    if kind not in {"single", "multi"} and selected:
        raise ValueError("This question does not accept selected answer options.")
    if set(answer["rows"]) - choices or set(answer["products"]) - choices:
        raise ValueError("Answer rows must belong to this question.")
    for row in answer["rows"].values():
        if kind == "costs" and row.get("cost", "") not in {"", *map(str, range(len(COST_OPTIONS)))}:
            raise ValueError("Choose a valid cost classification.")
        if kind == "capabilities" and row.get("provided", "") not in {"", "yes", "no"}:
            raise ValueError("Choose Yes or No for each capability.")


def offering_line(offering):  # noqa: C901 - format the distinct product and workflow fields
    title = next(label for label, kind in KINDS.items() if kind == offering["kind"])
    parts = [f"{title}: {offering['name'] or 'Not answered'}"]
    parts.append(
        f"Third-party company: {offering['developer'] or 'Not answered'}"
        if offering["source"] == "partner"
        else "Developed by your company"
    )
    if offering["kind"] != "core":
        parts.append(f"What it does: {offering['description'] or 'Not answered'}")
    if offering["kind"] == "integration":
        purposes = [
            f"Other: {offering['purpose_other']}" if item == "Other" else item
            for item in offering["purposes"]
        ]
        parts.append(f"Type/purpose: {', '.join(purposes) or 'Not answered'}")
    tags = [
        *offering["functions"],
        *offering["other_functions"],
        *offering["specialties"],
        *offering["other_specialties"],
    ]
    if offering["all_specialties"]:
        tags.append("Across specialties")
    parts.append(f"Areas: {', '.join(tags) or 'Not answered'}")
    if offering["kind"] == "function":
        if offering["category_b"]:
            relationships = {value: label for label, value in RELATIONSHIPS.items()}
            relationships["independent"] = "Can operate independently of a hospital-wide CIS"
            label = relationships.get(offering["cis_relationship"], "Not answered")
            if offering["cis_relationship"] == "other":
                label += f": {offering['cis_relationship_other']}"
            parts.append(f"CIS relationship: {label}")
        else:
            parts.append(f"Standalone purchase: {'Yes' if offering['standalone'] else 'No'}")
    if workflow := offering.get("workflow"):
        reused = {value: label for label, value in REUSED.items()}
        values = [
            f"Other: {workflow['other_reused_data']}" if key == "other" else reused[key]
            for key in workflow["reused_data"]
        ]
        parts.append(f"Connected CIS data reused: {', '.join(values) or 'Not answered'}")
        for label, (key, choices) in WORKFLOW.items():
            parts.append(
                f"{label}: {next((title for title, value in choices.items() if value == workflow[key]), 'Not answered')}"
            )
        parts.append(f"Manual workflow steps: {workflow['manual_steps'] or 'Not answered'}")
    return "; ".join(parts)


def matrix_lines(answer, definition):
    lines = []
    for index, label in enumerate(definition["options"]):
        key = str(index)
        row = answer["rows"].get(key, {})
        if definition["kind"] == "costs":
            cost = row.get("cost", "")
            value = COST_OPTIONS[int(cost)] if cost else "Not answered"
            extra = (
                f"; Charged per: {row['billing_unit']}"
                if cost in {"1", "2"} and row.get("billing_unit")
                else ""
            )
            lines.append(f"{label}: {value}{extra}")
        elif row.get("provided") == "yes":
            products = answer["products"].get(key, [])
            lines.extend(
                f"{label}: Yes; Product / module name: {product['name'] or 'Not answered'}; "
                f"Brief description: {product['description'] or 'Not answered'}; "
                f"Native / partner: {SOURCE_OPTIONS[int(product['source'])] if product['source'] else 'Not answered'}"
                f"; Can be purchased and operated independently: {'Yes' if product['standalone'] else 'No'}"
                for product in products
            )
            if not products:
                lines.append(f"{label}: Yes")
        else:
            lines.append(f"{label}: {'No' if row.get('provided') == 'no' else 'Not answered'}")
    return lines


def additional_lines(question_id, answer, definition):
    lines = []
    if question_id == "certifications":
        scopes = {
            "organization": "Organization",
            "solution": "Solution or product",
            "other": "Other",
        }
        for index, entry in answer["certification_details"].items():
            labels = [
                f"Other: {entry['scope_other']}" if key == "other" else scopes[key]
                for key in entry["scopes"]
            ]
            lines.append(
                f"{definition['options'][int(index)]}{': ' + entry['name'] if entry['name'] else ''}; "
                f"Scope: {', '.join(labels) or 'Not answered'}; Valid until: {entry['valid_until'] or 'Not specified'}"
            )
    if question_id == "interoperabilityTesting":
        for event in answer["testing_events"]:
            title = event["event_other"] if event["event"] == "Other" else event["event"]
            outcome = event["outcome_other"] if event["outcome"] == "Other" else event["outcome"]
            lines.append(
                f"Event: {title or 'Not answered'}; Year: {event['year'] or 'Not answered'}; "
                f"Tested profiles / use cases: {event['profiles'] or 'Not specified'}; Outcome: {outcome or 'Not answered'}"
            )
    if question_id == "requirements" and answer["followups"].get("1"):
        values = [
            f"Other: {answer['details'].get('requirements_other', '')}"
            if key == "9"
            else REQUIREMENT_OPTIONS[int(key)]
            for key in answer["followups"]["1"]
        ]
        lines.append(f"What is typically required: {', '.join(values)}")
    return lines


def readable_lines(question_id, answer, definition):
    kind = definition["kind"]
    if kind == "text":
        return [answer["text"]] if answer["text"] else []
    if kind == "offerings":
        lines = [offering_line(offering) for offering in answer["offerings"]]
    elif kind in {"costs", "capabilities"}:
        lines = matrix_lines(answer, definition)
    else:
        lines = []
        for index in sorted(answer["selected"], key=int):
            label = definition["options"][int(index)]
            if label.startswith("Other") and answer["other_items"]:
                lines.extend(f"{label}: {value}" for value in answer["other_items"])
            else:
                detail = answer["details"].get(index)
                lines.append(f"{label}: {detail}" if detail else label)
        lines.extend(additional_lines(question_id, answer, definition))
    if answer["text"]:
        lines.append(f"Additional information: {answer['text']}")
    return lines


def corrected_answer(question_id, data, schema):
    definition = schema[question_id]
    if not isinstance(data, dict) or set(data) - ANSWER_DEFAULTS.keys():
        raise ValueError("The answer correction is invalid.")
    if question_id == "standards":
        return supplemental_standards(data, definition)
    serializer = QuestionnaireAnswerSerializer(
        data={
            **ANSWER_DEFAULTS,
            **data,
            "question": definition["label"],
            "readable_answer": [],
        }
    )
    serializer.is_valid(raise_exception=True)
    answer = dict(serializer.validated_data)
    validate_choices(answer, definition)
    validate_answer_details({question_id: answer}, schema)
    answer["readable_answer"] = readable_lines(question_id, answer, definition)
    # Validate generated text too, including limits for long product lists.
    serializer = QuestionnaireAnswerSerializer(data=answer)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def apply_corrections(payload, corrections, schema):
    if not isinstance(corrections, dict) or set(corrections) - schema.keys():
        raise ValueError("Choose recognized questions to correct.")
    updated = {key: corrected_answer(key, value, schema) for key, value in corrections.items()}
    payload["answers"].update(updated)
