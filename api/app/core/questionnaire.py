"""Stable mapping between submitted question IDs and response-table columns."""

import json


# Order is also the order used by the comparison table and response detail page.
QUESTION_COLUMNS = {
    "apiAccess": ("api_access", "1.1 API access"),
    "apiTypes": ("api_types", "1.1 Documented API types"),
    "standards": ("interoperability_standards", "1.1 Interoperability standards"),
    "deployment": ("deployment_models", "1.1 Deployment models"),
    "structure": ("data_structure", "1.2 Clinical data structure"),
    "coding": ("clinical_coding", "1.2 Clinical coding standards"),
    "archive": ("document_archive", "1.2 Long-term document and image storage"),
    "export": ("record_export", "1.2 Complete clinical record export"),
    "exportDetails": ("record_export_details", "1.2 Export limitations and dependencies"),
    "security": ("security_capabilities", "1.2 Security capabilities"),
    "switzerland": ("swiss_data_residency", "1.2 Switzerland-only data storage"),
    "roadmap": ("roadmap_involvement", "1.3 Customer roadmap involvement"),
    "configuration": ("configuration_options", "1.3 Customer-specific configuration"),
    "transition": ("exit_provisions", "1.3 Exit and transition provisions"),
    "rights": ("content_rights", "1.3 Configuration and content rights"),
    "pricing": ("pricing_model", "1.4 Licence / subscription pricing"),
    "costs": ("cost_components", "1.4 Included and additional costs"),
    "term": ("contract_term", "1.4 Initial contract term"),
    "exitCosts": ("exit_costs", "1.4 Termination and switching costs"),
    "reporting": ("reporting_access", "1.5 Reporting and analysis access"),
    "research": ("research_capabilities", "1.5 Research capabilities"),
    "secondary": ("secondary_use_governance", "1.5 Secondary-use governance"),
    "clinicalCapabilities": ("clinical_capabilities", "2.1 Clinical functional areas"),
    "specialties": ("clinical_specialties", "2.1 Clinical specialties"),
    "documentation": ("documentation_support", "2.1 Documentation burden reduction"),
    "dataCapabilities": ("data_capabilities", "2.1 Data / interoperability capabilities"),
    "architecture": ("architecture_role", "2.1 Role in hospital IT architecture"),
    "dataIndependent": ("data_independence", "2.1 Data solution independent of CIS"),
    "patientFunctions": ("patient_functions", "2.1 Patient-facing functions"),
    "languages": ("patient_languages", "2.1 Patient-facing languages"),
    "aggregation": ("patient_aggregation", "2.1 Multi-system patient information"),
    "writeBack": ("patient_write_back", "2.1 Patient information written back to clinical systems"),
    "patientIndependent": ("patient_independence", "2.1 Patient solution independent of CIS"),
    "parties": ("implementation_parties", "2.3 Implementation parties"),
    "rollout": ("rollout_approaches", "2.3 Rollout approaches"),
    "migration": ("migration_approach", "2.3 Migration approach"),
    "goLive": ("go_live_services", "2.3 Change management and go-live services"),
    "requirements": ("integration_requirements", "2.3 Integration requirements"),
}

SCOPE_FIELDS = {
    "A": "hospital_wide_cis",
    "B": "patient_administration",
    "C": "specialized_clinical",
    "D": "data_interoperability",
    "E": "patient_facing",
}


def answer_text(answer):
    """Keep multi-select, free-text and matrix answers readable in one SQL column."""
    lines = answer.get("readable_answer")
    if lines:
        return "\n".join(lines)
    if answer.get("text"):
        return answer["text"]
    if any(answer.get(key) for key in ("selected", "details", "rows")):
        # Preserve all details if an older submission lacks display text.
        return json.dumps(answer, ensure_ascii=False)
    return ""
