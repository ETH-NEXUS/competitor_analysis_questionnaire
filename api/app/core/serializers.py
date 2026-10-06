import json
from pathlib import Path

from django.utils import timezone
from rest_framework import serializers

from .models import Author, Book, QuestionnaireResponse
from .questionnaire import QUESTION_COLUMNS, answer_text


MIN_INTEROPERABILITY_TEST_YEAR = 1900


# Fix for spectacular, used in settings.py - leave it here
class SessionLoginTokenSerializer(serializers.Serializer):
    key = serializers.CharField(read_only=True, required=False)


class AccessMessageSerializer(serializers.Serializer):
    message = serializers.CharField()
    user = serializers.CharField(required=False)


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ("name", "date_of_birth")
        ref_name = "NEXUSAuthorSerializer"


class BookSerializer(serializers.ModelSerializer):
    author = AuthorSerializer()

    class Meta:
        model = Book
        fields = "__all__"


class QuestionnaireProductSerializer(serializers.Serializer):
    name = serializers.CharField(allow_blank=True, max_length=2000)
    description = serializers.CharField(allow_blank=True, max_length=20000)
    source = serializers.ChoiceField(choices=("", "0", "1"))
    standalone = serializers.BooleanField(required=False, default=False)


class ClinicalWorkflowSerializer(serializers.Serializer):
    reused_data = serializers.ListField(
        child=serializers.ChoiceField(choices=("patient", "medication", "lab", "other", "none", "unknown")),
        max_length=6,
        required=False,
        default=list,
    )
    other_reused_data = serializers.CharField(allow_blank=True, max_length=200, required=False, default="")
    write_back = serializers.ChoiceField(
        choices=("", "automatic", "user_action", "manual", "none", "unknown"),
        required=False,
        default="",
    )
    separate_app = serializers.ChoiceField(
        choices=("", "embedded", "sso", "separate_login", "unknown"),
        required=False,
        default="",
    )
    patient_context = serializers.ChoiceField(
        choices=("", "automatic", "manual", "none", "unknown"),
        required=False,
        default="",
    )
    manual_steps = serializers.CharField(
        allow_blank=True, max_length=2000, required=False, default=""
    )

    def validate_reused_data(self, value):
        if {"none", "unknown"}.intersection(value) and len(value) > 1:
            raise serializers.ValidationError(
                "None and Not sure cannot be combined with other data types."
            )
        return value

    def validate(self, attrs):
        if "other" in attrs["reused_data"] and not attrs["other_reused_data"].strip():
            raise serializers.ValidationError({"other_reused_data": "Specify the other CIS data reused."})
        return attrs


class ClinicalOfferingSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("core", "integration", "function"))
    name = serializers.CharField(allow_blank=True, max_length=200)
    description = serializers.CharField(allow_blank=True, max_length=2000)
    purposes = serializers.ListField(child=serializers.CharField(max_length=200), max_length=18, required=False, default=list)
    purpose_other = serializers.CharField(allow_blank=True, max_length=200, required=False, default="")
    source = serializers.ChoiceField(choices=("native", "partner"))
    developer = serializers.CharField(allow_blank=True, max_length=200)
    functions = serializers.ListField(child=serializers.CharField(max_length=200), max_length=30)
    specialties = serializers.ListField(child=serializers.CharField(max_length=200), max_length=30)
    other_functions = serializers.ListField(
        child=serializers.CharField(max_length=200), max_length=30
    )
    other_specialties = serializers.ListField(
        child=serializers.CharField(max_length=200), max_length=30
    )
    all_specialties = serializers.BooleanField()
    standalone = serializers.BooleanField()
    category_b = serializers.BooleanField(required=False, default=False)
    cis_relationship = serializers.ChoiceField(
        choices=("", "independent", "integration", "specific", "either", "other"),
        required=False,
        default="",
    )
    cis_relationship_other = serializers.CharField(allow_blank=True, max_length=200, required=False, default="")
    cis_integration = serializers.ChoiceField(
        choices=("", "yes", "optional", "no"), required=False, default=""
    )
    workflow = ClinicalWorkflowSerializer(required=False)

    def validate(self, attrs):
        if attrs["kind"] == "integration" and "Other" in attrs["purposes"] and not attrs["purpose_other"].strip():
            raise serializers.ValidationError({"purpose_other": "Specify the other integration purpose."})
        if attrs["kind"] == "function" and attrs["category_b"]:
            if not attrs["cis_relationship"] or not attrs["cis_integration"]:
                raise serializers.ValidationError("Answer both CIS relationship questions for the specialized solution.")
            if attrs["cis_relationship"] == "other" and not attrs["cis_relationship_other"].strip():
                raise serializers.ValidationError({"cis_relationship_other": "Specify the other CIS relationship."})
        return attrs


class CertificationDetailSerializer(serializers.Serializer):
    name = serializers.CharField(allow_blank=True, max_length=200, required=False, default="")
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=("organization", "solution", "other")),
        max_length=3,
    )
    scope_other = serializers.CharField(allow_blank=True, max_length=200, required=False, default="")
    valid_until = serializers.RegexField(regex=r"^(?:|\d{4})$", allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if not attrs["scopes"]:
            raise serializers.ValidationError({"scopes": "Select at least one scope."})
        if "other" in attrs["scopes"] and not attrs["scope_other"].strip():
            raise serializers.ValidationError({"scope_other": "Specify the other scope."})
        if attrs["valid_until"] and int(attrs["valid_until"]) < MIN_INTEROPERABILITY_TEST_YEAR:
            raise serializers.ValidationError({"valid_until": "Enter a valid year."})
        return attrs


class InteroperabilityTestEventSerializer(serializers.Serializer):
    event = serializers.ChoiceField(
        choices=("", "Digital Health Projectathon", "IHE Connectathon", "Other")
    )
    event_other = serializers.CharField(
        allow_blank=True, max_length=200, required=False, default=""
    )
    year = serializers.RegexField(
        regex=r"^(?:|\d{4})$", allow_blank=True, required=False, default=""
    )
    profiles = serializers.CharField(allow_blank=True, max_length=2000, required=False, default="")
    outcome = serializers.ChoiceField(
        choices=(
            "",
            "Successful",
            "Partially successful",
            "Unsuccessful",
            "No formal result",
            "Other",
        )
    )
    outcome_other = serializers.CharField(
        allow_blank=True, max_length=200, required=False, default=""
    )

    def validate(self, attrs):
        if not attrs["event"] or not attrs["outcome"]:
            raise serializers.ValidationError("Event and outcome are required.")
        year = attrs.get("year", "")
        if not year or not MIN_INTEROPERABILITY_TEST_YEAR <= int(year) <= timezone.now().year + 1:
            raise serializers.ValidationError({"year": "Enter a valid four-digit year."})
        if attrs["event"] == "Other" and not attrs["event_other"].strip():
            raise serializers.ValidationError({"event_other": "Specify the event."})
        if attrs["outcome"] == "Other" and not attrs["outcome_other"].strip():
            raise serializers.ValidationError({"outcome_other": "Specify the outcome."})
        return attrs


class QuestionnaireAnswerSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000)
    selected = serializers.ListField(child=serializers.CharField(max_length=20), max_length=100)
    text = serializers.CharField(allow_blank=True, max_length=20000)
    details = serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=20000))
    followups = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField(max_length=200), max_length=20),
        required=False,
        default=dict,
    )
    testing_events = serializers.ListField(
        child=InteroperabilityTestEventSerializer(), max_length=30, required=False, default=list
    )
    certification_details = serializers.DictField(
        child=CertificationDetailSerializer(), required=False, default=dict
    )
    other_items = serializers.ListField(
        child=serializers.CharField(allow_blank=False, max_length=2000),
        max_length=100,
        required=False,
        default=list,
    )
    rows = serializers.DictField(
        child=serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=20000))
    )
    products = serializers.DictField(
        child=serializers.ListField(child=QuestionnaireProductSerializer(), max_length=100),
        required=False,
        default=dict,
    )
    offerings = serializers.ListField(
        child=ClinicalOfferingSerializer(), max_length=100, required=False, default=list
    )
    readable_answer = serializers.ListField(
        child=serializers.CharField(max_length=100000), max_length=100
    )


HL7_V2_MESSAGE_TYPES = {"ADT", "ORM", "ORU", "OML", "MDM", "SIU", "DFT", "BAR", "RDE", "RAS", "VXU", "Other", "Not sure"}
IMPLEMENTATION_REQUIREMENTS = {str(index) for index in range(10)}


def validate_followups(question_id, answer):
    selected = answer.get("selected", [])
    followups = answer.get("followups", {})
    details = answer.get("details", {})
    if question_id == "standards":
        if set(followups) - {"0", "1"}:
            raise serializers.ValidationError({"answers": "Invalid interoperability follow-up."})
        for key, choices, other_key in (
            ("0", {"R2", "R3", "R4", "R4B", "R5", "Other"}, "fhir_other"),
            ("1", HL7_V2_MESSAGE_TYPES, "hl7v2_other"),
        ):
            values = followups.get(key, [])
            if key in selected and not values:
                raise serializers.ValidationError({"answers": "Select the supported release or message types."})
            if key not in selected and values or len(values) != len(set(values)) or set(values) - choices:
                raise serializers.ValidationError({"answers": "Invalid interoperability follow-up selection."})
            if "Other" in values and not details.get(other_key, "").strip():
                raise serializers.ValidationError({"answers": "Specify the Other interoperability answer."})
        v2 = followups.get("1", [])
        if "Not sure" in v2 and len(v2) > 1:
            raise serializers.ValidationError({"answers": "Not sure cannot be combined with message types."})
    elif question_id == "requirements":
        required = followups.get("1", [])
        if set(followups) - {"1"} or set(required) - IMPLEMENTATION_REQUIREMENTS or len(required) != len(set(required)):
            raise serializers.ValidationError({"answers": "Invalid implementation requirement selection."})
        if (selected == ["1"]) != bool(required):
            raise serializers.ValidationError({"answers": "Select what is required when standard configuration is not sufficient."})
        if "9" in required and not details.get("requirements_other", "").strip():
            raise serializers.ValidationError({"answers": "Specify the other implementation requirement."})
    elif followups:
        raise serializers.ValidationError({"answers": "Follow-up answers are attached to the wrong question."})


def validate_certification_details(question_id, answer):
    entries = answer.get("certification_details", {})
    if question_id != "certifications":
        if entries:
            raise serializers.ValidationError({"answers": "Certification details belong in Q8."})
        return
    selected = set(answer.get("selected", []))
    expected = {index for index in selected if index in {str(item) for item in range(7)}}
    if set(entries) != expected:
        raise serializers.ValidationError({"answers": "Provide details for each selected certification."})
    for index, entry in entries.items():
        if int(index) >= 5 and not entry["name"].strip():
            raise serializers.ValidationError({"answers": "Specify the other certification or assessment name."})


def validate_answer_details(answers, schema):
    for question_id, answer in answers.items():
        validate_followups(question_id, answer)
        validate_certification_details(question_id, answer)
        if answer.get("testing_events") and (
            question_id != "interoperabilityTesting" or "0" not in answer.get("selected", [])
        ):
            raise serializers.ValidationError(
                {"answers": "Testing events require a Yes answer to interoperability testing."}
            )
        if (
            schema.get(question_id, {}).get("kind") == "single"
            and len(answer.get("other_items", [])) > 1
        ):
            raise serializers.ValidationError(
                {"answers": f"{question_id} accepts only one Other answer."}
            )
        if question_id != "clinicalCapabilities" and answer.get("offerings"):
            raise serializers.ValidationError(
                {"answers": "Clinical offerings belong in the clinical products question."}
            )
        for offering in answer.get("offerings", []):
            if (offering["kind"] == "integration") != (offering["source"] == "partner"):
                raise serializers.ValidationError(
                    {"answers": "Only external integrations can be third-party products."}
                )


class QuestionnaireResponseSerializer(serializers.ModelSerializer):
    submission_id = serializers.UUIDField(write_only=True)
    answers = serializers.DictField(
        child=QuestionnaireAnswerSerializer(), write_only=True, allow_empty=False
    )

    class Meta:
        model = QuestionnaireResponse
        fields = (
            "id",
            "submission_id",
            "respondent_name",
            "respondent_email",
            "provider_name",
            "solution_name",
            "hospital_wide_cis",
            "specialized_clinical",
            "data_interoperability",
            "patient_facing",
            "answers",
            "submitted_at",
        )
        read_only_fields = ("id", "submitted_at")
        extra_kwargs = {
            field: {"write_only": True} for field in fields if field not in ("id", "submitted_at")
        }

    def validate(self, attrs):
        unknown = set(attrs["answers"]) - QUESTION_COLUMNS.keys()
        if unknown:
            raise serializers.ValidationError({"answers": "Unrecognized question identifiers."})
        schema = json.loads(Path(__file__).with_name("analysis_schema.json").read_text())
        validate_answer_details(attrs["answers"], schema)
        category_fields = (
            "hospital_wide_cis",
            "specialized_clinical",
            "data_interoperability",
            "patient_facing",
        )
        if not any(attrs.get(field, False) for field in category_fields):
            raise serializers.ValidationError("Select at least one solution category.")
        export_selection = attrs["answers"].get("export", {}).get("selected", [])
        if not set(export_selection).intersection({"2", "3", "4"}):
            attrs["answers"].pop("exportDetails", None)
        return attrs

    def create(self, validated_data):
        submission_id = validated_data.pop("submission_id")
        answers = validated_data.pop("answers")
        validated_data.update(
            {
                QUESTION_COLUMNS[question_id][0]: answer_text(answer)
                for question_id, answer in answers.items()
            }
        )
        certification_details = answers.get("certifications", {}).get("certification_details", {})
        validated_data["certification_details"] = json.dumps(certification_details, ensure_ascii=False) if certification_details else ""
        validated_data["answer_data"] = answers
        response, _created = QuestionnaireResponse.objects.get_or_create(
            submission_id=submission_id,
            defaults=validated_data,
        )
        return response
