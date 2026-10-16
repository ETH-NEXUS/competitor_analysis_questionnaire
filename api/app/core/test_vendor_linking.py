import json
import re
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse

from .analysis import analysis, save_vendor_outreach
from .models import QuestionnaireResponse, VendorInvitation, VendorQuestionnaireLink


class VendorQuestionnaireLinkTests(TestCase):
    def setUp(self):
        VendorInvitation.objects.all().delete()
        self.factory = RequestFactory()
        self.user = SimpleNamespace(pk=1, is_active=True, is_authenticated=True, is_superuser=True)
        self.vendor = VendorInvitation.objects.create(provider_name="CISTEC", submission_match_name="Older name", notes="Keep me")
        self.response = QuestionnaireResponse.objects.create(
            provider_name="Cistec Hospital Systems", solution_name="CIS", respondent_email="respondent@example.com",
        )

    def post(self, payload):
        request = self.factory.post("/admin/analysis/vendors/", data=json.dumps(payload), content_type="application/json")
        request.user = self.user
        return save_vendor_outreach(request)

    def link(self, response=None, vendor=None):
        return self.post({"action": "link", "id": (vendor or self.vendor).pk, "response_id": (response or self.response).pk})

    def test_links_persist_and_allow_several_names_without_replacing_alias(self):
        result = self.link()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(json.loads(result.content)["vendor"]["linked_names"], [self.response.provider_name])
        second = QuestionnaireResponse.objects.create(provider_name="Another name", respondent_email="other@example.com")
        self.assertEqual(self.link(second).status_code, 200)
        self.assertEqual(self.link().status_code, 200, "Repeated linking is idempotent")
        self.assertEqual(self.vendor.questionnaire_links.count(), 2)
        self.vendor.refresh_from_db()
        self.assertEqual(self.vendor.submission_match_name, "Older name")
        self.assertEqual(self.vendor.notes, "Keep me")
        self.response.refresh_from_db()
        self.assertEqual(self.response.provider_name, "Cistec Hospital Systems")
        request = self.factory.get("/admin/analysis/")
        request.user = self.user
        page = analysis(request).content.decode()
        data = json.loads(re.search(r'<script id="analysis-data" type="application/json">(.*?)</script>', page).group(1))
        self.assertEqual(set(data["invitations"][0]["linked_names"]), {"Another name", self.response.provider_name})

    def test_link_cannot_be_stolen_by_another_vendor_or_alias(self):
        self.assertEqual(self.link().status_code, 200)
        other = VendorInvitation.objects.create(provider_name="Other")
        repeat = QuestionnaireResponse.objects.create(provider_name=" cistec  HOSPITAL systems ", respondent_email="repeat@example.com")
        self.assertEqual(self.link(repeat, other).status_code, 409)
        self.assertEqual(self.post({"action": "create_from_submission", "response_id": repeat.pk}).status_code, 409)
        self.assertEqual(self.post({"action": "update", "id": other.pk, "match_name": self.response.provider_name}).status_code, 400)
        other.submission_match_name = self.response.provider_name
        with self.assertRaises(ValidationError):
            other.full_clean()
        self.assertEqual(VendorQuestionnaireLink.objects.get().vendor_id, self.vendor.pk)

    def test_existing_automatic_match_cannot_be_linked_elsewhere(self):
        self.response.provider_name = " older   NAME "
        self.response.save()
        other = VendorInvitation.objects.create(provider_name="Other")
        self.assertEqual(self.link(vendor=other).status_code, 409)
        self.assertEqual(self.post({"action": "create_from_submission", "response_id": self.response.pk}).status_code, 409)
        self.assertEqual(VendorQuestionnaireLink.objects.count(), 0)

    def test_add_from_submission_creates_vendor_and_link_together(self):
        result = self.post({"action": "create_from_submission", "response_id": self.response.pk})
        self.assertEqual(result.status_code, 201)
        vendor = VendorInvitation.objects.get(pk=json.loads(result.content)["vendor"]["id"])
        self.assertEqual(vendor.provider_name, self.response.provider_name)
        self.assertEqual(vendor.questionnaire_links.get().organization_name, self.response.provider_name)
        self.assertFalse(vendor.invitation_sent)
        self.assertEqual(vendor.contact_email, "", "Respondent email is not automatically a vendor contact")
        self.assertEqual(self.post({"action": "create_from_submission", "response_id": self.response.pk}).status_code, 409)
        self.assertEqual(VendorInvitation.objects.count(), 2)
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)

    def test_removing_link_or_vendor_keeps_submissions(self):
        self.link()
        result = self.post({"action": "unlink", "id": self.vendor.pk, "organization": self.response.provider_name})
        self.assertEqual(result.status_code, 200)
        self.assertFalse(self.vendor.questionnaire_links.exists())
        self.assertEqual(self.link().status_code, 200)
        self.assertEqual(self.post({"action": "delete", "id": self.vendor.pk}).status_code, 200)
        self.assertEqual(VendorQuestionnaireLink.objects.count(), 0)
        self.assertTrue(QuestionnaireResponse.objects.filter(pk=self.response.pk).exists())

    def test_invalid_requests_do_not_write_links(self):
        for payload in (
            {"action": []},
            {"action": "link", "id": True, "response_id": self.response.pk},
            {"action": "link", "id": self.vendor.pk, "response_id": False},
            {"action": "link", "id": self.vendor.pk, "response_id": self.response.pk, "provider": "Tampered"},
            {"action": "create_from_submission", "response_id": self.response.pk, "provider": "Tampered"},
            {"action": "unlink", "id": self.vendor.pk, "organization": []},
        ):
            self.assertEqual(self.post(payload).status_code, 400)
        self.assertEqual(self.post({"action": "link", "id": 999999, "response_id": self.response.pk}).status_code, 404)
        self.assertEqual(self.post({"action": "create_from_submission", "response_id": 999999}).status_code, 404)
        self.assertEqual(VendorQuestionnaireLink.objects.count(), 0)

    def test_linking_requires_superuser_and_csrf(self):
        client = Client(enforce_csrf_checks=True)
        url = reverse("questionnaire-analysis-vendors")
        payload = {"action": "link", "id": self.vendor.pk, "response_id": self.response.pk}
        user = get_user_model().objects.create_user(username="link-staff", is_staff=True)
        client.force_login(user)
        self.assertEqual(client.post(url, payload, content_type="application/json").status_code, 403)
        user.is_superuser = True
        user.save()
        self.assertEqual(client.post(url, payload, content_type="application/json").status_code, 403)
        page = client.get(reverse("questionnaire-analysis"))
        token = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', page.content.decode()).group(1)
        self.assertEqual(client.post(url, payload, content_type="application/json", HTTP_X_CSRFTOKEN=token).status_code, 200)
