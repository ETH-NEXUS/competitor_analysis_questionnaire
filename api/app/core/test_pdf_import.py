from io import BytesIO
import json
from types import SimpleNamespace
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, RequestFactory, TestCase
from pypdf import PdfReader, PdfWriter

from .analysis import save_vendor_outreach
from .models import QuestionnaireResponse, VendorInvitation
from .pdf_import import SCHEMA, SCOPE_LABELS, import_pdf, imported_pdf
from .questionnaire_pdf import make_pdf


class PdfImportTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = SimpleNamespace(is_active=True, is_authenticated=True, is_superuser=True)
        self.payload = {
            "version": 14,
            "respondent": {
                "providerName": "Example Health",
                "solutionName": "Example Suite",
                "respondentName": "A. Example",
                "respondentEmail": "contact@example.com",
            },
            "scopes": [{"id": "C", "label": SCOPE_LABELS["C"]}],
            "sections": [
                {
                    "title": "1.1 Interoperability & Openness",
                    "questions": [
                        {
                            "id": "apiTypes",
                            "number": 2,
                            "question": SCHEMA["apiTypes"]["label"],
                            "answer": {"selected": ["0"], "details": {}, "text": "", "rows": {}},
                            "readableAnswer": [SCHEMA["apiTypes"]["options"][0]],
                        },
                        {
                            "id": "standards",
                            "number": 3,
                            "question": SCHEMA["standards"]["label"],
                            "answer": {"selected": [], "details": {}, "text": "", "rows": {}},
                            "readableAnswer": [],
                        },
                    ],
                }
            ],
        }

    def upload(self, content, action="preview", **values):
        request = self.factory.post(
            "/admin/analysis/import-pdf/",
            {
                "pdf": SimpleUploadedFile("response.pdf", content, content_type="application/pdf"),
                "action": action,
                **values,
            },
        )
        request.user = self.user
        return import_pdf(request)

    def save(self, content):
        return self.upload(content, "import", scopes=["C"], **self.payload["respondent"])

    def test_preview_then_import_preserves_answers_and_original_pdf(self):
        content = make_pdf(self.payload)
        preview = self.upload(content)
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertFalse(QuestionnaireResponse.objects.exists())
        self.assertEqual(
            json.loads(preview.content)["preview"]["answers"]["apiTypes"]["selected"], ["0"]
        )
        saved = self.save(content)
        self.assertEqual(saved.status_code, 201, saved.content)
        row = QuestionnaireResponse.objects.get()
        self.assertEqual(row.api_types, SCHEMA["apiTypes"]["options"][0])
        self.assertEqual(row.interoperability_standards, "")
        self.assertIsNone(row.api_access)
        self.assertEqual(bytes(row.imported_pdf), content)
        self.assertEqual(self.save(content).status_code, 409)
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)
        request = self.factory.get("/pdf/")
        request.user = self.user
        self.assertEqual(imported_pdf(request, row.pk).content, content)

    def test_older_pdf_without_attachment_recovers_text_and_unanswered_questions(self):
        writer = PdfWriter()
        for page in PdfReader(BytesIO(make_pdf(self.payload))).pages:
            writer.add_page(page)
        stream = BytesIO()
        writer.write(stream)
        result = self.upload(stream.getvalue())
        self.assertEqual(result.status_code, 200, result.content)
        preview = json.loads(result.content)["preview"]
        self.assertEqual(preview["respondent"], self.payload["respondent"])
        self.assertEqual(preview["scopes"], ["C"])
        self.assertEqual(preview["answers"]["apiTypes"]["selected"], ["0"])
        self.assertEqual(preview["answers"]["standards"]["readable_answer"], [])
        self.assertTrue(preview["warnings"])
        saved = self.save(stream.getvalue())
        self.assertEqual(saved.status_code, 201, saved.content)

    def test_submitted_response_pdf_is_not_imported_again(self):
        row = QuestionnaireResponse.objects.create(
            provider_name="Example Health",
            solution_name="Example Suite",
            respondent_email="contact@example.com",
        )
        self.payload["responseReference"] = row.pk
        response = self.save(make_pdf(self.payload))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)

    def test_legacy_product_fields_are_recovered_for_product_analysis(self):
        self.payload["sections"][0]["questions"] = [
            {
                "id": "clinicalCapabilities",
                "number": 25,
                "question": SCHEMA["clinicalCapabilities"]["label"],
                "readableAnswer": [
                    "Core CIS platform: Clinical Suite; Developed by your company; Areas: Clinical documentation, Across specialties",
                    "External integration: LabLink; Third-party company: Lab Vendor; What it does: Laboratory exchange; Type/purpose: Laboratory / LIS; Areas: Laboratory; Connected CIS data reused: Patient details, Laboratory results; Connected CIS write-back: Automatically; Separate application: Yes, with single sign-on; Patient context: Automatically transferred; Manual workflow steps: Not answered",
                ],
            }
        ]
        writer = PdfWriter()
        for page in PdfReader(BytesIO(make_pdf(self.payload))).pages:
            writer.add_page(page)
        stream = BytesIO()
        writer.write(stream)
        result = self.upload(stream.getvalue())
        self.assertEqual(result.status_code, 200, result.content)
        offerings = json.loads(result.content)["preview"]["answers"]["clinicalCapabilities"][
            "offerings"
        ]
        self.assertEqual(offerings[0]["name"], "Clinical Suite")
        self.assertEqual(offerings[0]["functions"], ["Clinical documentation"])
        self.assertTrue(offerings[0]["all_specialties"])
        self.assertEqual(offerings[1]["developer"], "Lab Vendor")
        self.assertEqual(offerings[1]["source"], "partner")
        self.assertEqual(offerings[1]["workflow"]["reused_data"], ["patient", "lab"])
        self.assertEqual(offerings[1]["workflow"]["write_back"], "automatic")
        self.assertEqual(self.save(stream.getvalue()).status_code, 201)

    def test_invalid_pdf_and_invalid_identity_do_not_create_rows(self):
        self.assertEqual(self.upload(b"not a PDF").status_code, 400)
        self.assertEqual(self.upload(b"%PDF-broken").status_code, 400)
        self.payload["respondent"]["respondentEmail"] = "invalid"
        content = make_pdf(self.payload)
        self.assertEqual(self.upload(content).status_code, 200)
        self.assertEqual(self.save(content).status_code, 400)
        self.assertFalse(QuestionnaireResponse.objects.exists())

    def test_import_requires_superuser_and_csrf(self):
        request = self.factory.post("/admin/analysis/import-pdf/")
        request.user = SimpleNamespace(is_active=True, is_authenticated=True, is_superuser=False)
        with self.assertRaises(PermissionDenied):
            import_pdf(request)
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.get("/admin/analysis/submissions/1/pdf/").status_code, 302)
        user = get_user_model().objects.create_user(username="pdf-staff", is_staff=True)
        client.force_login(user)
        self.assertEqual(client.get("/admin/analysis/submissions/1/pdf/").status_code, 403)
        self.assertEqual(
            client.post("/admin/analysis/import-pdf/", {"action": "preview"}).status_code, 403
        )

    def test_legacy_pdf_recovers_wrapped_answers_across_pages_and_sections(self):
        questions = []
        for index, key in enumerate(
            (
                "apiAccess",
                "apiTypes",
                "standards",
                "deployment",
                "interoperabilityTesting",
                "dataRetention",
                "security",
                "certifications",
                "roadmap",
                "configuration",
                "transition",
                "rights",
                "pricing",
                "costs",
                "term",
                "exitCosts",
            ),
            1,
        ):
            definition = SCHEMA[key]
            questions.append(
                {
                    "id": key,
                    "number": index,
                    "question": definition["label"],
                    "readableAnswer": [definition["options"][0]] if index % 2 else [],
                }
            )
        questions[0]["readableAnswer"] = [
            SCHEMA["apiAccess"]["options"][0],
            "A long description " * 50,
        ]
        self.payload["sections"] = [
            {"title": "1.1 Interoperability & Openness", "questions": questions[:5]},
            {"title": "1.2 Solution capabilities", "questions": questions[5:]},
        ]
        reader = PdfReader(BytesIO(make_pdf(self.payload)))
        self.assertGreater(len(reader.pages), 1)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        stream = BytesIO()
        writer.write(stream)
        result = self.upload(stream.getvalue())
        self.assertEqual(result.status_code, 200, result.content)
        answers = json.loads(result.content)["preview"]["answers"]
        self.assertEqual(len(answers), len(questions))
        for question in questions:
            expected = [" ".join(line.split()) for line in question["readableAnswer"]]
            self.assertEqual(answers[question["id"]]["readable_answer"], expected)


class InvitationAndSubmissionTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def vendor(self, payload):
        request = self.factory.post(
            "/admin/analysis/vendors/", json.dumps(payload), content_type="application/json"
        )
        request.user = SimpleNamespace(is_active=True, is_authenticated=True, is_superuser=True)
        return save_vendor_outreach(request)

    def test_sender_required_and_timestamp_preserved_when_other_details_change(self):
        row = VendorInvitation.objects.create(provider_name="Invitation test")
        self.assertEqual(
            self.vendor({"action": "update", "id": row.pk, "invitation_sent": True}).status_code,
            400,
        )
        response = self.vendor(
            {
                "action": "update",
                "id": row.pk,
                "invitation_sent": True,
                "invitation_sent_by": "Alex",
                "contact_email": "vendor@example.com",
            }
        )
        self.assertEqual(response.status_code, 200, response.content)
        row.refresh_from_db()
        sent_at = row.invitation_sent_at
        self.assertIsNotNone(sent_at)
        self.assertEqual(row.invitation_sent_by, "Alex")
        self.assertEqual(
            self.vendor({"action": "update", "id": row.pk, "reminder_sent": True}).status_code, 200
        )
        row.refresh_from_db()
        self.assertEqual(row.invitation_sent_at, sent_at)
        self.assertEqual(
            self.vendor({"action": "update", "id": row.pk, "contact_email": "invalid"}).status_code,
            400,
        )
        self.assertEqual(
            self.vendor(
                {"action": "update", "id": row.pk, "invitation_sent_at": "bad"}
            ).status_code,
            400,
        )

    def test_public_submit_accepts_incomplete_followups_and_remains_idempotent(self):
        base = {
            "question": "Question",
            "selected": [],
            "text": "",
            "details": {},
            "rows": {},
            "readable_answer": [],
        }
        payload = {
            "submission_id": str(uuid4()),
            "provider_name": "Partial Vendor",
            "solution_name": "Suite",
            "respondent_email": "vendor@example.com",
            "data_interoperability": True,
            "answers": {
                "standards": {**base, "selected": ["0"], "readable_answer": ["HL7 FHIR"]},
                "requirements": {**base, "selected": ["1"]},
                "certifications": {**base, "selected": ["0"]},
                "apiAccess": base,
            },
        }
        for _ in range(2):
            response = self.client.post(
                "/api/v1/questionnaire-responses/",
                json.dumps(payload),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)
        self.assertEqual(QuestionnaireResponse.objects.get().api_access, "")
