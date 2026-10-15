"""Validate separately received Q3 answers and build their analysis display text."""

from .serializers import QuestionnaireAnswerSerializer, validate_followups


def validated_standards(data, definition):
    if not isinstance(data, dict) or set(data) - {
        "selected",
        "details",
        "followups",
        "other_items",
        "text",
    }:
        raise ValueError("The supplementary Q3 answer is invalid.")
    serializer = QuestionnaireAnswerSerializer(
        data={
            "question": definition["label"],
            "selected": [],
            "details": {},
            "followups": {},
            "other_items": [],
            "text": "",
            **data,
            "rows": {},
            "readable_answer": [],
        }
    )
    serializer.is_valid(raise_exception=True)
    answer = dict(serializer.validated_data)
    selected = answer["selected"]
    choices = {str(index) for index in range(len(definition["options"]))}
    if set(selected) - choices or len(selected) != len(set(selected)):
        raise ValueError("Choose valid Q3 standards without duplicates.")
    if "6" in selected and len(selected) > 1:
        raise ValueError("No supported standards cannot be combined with supported standards.")
    allowed_details = set(selected)
    allowed_details.update(
        other_key
        for key, other_key in (("0", "fhir_other"), ("1", "hl7v2_other"))
        if key in selected and "Other" in answer["followups"].get(key, [])
    )
    if set(answer["details"]) - allowed_details:
        raise ValueError("Q3 details must belong to a selected standard.")
    if answer["other_items"] and "5" not in selected:
        raise ValueError("Select Other to add other supported standards.")
    validate_followups("standards", answer)
    return answer


def supplemental_standards(data, definition):
    answer = validated_standards(data, definition)
    lines = []
    for index in sorted(answer["selected"], key=int):
        label = definition["options"][int(index)]
        details = answer["details"].get(index, "")
        if index == "5" and answer["other_items"]:
            lines.extend(f"Other: {item}" for item in answer["other_items"])
        else:
            lines.append(f"{label}: {details}" if details else label)
    for key, prefix, other_key in (
        ("0", "Primary FHIR release used in production", "fhir_other"),
        ("1", "HL7 v2 message types", "hl7v2_other"),
    ):
        values = [
            f"Other: {answer['details'][other_key]}"
            if value == "Other" and answer["details"].get(other_key)
            else value
            for value in answer["followups"].get(key, [])
        ]
        if values:
            lines.append(f"{prefix}: {', '.join(values)}")
    if answer["text"]:
        lines.append(f"Supplementary Q3 note: {answer['text']}")
    answer["readable_answer"] = lines
    return answer
