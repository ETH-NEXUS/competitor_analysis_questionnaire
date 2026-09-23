"""Comparison-table columns and filters for questionnaire responses."""

from django.contrib import admin

from .questionnaire import QUESTION_COLUMNS, SCOPE_FIELDS


def answer_column(field, label):
    @admin.display(description=label, ordering=field)
    def display(obj):
        value = getattr(obj, field)
        if value is None:
            return "Not applicable"
        return value or "Not answered"

    display.__name__ = field
    return display


ANSWER_COLUMNS = tuple(answer_column(field, label) for field, label in QUESTION_COLUMNS.values())


class SolutionScopeFilter(admin.SimpleListFilter):
    title = "solution scope includes"
    parameter_name = "scope"

    def lookups(self, _request, model_admin):
        return [
            (code, model_admin.model._meta.get_field(field).verbose_name)
            for code, field in SCOPE_FIELDS.items()
        ]

    def queryset(self, _request, queryset):
        field = SCOPE_FIELDS.get(self.value())
        return queryset.filter(**{field: True}) if field else queryset


class QuestionAnswerFilter(admin.SimpleListFilter):
    title = "question answer"
    parameter_name = "question"
    template = "admin/core/questionnaireresponse/answer_filter.html"

    def __init__(self, request, params, model, model_admin):
        answer_values = params.pop("answer", [])
        self.answer_value = answer_values[-1] if answer_values else ""
        self.preserved_parameters = [
            (key, value)
            for key, values in request.GET.lists()
            if key not in ("question", "answer", "p")
            for value in values
        ]
        super().__init__(request, params, model, model_admin)

    def lookups(self, _request, _model_admin):
        return list(QUESTION_COLUMNS.values())

    def expected_parameters(self):
        return ["question", "answer"]

    def queryset(self, _request, queryset):
        field = self.value()
        if field in dict(QUESTION_COLUMNS.values()) and self.answer_value.strip():
            return queryset.filter(**{f"{field}__icontains": self.answer_value.strip()})
        return queryset
