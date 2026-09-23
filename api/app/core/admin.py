from django.contrib import admin
from django.utils.html import format_html_join

from .models import QuestionnaireResponse
from .questionnaire import QUESTION_COLUMNS, SCOPE_FIELDS
from .questionnaire_admin import ANSWER_COLUMNS, QuestionAnswerFilter, SolutionScopeFilter


# Only models registered with this site appear in the questionnaire admin.
# Django's user accounts and authentication still provide staff login.
questionnaire_admin_site = admin.AdminSite(name="admin")
questionnaire_admin_site.site_header = "Questionnaire administration"
questionnaire_admin_site.site_title = "Questionnaire admin"
questionnaire_admin_site.index_title = "Questionnaire responses"
questionnaire_admin_site.index_template = "admin/questionnaire_index.html"


@admin.register(QuestionnaireResponse, site=questionnaire_admin_site)
class QuestionnaireResponseAdmin(admin.ModelAdmin):
    list_display = (
        "provider_name",
        "solution_scope",
        *ANSWER_COLUMNS,
        "solution_name",
        "respondent_email",
        "submitted_at",
    )
    list_display_links = ("provider_name",)
    actions = None
    change_list_template = "admin/core/questionnaireresponse/change_list.html"
    list_filter = (
        SolutionScopeFilter,
        QuestionAnswerFilter,
        "provider_name",
        "solution_name",
        "submitted_at",
    )
    search_fields = (
        "respondent_email",
        "respondent_name",
        "provider_name",
        "solution_name",
        *(field for field, _label in QUESTION_COLUMNS.values()),
    )
    search_help_text = (
        "Search respondents, providers, solutions, or text within questionnaire answers."
    )
    date_hierarchy = "submitted_at"
    readonly_fields = (*list_display, "respondent_name", "questionnaire_version")
    fields = readonly_fields
    list_per_page = 25

    @admin.display(description="Solution scope")
    def solution_scope(self, obj):
        return format_html_join(
            ", ",
            '<abbr title="{}">{}</abbr>',
            (
                (obj._meta.get_field(field).verbose_name, code)
                for code, field in SCOPE_FIELDS.items()
                if getattr(obj, field)
            ),
        )

    def has_add_permission(self, _request):
        return False

    def has_change_permission(self, _request, obj=None):  # noqa: ARG002 - Django hook signature
        return False
