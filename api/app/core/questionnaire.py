"""Stable mapping between submitted question IDs and response-table columns."""

import json


# Order is also the order used by the comparison table and response detail page.
QUESTION_COLUMNS = {
    "apiAccess": ("api_access", "1.1 API access"),
    "apiTypes": ("api_types", "1.1 Documented API types"),
    "standards": ("interoperability_standards", "1.1 Interoperability standards"),
    "deployment": ("deployment_models", "1.1 Deployment models"),
    "interoperabilityTesting": ("interoperability_testing", "1.1 Swiss interoperability testing"),
    "externalIntegration": ("external_integration", "1.2 External integration support"),
    "clinicalDataManagement": ("clinical_data_management", "1.2 Clinical information management"),
    "dataRetention": ("data_retention", "1.2 Patient information retained"),
    "security": ("security_capabilities", "1.3 Security capabilities"),
    "certifications": ("certifications", "1.3 Certifications and conformity"),
    "roadmap": ("roadmap_involvement", "1.4 Customer roadmap involvement"),
    "configuration": ("configuration_options", "1.4 Customer-specific configuration"),
    "transition": ("exit_provisions", "1.4 Exit and transition provisions"),
    "rights": ("content_rights", "1.4 Configuration and content rights"),
    "pricing": ("pricing_model", "1.5 Licence / subscription pricing"),
    "costs": ("cost_components", "1.5 Included and additional costs"),
    "term": ("contract_term", "1.5 Initial contract term"),
    "exitCosts": ("exit_costs", "1.5 Termination and switching costs"),
    "thirdPartyIntegration": ("third_party_integration", "2.1 Third-party application integration"),
    "developerIndependence": ("developer_independence", "2.1 Independent integration development"),
    "developerResources": ("developer_resources", "2.1 Developer resources"),
    "thirdPartyApproval": ("third_party_approval", "2.1 Third-party application approval"),
    "appIntegrationStandards": ("app_integration_standards", "2.2 Application integration standards"),
    "structuredTypes": ("structured_information_types", "2.3 Structured clinical information types"),
    "structure": ("data_structure", "Clinical data structure"),
    "terminologies": ("clinical_terminologies", "2.3 Clinical terminologies and coding"),
    "clinicalModels": ("clinical_data_models", "2.3 Clinical data models"),
    "coding": ("clinical_coding", "Clinical coding standards"),
    "reportingMethods": ("reporting_methods", "2.3 Reporting and analysis access"),
    "reporting": ("reporting_access", "Reporting and analysis access"),
    "research": ("research_capabilities", "2.3 Research capabilities"),
    "secondary": ("secondary_use_governance", "2.3 Secondary-use governance"),
    "archive": ("document_archive", "2.4 Long-term document and image storage"),
    "export": ("record_export", "2.4 Complete clinical record export"),
    "exportDetails": ("record_export_details", "2.4 Export limitations and dependencies"),
    "switzerland": ("swiss_data_residency", "2.4 Switzerland-only data storage"),
    "clinicalCapabilities": ("clinical_capabilities", "2.5 Clinical functional areas"),
    "specialties": ("clinical_specialties", "Clinical specialties"),
    "documentationMethods": ("documentation_methods", "2.5 Documentation burden reduction"),
    "documentation": ("documentation_support", "Documentation burden reduction"),
    "dataCapabilities": ("data_capabilities", "2.6 Data / interoperability capabilities"),
    "dataExchangeHandling": ("data_exchange_handling", "2.6 Exchanged data handling"),
    "architecture": ("architecture_role", "2.6 Role in hospital IT architecture"),
    "dataIndependent": ("data_independence", "2.6 Data solution independent of CIS"),
    "patientFunctions": ("patient_functions", "2.7 Patient-facing functions"),
    "languages": ("patient_languages", "2.7 Patient-facing languages"),
    "aggregationMethods": ("aggregation_methods", "2.7 Multi-system patient information"),
    "aggregation": ("patient_aggregation", "Multi-system patient information"),
    "writeBack": ("patient_write_back", "2.7 Patient information written back to clinical systems"),
    "patientIndependent": ("patient_independence", "2.7 Patient solution independent of CIS"),
    "patientExchange": ("patient_exchange", "2.7 Patient solution data exchange"),
    "implementationInvolvement": ("implementation_involvement", "2.8 Implementation involvement"),
    "parties": ("implementation_parties", "Implementation parties"),
    "rollout": ("rollout_approaches", "2.9 Rollout approaches"),
    "migration": ("migration_approach", "2.9 Migration approach"),
    "goLive": ("go_live_services", "2.9 Change management and go-live services"),
    "requirements": ("integration_requirements", "2.10 Integration requirements"),
}

LEGACY_QUESTION_IDS = frozenset(
    {"structure", "coding", "reporting", "documentation", "aggregation", "parties", "specialties", "externalIntegration", "clinicalDataManagement", "architecture"}
)

VERSION_5_QUESTION_IDS = frozenset(
    {
        "thirdPartyIntegration", "developerIndependence", "developerResources",
        "appIntegrationStandards", "structuredTypes", "terminologies", "clinicalModels",
        "thirdPartyApproval", "reportingMethods", "documentationMethods",
        "aggregationMethods", "implementationInvolvement",
    }
)
VERSION_6_QUESTION_IDS = frozenset(
    {"externalIntegration", "clinicalDataManagement", "dataRetention"}
)
VERSION_9_QUESTION_IDS = frozenset(
    {"interoperabilityTesting", "certifications"}
)
VERSION_10_QUESTION_IDS = frozenset({"dataExchangeHandling", "patientExchange"})


def introduced_version(question_id):
    if question_id in VERSION_10_QUESTION_IDS:
        return 10
    if question_id in VERSION_9_QUESTION_IDS:
        return 9
    if question_id in VERSION_6_QUESTION_IDS:
        return 6
    if question_id in VERSION_5_QUESTION_IDS:
        return 5
    return 1

SCOPE_FIELDS = {
    "A": "hospital_wide_cis",
    "B": "specialized_clinical",
    "C": "data_interoperability",
    "D": "patient_facing",
}


def scope_codes(response):
    codes = [code for code, field in SCOPE_FIELDS.items() if getattr(response, field)]
    if response.patient_administration:
        codes.append("Legacy patient administration")
    return codes


def answer_text(answer):
    """Keep multi-select, free-text and matrix answers readable in one SQL column."""
    lines = answer.get("readable_answer")
    if lines:
        return "\n".join(lines)
    if answer.get("text"):
        return answer["text"]
    if any(
        answer.get(key)
        for key in ("selected", "details", "followups", "testing_events", "certification_details", "rows", "offerings")
    ):
        # Preserve all details if an older submission lacks display text.
        return json.dumps(answer, ensure_ascii=False)
    return ""
