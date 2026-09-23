from django.core.exceptions import ValidationError
from django.db import models

from .questionnaire import QUESTION_COLUMNS


def response_answer_field(label):
    # NULL means not asked; an empty string means asked but left unanswered.
    return models.TextField(label, null=True, blank=True)


class Author(models.Model):
    name = models.CharField(max_length=50)
    date_of_birth = models.DateField()
    date_of_death = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.name


class Book(models.Model):
    title = models.CharField(max_length=100)
    author = models.ForeignKey(Author, on_delete=models.PROTECT, null=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.title


class QuestionnaireResponse(models.Model):
    submission_id = models.UUIDField(unique=True, null=True, editable=False)
    respondent_name = models.CharField(max_length=200, blank=True)
    respondent_email = models.EmailField(db_index=True)
    provider_name = models.CharField("Company", max_length=200, db_index=True)
    solution_name = models.CharField(max_length=200, db_index=True, blank=True)
    hospital_wide_cis = models.BooleanField(
        "A. Hospital-wide clinical information system", default=False
    )
    patient_administration = models.BooleanField(
        "B. Patient administration / hospital management", default=False
    )
    specialized_clinical = models.BooleanField(
        "C. Specialized clinical solution / modules", default=False
    )
    data_interoperability = models.BooleanField(
        "D. Data / interoperability solution", default=False
    )
    patient_facing = models.BooleanField("E. Patient-facing solution", default=False)
    questionnaire_version = models.PositiveSmallIntegerField(default=1, editable=False)
    api_access = response_answer_field("1.1 API access")
    api_types = response_answer_field("1.1 Documented API types")
    interoperability_standards = response_answer_field("1.1 Interoperability standards")
    deployment_models = response_answer_field("1.1 Deployment models")
    data_structure = response_answer_field("1.2 Clinical data structure")
    clinical_coding = response_answer_field("1.2 Clinical coding standards")
    document_archive = response_answer_field("1.2 Long-term document and image storage")
    record_export = response_answer_field("1.2 Complete clinical record export")
    record_export_details = response_answer_field("1.2 Export limitations and dependencies")
    security_capabilities = response_answer_field("1.2 Security capabilities")
    swiss_data_residency = response_answer_field("1.2 Switzerland-only data storage")
    roadmap_involvement = response_answer_field("1.3 Customer roadmap involvement")
    configuration_options = response_answer_field("1.3 Customer-specific configuration")
    exit_provisions = response_answer_field("1.3 Exit and transition provisions")
    content_rights = response_answer_field("1.3 Configuration and content rights")
    pricing_model = response_answer_field("1.4 Licence / subscription pricing")
    cost_components = response_answer_field("1.4 Included and additional costs")
    contract_term = response_answer_field("1.4 Initial contract term")
    exit_costs = response_answer_field("1.4 Termination and switching costs")
    reporting_access = response_answer_field("1.5 Reporting and analysis access")
    research_capabilities = response_answer_field("1.5 Research capabilities")
    secondary_use_governance = response_answer_field("1.5 Secondary-use governance")
    clinical_capabilities = response_answer_field("2.1 Clinical functional areas")
    clinical_specialties = response_answer_field("2.1 Clinical specialties")
    documentation_support = response_answer_field("2.1 Documentation burden reduction")
    data_capabilities = response_answer_field("2.1 Data / interoperability capabilities")
    architecture_role = response_answer_field("2.1 Role in hospital IT architecture")
    data_independence = response_answer_field("2.1 Data solution independent of CIS")
    patient_functions = response_answer_field("2.1 Patient-facing functions")
    patient_languages = response_answer_field("2.1 Patient-facing languages")
    patient_aggregation = response_answer_field("2.1 Multi-system patient information")
    patient_write_back = response_answer_field(
        "2.1 Patient information written back to clinical systems"
    )
    patient_independence = response_answer_field("2.1 Patient solution independent of CIS")
    implementation_parties = response_answer_field("2.3 Implementation parties")
    rollout_approaches = response_answer_field("2.3 Rollout approaches")
    migration_approach = response_answer_field("2.3 Migration approach")
    go_live_services = response_answer_field("2.3 Change management and go-live services")
    integration_requirements = response_answer_field("2.3 Integration requirements")
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-submitted_at", "-pk"]

    def __str__(self):
        return f"{self.respondent_email} — {self.provider_name} / {self.solution_name}"

    def clean(self):
        super().clean()
        if not any(
            (
                self.hospital_wide_cis,
                self.patient_administration,
                self.specialized_clinical,
                self.data_interoperability,
                self.patient_facing,
            )
        ):
            raise ValidationError("Select at least one solution category.")
        if all(getattr(self, field) is None for field, _label in QUESTION_COLUMNS.values()):
            raise ValidationError("Provide questionnaire answers.")
