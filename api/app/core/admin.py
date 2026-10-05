from django.contrib import admin
from django.utils.html import format_html_join

from .models import QuestionnaireResponse, VendorInvitation
from .questionnaire import SCOPE_FIELDS
from .questionnaire_admin import (
    ANSWER_COLUMNS,
    CURRENT_QUESTION_COLUMNS,
    QuestionAnswerFilter,
    SolutionScopeFilter,
)


# Only models registered with this site appear in the questionnaire admin.
# Django's user accounts and authentication still provide staff login.
questionnaire_admin_site = admin.AdminSite(name="admin")
questionnaire_admin_site.site_header = "Questionnaire administration"
questionnaire_admin_site.site_title = "Questionnaire admin"
questionnaire_admin_site.index_title = "Questionnaire responses"
questionnaire_admin_site.index_template = "admin/questionnaire_index.html"


@admin.register(VendorInvitation, site=questionnaire_admin_site)
class VendorInvitationAdmin(admin.ModelAdmin):
    list_display = ("provider_name", "category", "invitation_sent", "reminder_sent", "declined", "submission_match_name", "notes")
    list_editable = ("category", "invitation_sent", "reminder_sent", "declined")
    list_filter = ("category", "invitation_sent", "reminder_sent", "declined")
    search_fields = ("provider_name", "submission_match_name", "notes")

    def has_module_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_view_permission(self, request, obj=None):  # noqa: ARG002 - Django hook signature
        return request.user.is_active and request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_change_permission(self, request, obj=None):  # noqa: ARG002 - Django hook signature
        return request.user.is_active and request.user.is_superuser

    def has_delete_permission(self, request, obj=None):  # noqa: ARG002 - Django hook signature
        return request.user.is_active and request.user.is_superuser


@admin.register(QuestionnaireResponse, site=questionnaire_admin_site)
class QuestionnaireResponseAdmin(admin.ModelAdmin):
    list_display = (
        "provider_name",
        "solution_scope",
        "form_version",
        *ANSWER_COLUMNS,
        "solution_name",
        "respondent_email",
        "submitted_at",
    )
    list_display_links = ("provider_name",)
    change_list_template = "admin/core/questionnaireresponse/change_list.html"
    list_filter = (
        SolutionScopeFilter,
        QuestionAnswerFilter,
        "questionnaire_version",
        "provider_name",
        "solution_name",
        "submitted_at",
    )
    search_fields = (
        "respondent_email",
        "respondent_name",
        "provider_name",
        "solution_name",
        *(field for field, _label in CURRENT_QUESTION_COLUMNS.values()),
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

    @admin.display(description="Form version", ordering="questionnaire_version")
    def form_version(self, obj):
        return f"v{obj.questionnaire_version}"

    def has_add_permission(self, _request):
        return False

    def has_change_permission(self, _request, obj=None):  # noqa: ARG002 - Django hook signature
        return False
