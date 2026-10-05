import json
from pathlib import Path

from rest_framework import serializers

from .models import Author, Book, QuestionnaireResponse
from .questionnaire import QUESTION_COLUMNS, answer_text


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
    manual_steps = serializers.CharField(allow_blank=True, max_length=2000, required=False, default="")

    def validate_reused_data(self, value):
        if {"none", "unknown"}.intersection(value) and len(value) > 1:
            raise serializers.ValidationError("None and Not sure cannot be combined with other data types.")
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


class QuestionnaireAnswerSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000)
    selected = serializers.ListField(child=serializers.CharField(max_length=20), max_length=100)
    text = serializers.CharField(allow_blank=True, max_length=20000)
    details = serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=20000))
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


def validate_answer_details(answers, schema):
    for question_id, answer in answers.items():
        if schema.get(question_id, {}).get("kind") == "single" and len(answer.get("other_items", [])) > 1:
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
            "patient_administration",
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
            "patient_administration",
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
