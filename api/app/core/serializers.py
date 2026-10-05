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
        child=serializers.ChoiceField(choices=("patient", "medication", "lab", "none", "unknown")),
        max_length=5,
        required=False,
        default=list,
    )
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


class ClinicalOfferingSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("core", "integration", "function"))
    name = serializers.CharField(allow_blank=True, max_length=200)
    description = serializers.CharField(allow_blank=True, max_length=2000)
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
    workflow = ClinicalWorkflowSerializer(required=False)


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
        child=serializers.ListField(child=serializers.CharField(max_length=200), max_length=6),
        required=False,
        default=dict,
    )
    testing_events = serializers.ListField(
        child=InteroperabilityTestEventSerializer(), max_length=30, required=False, default=list
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


def validate_fhir_followup(question_id, answer):
    if not answer.get("followups"):
        return
    releases = answer["followups"].get("0", [])
    if (
        question_id != "standards"
        or set(answer["followups"]) != {"0"}
        or "0" not in answer.get("selected", [])
        or len(releases) != len(set(releases))
        or any(item not in {"R2", "R3", "R4", "R4B", "R5", "Other"} for item in releases)
    ):
        raise serializers.ValidationError({"answers": "Invalid FHIR release selection."})
    if "Other" in releases and not answer.get("details", {}).get("fhir_other", "").strip():
        raise serializers.ValidationError({"answers": "Specify the Other FHIR release."})


def validate_answer_details(answers, schema):
    for question_id, answer in answers.items():
        validate_fhir_followup(question_id, answer)
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
        validated_data["certification_details"] = answers.get("certifications", {}).get("text", "")
        validated_data["answer_data"] = answers
        response, _created = QuestionnaireResponse.objects.get_or_create(
            submission_id=submission_id,
            defaults=validated_data,
        )
        return response
