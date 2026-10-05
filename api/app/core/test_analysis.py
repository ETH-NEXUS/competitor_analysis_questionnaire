import csv
import io
import json
import re
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse

from .analysis import analysis, analysis_css, analysis_js, delete_submissions, export_csv, save_other_grouping, save_vendor_outreach
from .models import OtherAnswerGrouping, QuestionnaireResponse, VendorInvitation
from .serializers import QuestionnaireResponseSerializer


class AnalysisTests(TestCase):
    def setUp(self):
        VendorInvitation.objects.all().delete()
        self.factory = RequestFactory()
        self.row = QuestionnaireResponse.objects.create(
            provider_name="=Test Provider",
            respondent_email="test@example.com",
            data_interoperability=True,
            api_access="Broad access",
            api_types="REST\nOther: custom",
        )

    def request(self, path, *, superuser=True, authenticated=True):
        request = self.factory.get(path)
        request.user = SimpleNamespace(
            is_active=True, is_authenticated=True, is_superuser=superuser
        )
        if not authenticated:
            request.user = AnonymousUser()
        return request

    def test_both_routes_require_superuser(self):
        for view in (analysis, analysis_css, analysis_js, export_csv, save_other_grouping, save_vendor_outreach, delete_submissions):
            self.assertEqual(
                view(self.request("/admin/analysis/", authenticated=False)).status_code, 302
            )
            with self.assertRaises(PermissionDenied):
                view(self.request("/admin/analysis/", superuser=False))

    def test_page_contains_data_and_is_not_cached(self):
        response = analysis(self.request("/admin/analysis/"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "analysis-data")
        self.assertContains(response, "/admin/analysis/style.css")
        self.assertContains(response, "/admin/analysis/app.js")
        self.assertIn("no-store", response["Cache-Control"])

    def test_revised_questionnaire_is_reflected_in_analysis(self):
        response = analysis(self.request("/admin/analysis/"))
        payload = json.loads(
            re.search(
                r'<script id="analysis-data" type="application/json">(.*?)</script>',
                response.content.decode(),
            ).group(1)
        )
        questions = {item["id"]: item for item in payload["questions"]}
        self.assertEqual(payload["current_version"], 11)
        self.assertNotIn("externalIntegration", questions)
        self.assertNotIn("clinicalDataManagement", questions)
        self.assertEqual(questions["migration"]["kind"], "multi")
        self.assertEqual(len(questions["apiAccess"]["options"]), 5)
        self.assertEqual(questions["apiAccess"]["options"][-2], "No documented, standardized interfaces/APIs are available")
        self.assertNotIn("Voice dictation", questions["documentationMethods"]["options"])
        self.assertIn("Automatic reuse/pre-population of information entered elsewhere in the CIS", questions["documentationMethods"]["options"])

    def test_multiple_migration_approaches_are_saved(self):
        serializer = QuestionnaireResponseSerializer(data={
            "submission_id": "962bc6b6-adbc-4fb6-bac3-0732457166b7",
            "respondent_email": "migration@example.com",
            "provider_name": "Migration Provider",
            "solution_name": "Clinical System",
            "hospital_wide_cis": True,
            "answers": {"migration": {
                "question": "How is migration from an existing system / legacy solution typically handled?",
                "selected": ["0", "3"], "text": "", "details": {}, "rows": {},
                "readable_answer": ["Vendor-led migration project using standard tools plus hospital-specific mapping", "Only selected historical data is normally migrated; remaining data stays in an archive / legacy viewer"],
            }},
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.questionnaire_version, 11)
        self.assertEqual(saved.answer_data["migration"]["selected"], ["0", "3"])

    def test_fhir_releases_and_multiple_testing_events_are_stored_structurally(self):
        base = {"question": "Testing", "selected": [], "text": "", "details": {}, "rows": {}, "readable_answer": []}
        serializer = QuestionnaireResponseSerializer(data={
            "submission_id": "c2e89939-e81d-44d0-bf9e-ea77d6469ba5",
            "respondent_email": "testing@example.com",
            "provider_name": "Testing Vendor",
            "solution_name": "Interoperability Platform",
            "data_interoperability": True,
            "answers": {
                "standards": {**base, "selected": ["0"], "followups": {"0": ["R4", "R4B", "Other"]}, "details": {"fhir_other": "Custom release"}, "readable_answer": ["HL7 FHIR", "Primary FHIR release used in production: R4, R4B, Other: Custom release"]},
                "interoperabilityTesting": {**base, "selected": ["0"], "testing_events": [
                    {"event": "Digital Health Projectathon", "year": "2024", "profiles": "CH Core", "outcome": "Successful"},
                    {"event": "IHE Connectathon", "year": "2025", "profiles": "XDS", "outcome": "Partially successful"},
                ], "readable_answer": ["Yes – please specify", "Projectathon 2024", "Connectathon 2025"]},
            },
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        response = serializer.save()
        self.assertEqual(response.answer_data["standards"]["followups"]["0"], ["R4", "R4B", "Other"])
        self.assertEqual(len(response.answer_data["interoperabilityTesting"]["testing_events"]), 2)
        self.assertIn("Connectathon 2025", response.interoperability_testing)

    def test_incomplete_testing_event_is_rejected(self):
        serializer = QuestionnaireResponseSerializer(data={
            "submission_id": "2cc3e076-1d12-4753-b142-3fae5743e4cb",
            "respondent_email": "testing@example.com",
            "provider_name": "Testing Vendor",
            "solution_name": "Interoperability Platform",
            "data_interoperability": True,
            "answers": {"interoperabilityTesting": {
                "question": "Testing", "selected": ["0"], "text": "", "details": {},
                "rows": {}, "readable_answer": ["Yes"], "testing_events": [
                    {"event": "IHE Connectathon", "year": "2025", "outcome": ""},
                ],
            }},
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("answers", serializer.errors)

    def test_patient_administration_is_not_a_new_submission_category(self):
        serializer = QuestionnaireResponseSerializer(data={
            "submission_id": "370b5c9a-9c4c-4b31-9c4f-c580424e472a",
            "respondent_email": "legacy@example.com",
            "provider_name": "Legacy Vendor",
            "solution_name": "Administration System",
            "patient_administration": True,
            "answers": {"apiAccess": {
                "question": "API access", "selected": ["0"], "text": "", "details": {}, "rows": {},
                "readable_answer": ["Broad access"],
            }},
        })
        self.assertFalse(serializer.is_valid())

    def test_invitation_roster_is_available_to_superusers_and_analysis(self):
        VendorInvitation.objects.create(provider_name="Declined Vendor", declined=True)
        response = analysis(self.request("/admin/analysis/"))
        payload = json.loads(
            re.search(
                r'<script id="analysis-data" type="application/json">(.*?)</script>',
                response.content.decode(),
            ).group(1)
        )
        self.assertEqual(
            payload["invitations"], [{"id": VendorInvitation.objects.get().pk, "provider": "Declined Vendor", "category": "", "match_name": "", "invitation_sent": False, "reminder_sent": False, "declined": True, "notes": ""}]
        )
        self.assertContains(response, "Presentation figures")
        user = get_user_model().objects.create_superuser(
            username="invitation-admin", email="invitation-admin@example.com", password=None
        )
        client = Client()
        client.force_login(user)
        self.assertContains(
            client.get(reverse("admin:core_vendorinvitation_changelist")), "Declined Vendor"
        )
        staff = get_user_model().objects.create_user(
            username="invitation-staff", email="staff@example.com", password=None, is_staff=True
        )
        client.force_login(staff)
        self.assertEqual(
            client.get(reverse("admin:core_vendorinvitation_changelist")).status_code, 403
        )

    def test_vendor_outreach_can_be_created_and_updated_without_changing_submissions(self):
        def post(payload):
            request = self.factory.post(
                "/admin/analysis/vendors/", data=json.dumps(payload), content_type="application/json"
            )
            request.user = self.request("/admin/analysis/").user
            return save_vendor_outreach(request)

        created = post({"action": "create", "provider": " Example Health ", "category": "cis", "match_name": "Example AG"})
        self.assertEqual(created.status_code, 201)
        vendor = json.loads(created.content)["vendor"]
        self.assertEqual(vendor["provider"], "Example Health")
        self.assertEqual(vendor["category"], "cis")
        self.assertFalse(vendor["invitation_sent"])
        updated = post({"action": "update", "id": vendor["id"], "invitation_sent": True, "reminder_sent": True})
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(json.loads(updated.content)["vendor"]["reminder_sent"])
        self.assertEqual(post({"action": "create", "provider": "example ag"}).status_code, 400)
        self.assertEqual(post({"action": "create", "provider": "Another", "category": "invalid"}).status_code, 400)
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)
        self.assertEqual(QuestionnaireResponse.objects.get().provider_name, "=Test Provider")

        page = analysis(self.request("/admin/analysis/"))
        self.assertContains(page, "Vendor outreach")
        self.assertContains(page, "/admin/analysis/vendors/")

        self.assertEqual(post({"action": "delete", "id": vendor["id"], "provider": "No"}).status_code, 400)
        deleted = post({"action": "delete", "id": vendor["id"]})
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(json.loads(deleted.content)["deleted_id"], vendor["id"])
        self.assertFalse(VendorInvitation.objects.filter(pk=vendor["id"]).exists())
        self.assertEqual(post({"action": "delete", "id": vendor["id"]}).status_code, 404)
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)

    def test_dashboard_assets_load_without_static_file_routing(self):
        css = analysis_css(self.request("/admin/analysis/style.css"))
        js = analysis_js(self.request("/admin/analysis/app.js"))
        self.assertEqual(css.status_code, 200)
        self.assertEqual(js.status_code, 200)
        self.assertTrue(css["Content-Type"].startswith("text/css"))
        self.assertTrue(js["Content-Type"].startswith("text/javascript"))
        self.assertIn(b".pie-layout", css.content)
        self.assertIn(b"function addPie", js.content)

    def test_csv_preserves_multiline_answers_and_escapes_formulas(self):
        response = export_csv(self.request("/admin/analysis/export.csv"))
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][0], "'=Test Provider")
        api_types_column = next(i for i, heading in enumerate(rows[0]) if "API types" in heading)
        self.assertEqual(rows[1][api_types_column], "REST\nOther: custom")
        self.assertEqual(rows[1][api_types_column + 1], "Not asked")
        self.assertIn("no-store", response["Cache-Control"])

    def test_csv_filters(self):
        for query in ("?provider=Missing", "?scope=A"):
            response = export_csv(self.request("/admin/analysis/export.csv" + query))
            self.assertEqual(
                len(list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))), 1
            )
        response = export_csv(self.request("/admin/analysis/export.csv?scope=D"))
        self.assertEqual(
            len(list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))), 2
        )

    def test_analysis_and_csv_only_include_current_form(self):
        older = QuestionnaireResponse.objects.create(
            provider_name="Older Test Provider",
            respondent_email="old@example.com",
            questionnaire_version=2,
            data_interoperability=True,
            api_access="Earlier answer",
        )
        page = analysis(self.request("/admin/analysis/"))
        self.assertContains(page, older.provider_name)
        payload = json.loads(re.search(r'<script id="analysis-data" type="application/json">(.*?)</script>', page.content.decode()).group(1))
        self.assertNotIn(older.pk, [row["id"] for row in payload["responses"]])
        self.assertIn(older.pk, [row["id"] for row in payload["submissions"]])
        self.assertNotContains(page, "Earlier version.")
        response = export_csv(self.request("/admin/analysis/export.csv"))
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 2)
        self.assertNotIn("Earlier version.", ",".join(rows[0]))

    def test_admin_can_delete_selected_submissions_after_confirmation(self):
        older = QuestionnaireResponse.objects.create(
            provider_name="Older Test Provider",
            respondent_email="old@example.com",
            questionnaire_version=2,
            data_interoperability=True,
            api_access="Earlier answer",
        )
        user = get_user_model().objects.create_superuser(
            username="analysis-admin", email="admin@example.com", password=None
        )
        client = Client()
        client.force_login(user)
        url = reverse("admin:core_questionnaireresponse_changelist")
        changelist = client.get(url)
        self.assertContains(changelist, "delete_selected")
        self.assertContains(changelist, older.provider_name)
        self.assertContains(changelist, "_selected_action")
        self.assertContains(changelist, "Form version")
        self.assertNotContains(changelist, "Clinical data structure")
        selected = {"action": "delete_selected", "_selected_action": [str(older.pk)]}
        confirmation = client.post(url, selected)
        self.assertContains(confirmation, "Are you sure")
        self.assertTrue(QuestionnaireResponse.objects.filter(pk=older.pk).exists())
        deleted = client.post(url, {**selected, "post": "yes"})
        self.assertEqual(deleted.status_code, 302)
        self.assertFalse(QuestionnaireResponse.objects.filter(pk=older.pk).exists())
        self.assertTrue(QuestionnaireResponse.objects.filter(pk=self.row.pk).exists())

    def test_analysis_deletes_only_selected_submissions_after_confirmation(self):
        older = QuestionnaireResponse.objects.create(
            provider_name="Older Test Provider", respondent_email="old@example.com", questionnaire_version=2
        )
        user = get_user_model().objects.create_superuser(
            username="analysis-delete-admin", email="delete@example.com", password=None
        )
        client = Client(enforce_csrf_checks=True)
        client.force_login(user)
        url = reverse("questionnaire-analysis-delete")
        payload = json.dumps({"ids": [older.pk]})
        self.assertEqual(client.post(url, payload, content_type="application/json").status_code, 403)
        page = client.get(reverse("questionnaire-analysis"))
        token = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', page.content.decode()).group(1)
        self.assertContains(page, "Delete selected")
        self.assertTrue(QuestionnaireResponse.objects.filter(pk=older.pk).exists())
        deleted = client.post(
            url, payload, content_type="application/json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(deleted.json()["deleted_count"], 1)
        self.assertFalse(QuestionnaireResponse.objects.filter(pk=older.pk).exists())
        self.assertTrue(QuestionnaireResponse.objects.filter(pk=self.row.pk).exists())

    def test_analysis_delete_rejects_invalid_or_missing_ids(self):
        user = get_user_model().objects.create_superuser(
            username="analysis-invalid-admin", email="invalid@example.com", password=None
        )
        client = Client()
        client.force_login(user)
        url = reverse("questionnaire-analysis-delete")
        for ids in ([], [True], [self.row.pk, self.row.pk], [self.row.pk, 999999]):
            response = client.post(url, json.dumps({"ids": ids}), content_type="application/json")
            self.assertIn(response.status_code, (400, 409))
            self.assertTrue(QuestionnaireResponse.objects.filter(pk=self.row.pk).exists())

    def test_latest_provider_mode_uses_filtered_scope_and_exports_one_response(self):
        QuestionnaireResponse.objects.create(
            provider_name=" =Test   Provider ",
            respondent_email="newer@example.com",
            data_interoperability=True,
            api_access="No documented APIs are available",
        )
        response = export_csv(self.request("/admin/analysis/export.csv?scope=D&mode=latest_provider"))
        rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][0], "' =Test   Provider ")
        self.assertIn("No documented APIs", rows[1][6])

    def test_separate_other_items_are_saved_as_structured_data(self):
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "d12aa708-1463-4e87-ac86-78943b7b97e4",
                "respondent_email": "another@example.com",
                "provider_name": "Other Provider",
                "solution_name": "Test Solution",
                "data_interoperability": True,
                "answers": {
                    "apiTypes": {
                        "question": "API types",
                        "selected": ["3"],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "other_items": ["SOAP API", "GraphQL API"],
                        "readable_answer": [
                            "Other documented APIs: SOAP API",
                            "Other documented APIs: GraphQL API",
                        ],
                    }
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.answer_data["apiTypes"]["other_items"], ["SOAP API", "GraphQL API"])
        self.assertEqual(
            saved.api_types, "Other documented APIs: SOAP API\nOther documented APIs: GraphQL API"
        )

    def test_solution_name_is_required_and_new_category_answers_are_saved(self):
        data = {
            "submission_id": "8c95bd3e-7356-4b15-ae9c-029e629cdf25",
            "respondent_email": "new@example.com",
            "provider_name": "New Provider",
            "data_interoperability": True,
            "patient_facing": True,
            "answers": {
                "dataExchangeHandling": {
                    "question": "How does the solution handle data exchanged between connected systems?",
                    "selected": ["1", "2"],
                    "text": "",
                    "details": {},
                    "rows": {},
                    "readable_answer": ["Transformation / mapping", "Temporary storage / queueing"],
                },
                "patientExchange": {
                    "question": "How is information exchanged between the patient-facing solution and connected clinical systems?",
                    "selected": ["0", "4"],
                    "text": "",
                    "details": {},
                    "rows": {},
                    "readable_answer": [
                        "Real-time bidirectional structured exchange",
                        "Depends on the connected clinical system",
                    ],
                },
            },
        }
        invalid = QuestionnaireResponseSerializer(data=data)
        self.assertFalse(invalid.is_valid())
        self.assertIn("solution_name", invalid.errors)
        valid = QuestionnaireResponseSerializer(data={**data, "solution_name": "Exchange Hub"})
        self.assertTrue(valid.is_valid(), valid.errors)
        saved = valid.save()
        self.assertEqual(saved.questionnaire_version, 11)
        self.assertEqual(saved.solution_name, "Exchange Hub")
        self.assertEqual(saved.data_exchange_handling, "Transformation / mapping\nTemporary storage / queueing")
        self.assertEqual(
            saved.patient_exchange,
            "Real-time bidirectional structured exchange\nDepends on the connected clinical system",
        )
        csv_response = export_csv(self.request("/admin/analysis/export.csv"))
        csv_rows = list(csv.reader(io.StringIO(csv_response.content.decode("utf-8-sig"))))
        self.assertTrue(any("Exchanged data handling" in heading for heading in csv_rows[0]))
        self.assertTrue(any("Patient solution data exchange" in heading for heading in csv_rows[0]))

    def test_cost_charging_basis_is_preserved_for_analysis(self):
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "eb88f3a2-7d70-4339-966a-d648a1772bca",
                "respondent_email": "costs@example.com",
                "provider_name": "Cost Provider",
                "solution_name": "Test Solution",
                "data_interoperability": True,
                "answers": {
                    "costs": {
                        "question": "Which costs are charged separately?",
                        "selected": [],
                        "text": "",
                        "details": {},
                        "rows": {"2": {"cost": "1", "billing_unit": "per interface"}},
                        "readable_answer": [
                            "Interfaces / integrations: One-time additional cost; Charged per: per interface"
                        ],
                    }
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.answer_data["costs"]["rows"]["2"]["billing_unit"], "per interface")
        self.assertIn("Charged per: per interface", saved.cost_components)

    def test_revised_questions_save_without_overwriting_earlier_answers(self):
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "8e36cd3e-e5b8-4020-965b-c251df5e21f1",
                "respondent_email": "revised@example.com",
                "provider_name": "Revised Provider",
                "solution_name": "Test Solution",
                "data_interoperability": True,
                "answers": {
                    "clinicalDataManagement": {
                        "question": "Does this solution itself store or manage clinical information?",
                        "selected": ["0"],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "other_items": [],
                        "readable_answer": ["Yes"],
                    },
                    "structure": {
                        "question": "Earlier structured data question",
                        "selected": [],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "other_items": [],
                        "readable_answer": ["Earlier answer"],
                    },
                    "structuredTypes": {
                        "question": "For which types of clinical information is structured representation routinely used?",
                        "selected": ["0", "1"],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "other_items": [],
                        "readable_answer": ["Diagnoses", "Medications"],
                    }
                },
            },
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.clinical_data_management, "Yes")
        self.assertEqual(saved.structured_information_types, "Diagnoses\nMedications")
        self.assertEqual(saved.data_structure, "Earlier answer")
        self.assertEqual(saved.questionnaire_version, 11)

    def test_new_interoperability_and_certification_answers_are_saved(self):
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "709df90c-c8af-4470-92dc-b2f485553c16",
                "respondent_email": "certs@example.com",
                "provider_name": "Certified Provider",
                "solution_name": "Test Solution",
                "data_interoperability": True,
                "answers": {
                    "interoperabilityTesting": {
                        "question": "Swiss interoperability testing",
                        "selected": ["0"], "text": "", "details": {"0": "Projectathon 2026"},
                        "rows": {}, "readable_answer": ["Yes – please specify: Projectathon 2026"],
                    },
                    "certifications": {
                        "question": "Certifications",
                        "selected": ["0", "5"], "text": "ISO/IEC 27001, hosting operations, valid until 2028",
                        "details": {}, "rows": {},
                        "readable_answer": [
                            "ISO/IEC 27001",
                            "Other healthcare-specific certification/conformity assessment",
                            "Optional: Please specify certificate/assessment name, scope and validity. ISO/IEC 27001, hosting operations, valid until 2028",
                        ],
                    },
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.questionnaire_version, 11)
        self.assertEqual(saved.interoperability_testing, "Yes – please specify: Projectathon 2026")
        self.assertIn("ISO/IEC 27001", saved.certifications)
        self.assertIn("valid until 2028", saved.certification_details)

    def test_multiple_products_are_saved_for_one_functional_area(self):
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "aa73d987-d2cd-41c5-a115-31636dd7ef89",
                "respondent_email": "modules@example.com",
                "provider_name": "Modules Provider",
                "solution_name": "Test Solution",
                "hospital_wide_cis": True,
                "answers": {
                    "clinicalCapabilities": {
                        "question": "Clinical functional areas",
                        "selected": [],
                        "text": "",
                        "details": {},
                        "rows": {"0": {"provided": "yes"}},
                        "other_items": [],
                        "products": {
                            "0": [
                                {
                                    "name": "Product A",
                                    "description": "First module",
                                    "source": "0",
                                    "standalone": True,
                                },
                                {
                                    "name": "Product B",
                                    "description": "Second module",
                                    "source": "1",
                                    "standalone": False,
                                },
                            ]
                        },
                        "readable_answer": [
                            "Clinical documentation: Yes; Product / module name: Product A",
                            "Clinical documentation: Yes; Product / module name: Product B",
                        ],
                    }
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(len(saved.answer_data["clinicalCapabilities"]["products"]["0"]), 2)
        self.assertIn(
            "Product A\nClinical documentation: Yes; Product / module name: Product B",
            saved.clinical_capabilities,
        )

    def test_core_coverage_and_partner_integration_are_saved_as_distinct_entries(self):
        core = {
            "kind": "core",
            "name": "Hospital CIS",
            "description": "",
            "source": "native",
            "developer": "",
            "functions": ["Clinical documentation"],
            "specialties": [],
            "other_functions": [],
            "other_specialties": [],
            "all_specialties": True,
            "standalone": False,
        }
        integration = {
            "kind": "integration",
            "name": "ChemoPlan",
            "description": "Chemotherapy planning",
            "source": "partner",
            "developer": "Oncology Startup",
            "functions": ["Medication management"],
            "specialties": ["Oncology"],
            "other_functions": ["Chemotherapy planning"],
            "other_specialties": [],
            "all_specialties": False,
            "standalone": False,
            "workflow": {
                "reused_data": ["patient", "lab"],
                "write_back": "automatic",
                "separate_app": "sso",
                "patient_context": "automatic",
                "manual_steps": "None",
            },
        }
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "65c30ba0-62e0-48ea-a14d-158c275819da",
                "respondent_email": "cis@example.com",
                "provider_name": "CIS Provider",
                "solution_name": "Test Solution",
                "hospital_wide_cis": True,
                "answers": {
                    "clinicalCapabilities": {
                        "question": "Clinical products and modules",
                        "selected": [],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "other_items": [],
                        "products": {},
                        "offerings": [core, integration],
                        "readable_answer": [
                            "Core CIS platform: Hospital CIS",
                            "External integration: ChemoPlan",
                        ],
                    }
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.questionnaire_version, 11)
        self.assertEqual(
            saved.answer_data["clinicalCapabilities"]["offerings"][1]["developer"],
            "Oncology Startup",
        )
        self.assertEqual(
            saved.answer_data["clinicalCapabilities"]["offerings"][1]["workflow"]["write_back"],
            "automatic",
        )
        self.assertEqual(
            saved.clinical_capabilities,
            "Core CIS platform: Hospital CIS\nExternal integration: ChemoPlan",
        )

    def test_function_workflow_details_are_preserved(self):
        function = {
            "kind": "function",
            "name": "ChemoPlan",
            "description": "Chemotherapy planning",
            "source": "native",
            "developer": "",
            "functions": ["Medication management"],
            "specialties": ["Oncology"],
            "other_functions": [],
            "other_specialties": [],
            "all_specialties": False,
            "standalone": True,
            "workflow": {
                "reused_data": ["patient", "medication", "lab"],
                "write_back": "automatic",
                "separate_app": "sso",
                "patient_context": "automatic",
                "manual_steps": "None",
            },
        }
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "65c30ba0-62e0-48ea-a14d-158c275819db",
                "respondent_email": "startup@example.com",
                "provider_name": "Startup",
                "solution_name": "Test Solution",
                "specialized_clinical": True,
                "answers": {
                    "clinicalCapabilities": {
                        "question": "Clinical functions",
                        "selected": [],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "offerings": [function],
                        "readable_answer": ["Specialized function: ChemoPlan"],
                    }
                },
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(
            saved.answer_data["clinicalCapabilities"]["offerings"][0]["workflow"],
            function["workflow"],
        )

    def test_product_names_can_be_grouped_for_analysis(self):
        request = self.factory.post(
            "/admin/analysis/group/",
            data=json.dumps(
                {
                    "question_id": "clinicalProduct",
                    "answer": "Oncology Startup — ChemoPlan",
                    "group": "Oncology Startup — ChemoPlan",
                }
            ),
            content_type="application/json",
        )
        request.user = self.request("/admin/analysis/").user
        self.assertEqual(save_other_grouping(request).status_code, 200)
        self.assertEqual(
            OtherAnswerGrouping.objects.get(question_id="clinicalProduct").normalized_answer,
            "oncology startup — chemoplan",
        )

    def test_function_and_specialty_tags_can_be_grouped(self):
        for question_id, answer, group in (
            ("clinicalFunction", "Chemo planning", "Chemotherapy"),
            ("clinicalSpecialty", "Onco", "Oncology"),
        ):
            request = self.factory.post(
                "/admin/analysis/group/",
                data=json.dumps({"question_id": question_id, "answer": answer, "group": group}),
                content_type="application/json",
            )
            request.user = self.request("/admin/analysis/").user
            self.assertEqual(save_other_grouping(request).status_code, 200)
            self.assertEqual(
                OtherAnswerGrouping.objects.get(question_id=question_id).group_label,
                group,
            )

    def test_single_choice_rejects_multiple_other_items(self):
        serializer = QuestionnaireResponseSerializer(
            data={
                "submission_id": "f965480b-8f45-4097-a64d-0c918d43f29c",
                "respondent_email": "other@example.com",
                "provider_name": "Other Provider",
                "solution_name": "Test Solution",
                "data_interoperability": True,
                "answers": {
                    "apiAccess": {
                        "question": "API access",
                        "selected": ["4"],
                        "text": "",
                        "details": {},
                        "rows": {},
                        "other_items": ["One", "Two"],
                        "readable_answer": ["Other: One", "Other: Two"],
                    }
                },
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("accepts only one Other answer", str(serializer.errors))

    def test_superuser_can_group_and_ungroup_other_wording(self):
        def post(group):
            request = self.factory.post(
                "/admin/analysis/group/",
                data=json.dumps(
                    {"question_id": "apiTypes", "answer": "  SOAP   API ", "group": group}
                ),
                content_type="application/json",
            )
            request.user = self.request("/admin/analysis/").user
            return save_other_grouping(request)

        self.assertEqual(post("Web services").status_code, 200)
        grouping = OtherAnswerGrouping.objects.get(question_id="apiTypes")
        self.assertEqual(grouping.normalized_answer, "soap api")
        self.assertEqual(grouping.group_label, "Web services")
        page = analysis(self.request("/admin/analysis/"))
        self.assertContains(page, "Web services")
        self.assertEqual(post("").status_code, 200)
        self.assertFalse(OtherAnswerGrouping.objects.exists())

    def test_grouping_endpoint_accepts_admin_csrf_token(self):
        user = get_user_model().objects.create_superuser(
            username="analyst", email="analyst@example.com"
        )
        client = Client(enforce_csrf_checks=True)
        client.force_login(user)
        page = client.get("/admin/analysis/")
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, "csrfmiddlewaretoken")
        token = (
            re.search(rb'name="csrfmiddlewaretoken" value="([^"]+)"', page.content)
            .group(1)
            .decode()
        )
        response = client.post(
            "/admin/analysis/group/",
            data=json.dumps(
                {"question_id": "apiTypes", "answer": "SOAP API", "group": "Web services"}
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            OtherAnswerGrouping.objects.get(question_id="apiTypes").group_label, "Web services"
        )
