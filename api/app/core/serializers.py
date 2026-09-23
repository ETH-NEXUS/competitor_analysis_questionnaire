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


class QuestionnaireAnswerSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000)
    selected = serializers.ListField(child=serializers.CharField(max_length=20), max_length=100)
    text = serializers.CharField(allow_blank=True, max_length=20000)
    details = serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=20000))
    rows = serializers.DictField(
        child=serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=20000))
    )
    readable_answer = serializers.ListField(
        child=serializers.CharField(max_length=100000), max_length=100
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
        response, _created = QuestionnaireResponse.objects.get_or_create(
            submission_id=submission_id,
            defaults=validated_data,
        )
        return response
