"""Persistent, explicit links between submitted organizations and outreach vendors."""

from django.db import transaction

from .models import QuestionnaireResponse, VendorInvitation, VendorQuestionnaireLink


MAX_ORGANIZATION_LENGTH = 200


class VendorLinkError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def normalize_organization(name):
    return " ".join(name.split()).lower()


def _positive_id(payload, field):
    value = payload.get(field)
    if type(value) is not int or value <= 0:
        raise VendorLinkError(f"Invalid {field}.")
    return value


def _vendor(payload):
    item = VendorInvitation.objects.select_for_update().filter(pk=_positive_id(payload, "id")).first()
    if item is None:
        raise VendorLinkError("Vendor not found.", status=404)
    return item


def _organization(payload):
    response = QuestionnaireResponse.objects.only("provider_name").filter(pk=_positive_id(payload, "response_id")).first()
    if response is None:
        raise VendorLinkError("Submission not found. Refresh the page and try again.", status=404)
    name = response.provider_name.strip()
    if not name:
        raise VendorLinkError("This submission has no organization name.")
    return name


def _check_owner(name, target):
    key = normalize_organization(name)
    for vendor in VendorInvitation.objects.exclude(pk=target.pk if target else None).prefetch_related("questionnaire_links"):
        names = [vendor.provider_name, vendor.submission_match_name]
        names.extend(link.organization_name for link in vendor.questionnaire_links.all())
        if key in {normalize_organization(value) for value in names if value}:
            raise VendorLinkError("This organization is already linked to another vendor. Refresh the page to see the link.", status=409)


@transaction.atomic
def update_questionnaire_link(payload):
    action = payload["action"]
    allowed = {
        "link": {"action", "id", "response_id"},
        "create_from_submission": {"action", "response_id"},
        "unlink": {"action", "id", "organization"},
    }
    if set(payload) != allowed[action]:
        raise VendorLinkError("Invalid linking request.")
    if action == "unlink":
        vendor = _vendor(payload)
        name = payload["organization"]
        if not isinstance(name, str) or not name.strip() or len(name) > MAX_ORGANIZATION_LENGTH:
            raise VendorLinkError("Invalid organization name.")
        vendor.questionnaire_links.filter(normalized_name=normalize_organization(name)).delete()
        return vendor
    return _link_organization(payload)


def _link_organization(payload):
    name = _organization(payload)
    vendor = _vendor(payload) if payload["action"] == "link" else None
    _check_owner(name, vendor)
    if vendor is None:
        vendor = VendorInvitation.objects.create(provider_name=name)
    link, _ = VendorQuestionnaireLink.objects.get_or_create(
        normalized_name=normalize_organization(name),
        defaults={"vendor": vendor, "organization_name": name},
    )
    if link.vendor_id != vendor.pk:
        raise VendorLinkError("This organization was just linked to another vendor. Refresh the page.", status=409)
    return vendor
