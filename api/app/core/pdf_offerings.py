"""Recover the labelled product fields in older downloadable response PDFs."""

import re


KINDS = {
    "Core CIS platform": "core",
    "External integration": "integration",
    "Specialized function": "function",
}
RELATIONSHIPS = {
    "Can operate independently or be integrated with a hospital-wide CIS": "either",
    "Requires integration with a hospital-wide CIS, but is not tied to a specific CIS vendor": "integration",
    "Requires integration with a specific CIS/platform": "specific",
    "Does not integrate with a hospital-wide CIS": "none",
    "Other \u2013 specify": "other",
}
WORKFLOW = {
    "Connected CIS write-back": (
        "write_back",
        {
            "Automatically": "automatic",
            "Only after a user action": "user_action",
            "Manual transfer or duplicate entry": "manual",
            "No information is written back": "none",
            "Not sure / not applicable": "unknown",
        },
    ),
    "Separate application": (
        "separate_app",
        {
            "No, it is embedded in the CIS": "embedded",
            "Yes, with single sign-on": "sso",
            "Yes, with a separate sign-in": "separate_login",
            "Not sure": "unknown",
        },
    ),
    "Patient context": (
        "patient_context",
        {
            "Automatically transferred": "automatic",
            "User must select the patient again": "manual",
            "No patient context is transferred": "none",
            "Not sure / not applicable": "unknown",
        },
    ),
}
REUSED = {
    "Patient details": "patient",
    "Medication data": "medication",
    "Laboratory results": "lab",
    "None of these": "none",
    "Not sure": "unknown",
}
FIELD_LABELS = (
    "Third-party company",
    "What it does",
    "Type/purpose",
    "Areas",
    "CIS relationship",
    "Standalone purchase",
    "Connected CIS data reused",
    "Connected CIS write-back",
    "Separate application",
    "Patient context",
    "Manual workflow steps",
)


def value(text):
    return "" if text in {"Not answered", "Not specified"} else text


def split_list(text):
    return [value(part.strip()) for part in text.split(", ") if value(part.strip())]


def workflow_fields(fields):
    workflow = {
        "reused_data": [],
        "other_reused_data": "",
        "manual_steps": value(fields.get("Manual workflow steps", "")),
    }
    for label, (key, options) in WORKFLOW.items():
        workflow[key] = options.get(fields.get(label, ""), "")
    for item in split_list(fields.get("Connected CIS data reused", "")):
        if item.startswith("Other:"):
            workflow["reused_data"].append("other")
            workflow["other_reused_data"] = value(item[6:].strip())
        elif item in REUSED:
            workflow["reused_data"].append(REUSED[item])
    return workflow


def recover_offering(line, schema):
    match = re.match(r"^(Core CIS platform|External integration|Specialized function): (.*)$", line)
    if not match:
        return None
    parts = re.split(
        r"; (?=(?:"
        + "|".join(re.escape(label) for label in FIELD_LABELS)
        + r"):|Developed by your company)",
        match[2],
    )
    fields = dict(part.split(": ", 1) for part in parts[1:] if ": " in part)
    kind = KINDS[match[1]]
    tags = split_list(fields.get("Areas", ""))
    functions = schema["clinicalCapabilities"].get("options", [])
    specialties = schema["specialties"].get("options", [])
    relationship = fields.get("CIS relationship", "")
    relationship_choice = next(
        (
            choice
            for label, choice in RELATIONSHIPS.items()
            if relationship == label or relationship.startswith(label + ": ")
        ),
        "",
    )
    purposes = split_list(fields.get("Type/purpose", ""))
    other_purpose = next((item[6:].strip() for item in purposes if item.startswith("Other:")), "")
    return {
        "kind": kind,
        "name": value(parts[0]),
        "description": value(fields.get("What it does", "")),
        "source": "partner"
        if kind == "integration" or "Third-party company" in fields
        else "native",
        "developer": value(fields.get("Third-party company", "")),
        "functions": [tag for tag in tags if tag in functions],
        "specialties": [tag for tag in tags if tag in specialties],
        "other_functions": [
            tag
            for tag in tags
            if tag not in functions and tag not in specialties and tag != "Across specialties"
        ],
        "other_specialties": [],
        "all_specialties": "Across specialties" in tags,
        "standalone": fields.get("Standalone purchase") == "Yes",
        "category_b": "CIS relationship" in fields,
        "cis_relationship": relationship_choice,
        "cis_relationship_other": relationship.split(": ", 1)[1]
        if relationship_choice == "other" and ": " in relationship
        else "",
        "purposes": ["Other" if item.startswith("Other:") else item for item in purposes],
        "purpose_other": value(other_purpose),
        "workflow": workflow_fields(fields),
    }


def recover_offerings(lines, schema):
    return [entry for line in lines if (entry := recover_offering(line, schema)) is not None]
