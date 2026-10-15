"""Recover editable structured details from older rendered answer lines."""

import re

from .pdf_corrections import COST_OPTIONS, REQUIREMENT_OPTIONS, SOURCE_OPTIONS


def clean(value):
    return "" if value in {"Not answered", "Not specified"} else value


def recover_rows(answer, lines, definition):
    for index, label in enumerate(definition["options"]):
        key = str(index)
        matches = [line[len(label) + 2 :] for line in lines if line.startswith(label + ": ")]
        if not matches:
            continue
        if definition["kind"] == "costs":
            classification, _, billing = matches[0].partition("; Charged per: ")
            if classification in COST_OPTIONS:
                answer["rows"][key] = {
                    "cost": str(COST_OPTIONS.index(classification)),
                    "billing_unit": billing,
                }
        else:
            answer["rows"][key] = {"provided": "yes" if matches[0].startswith("Yes") else "no"}
            products = []
            for line in matches:
                match = re.fullmatch(
                    r"Yes; Product / module name: (.*?); Brief description: (.*?); Native / partner: (.*?)(?:; Can be purchased and operated independently: (Yes|No))?",
                    line,
                )
                if match:
                    products.append(
                        {
                            "name": clean(match[1]),
                            "description": clean(match[2]),
                            "source": str(SOURCE_OPTIONS.index(match[3]))
                            if match[3] in SOURCE_OPTIONS
                            else "",
                            "standalone": match[4] == "Yes",
                        }
                    )
            if products:
                answer.setdefault("products", {})[key] = products


def recover_certificates(answer, lines, definition):
    entries = {}
    scopes = {"Organization": "organization", "Solution or product": "solution"}
    for index, label in enumerate(definition["options"][:7]):
        for line in lines:
            match = re.fullmatch(
                re.escape(label) + r"(?:: (.*?))?; Scope: (.*?); Valid until: (.*)", line
            )
            if not match:
                continue
            values = match[2].split(", ")
            other = next((value[7:] for value in values if value.startswith("Other: ")), "")
            entries[str(index)] = {
                "name": clean(match[1] or ""),
                "scopes": [scopes[value] for value in values if value in scopes]
                + (["other"] if other else []),
                "scope_other": other,
                "valid_until": clean(match[3]),
            }
            answer["details"].pop(str(index), None)
    answer["certification_details"] = entries


def recover_events(answer, lines):
    events = []
    for line in lines:
        match = re.fullmatch(
            r"Event: (.*?); Year: (.*?); Tested profiles / use cases: (.*?); Outcome: (.*)", line
        )
        if not match:
            continue
        title, year, profiles, outcome = (clean(value) for value in match.groups())
        known_event = title in {"Digital Health Projectathon", "IHE Connectathon", ""}
        known_outcome = outcome in {
            "Successful",
            "Partially successful",
            "Unsuccessful",
            "No formal result",
            "",
        }
        events.append(
            {
                "event": title if known_event else "Other",
                "event_other": "" if known_event else title,
                "year": year,
                "profiles": profiles,
                "outcome": outcome if known_outcome else "Other",
                "outcome_other": "" if known_outcome else outcome,
            }
        )
    answer["testing_events"] = events


def recover_details(question_id, answer, lines, definition):
    if definition["kind"] in {"costs", "capabilities"}:
        recover_rows(answer, lines, definition)
    if question_id == "certifications":
        recover_certificates(answer, lines, definition)
    if question_id == "interoperabilityTesting":
        recover_events(answer, lines)
    if question_id == "requirements":
        for line in lines:
            if not line.startswith("What is typically required: "):
                continue
            values = line.removeprefix("What is typically required: ").split(", ")
            selected = [
                str(REQUIREMENT_OPTIONS.index(value))
                for value in values
                if value in REQUIREMENT_OPTIONS
            ]
            other = next((value[7:] for value in values if value.startswith("Other: ")), "")
            if other:
                selected.append("9")
                answer["details"]["requirements_other"] = other
            answer["followups"] = {"1": selected}
    return answer
