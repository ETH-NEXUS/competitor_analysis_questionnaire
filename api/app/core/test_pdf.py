import json

from django.test import TestCase

from .models import QuestionnaireResponse


class QuestionnairePdfTests(TestCase):
    def test_pdf_export_contains_response_without_saving_it(self):
        payload = {
            "respondent": {
                "providerName": "Example Hospital Systems",
                "solutionName": "Clinical Suite",
                "respondentName": "A. Example",
                "respondentEmail": "example@example.com",
            },
            "scopes": [{"id": "A", "label": "Hospital-wide clinical information system"}],
            "sections": [
                {
                    "title": "1.1 Interoperability & Openness",
                    "questions": [
                        {
                            "id": "apiTypes",
                            "number": 2,
                            "question": "Which APIs are supported?",
                            "readableAnswer": ["FHIR APIs", "Other: Example integration"],
                        }
                    ],
                }
            ],
        }
        response = self.client.post(
            "/api/v1/questionnaire-pdf/", data=json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("application/pdf"))
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertGreater(len(response.content), 5000)
        self.assertIn("no-store", response["Cache-Control"])
        self.assertFalse(QuestionnaireResponse.objects.exists())

    def test_rejects_invalid_response(self):
        response = self.client.post(
            "/api/v1/questionnaire-pdf/",
            data=json.dumps({"sections": "invalid"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
