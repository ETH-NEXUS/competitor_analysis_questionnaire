from copy import deepcopy

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from .pdf_corrections import apply_corrections, corrected_answer
from .pdf_import import IMPORT_SCHEMA, SCHEMA, recover_selections


class PdfCorrectionTests(SimpleTestCase):
    def test_multiple_corrections_add_missing_answers_and_leave_others_unchanged(self):
        original = {"apiTypes": {"selected": ["0"], "readable_answer": ["Original"]}}
        payload = {"answers": deepcopy(original)}
        apply_corrections(
            payload,
            {
                "deployment": {"selected": ["0", "5"], "other_items": ["Managed private cloud"]},
                "apiAccess": {"selected": ["2"], "details": {"2": "Selected use cases"}},
                "exportDetails": {"text": "Some historical documents require conversion."},
            },
            IMPORT_SCHEMA,
        )
        self.assertEqual(payload["answers"]["apiTypes"], original["apiTypes"])
        self.assertEqual(payload["answers"]["deployment"]["selected"], ["0", "5"])
        self.assertIn(
            "Other: Managed private cloud", payload["answers"]["deployment"]["readable_answer"]
        )
        self.assertEqual(
            payload["answers"]["exportDetails"]["readable_answer"],
            ["Some historical documents require conversion."],
        )

    def test_cost_classification_and_billing_unit_are_both_preserved(self):
        answer = corrected_answer(
            "costs",
            {"rows": {"0": {"cost": "1", "billing_unit": "project"}, "1": {"cost": "0"}}},
            IMPORT_SCHEMA,
        )
        self.assertIn(
            "Initial implementation: One-time additional; Charged per: project",
            answer["readable_answer"],
        )
        self.assertIn("Data migration: Included", answer["readable_answer"])
        recovered = recover_selections("costs", answer["readable_answer"])
        self.assertEqual(recovered["rows"]["0"], answer["rows"]["0"])

    def test_certification_and_testing_followups_remain_structured(self):
        certificate = {"name": "Vendor certificate", "scopes": ["solution"], "valid_until": "2027"}
        answer = corrected_answer(
            "certifications",
            {"selected": ["2"], "certification_details": {"2": certificate}},
            IMPORT_SCHEMA,
        )
        self.assertIn(
            "ISO 13485: Vendor certificate; Scope: Solution or product; Valid until: 2027",
            answer["readable_answer"],
        )
        self.assertEqual(
            recover_selections("certifications", answer["readable_answer"])[
                "certification_details"
            ]["2"]["name"],
            "Vendor certificate",
        )
        event = {
            "event": "Digital Health Projectathon",
            "year": "2025",
            "profiles": "FHIR",
            "outcome": "Successful",
        }
        answer = corrected_answer(
            "interoperabilityTesting", {"selected": ["0"], "testing_events": [event]}, IMPORT_SCHEMA
        )
        self.assertIn("Year: 2025", answer["readable_answer"][1])
        self.assertEqual(
            recover_selections("interoperabilityTesting", answer["readable_answer"])[
                "testing_events"
            ][0]["profiles"],
            "FHIR",
        )

    def test_implementation_requirements_and_standards_keep_special_followups(self):
        answer = corrected_answer(
            "requirements",
            {
                "selected": ["1"],
                "followups": {"1": ["0", "9"]},
                "details": {"requirements_other": "Additional mapping"},
            },
            IMPORT_SCHEMA,
        )
        self.assertIn(
            "What is typically required: Integration with CIS/HIS, Other: Additional mapping",
            answer["readable_answer"],
        )
        self.assertEqual(
            recover_selections("requirements", answer["readable_answer"])["followups"],
            {"1": ["0", "9"]},
        )
        answer = corrected_answer(
            "standards", {"selected": ["0"], "followups": {"0": ["R4"]}}, IMPORT_SCHEMA
        )
        self.assertEqual(
            answer["readable_answer"], ["HL7 FHIR", "Primary FHIR release used in production: R4"]
        )

    def test_clinical_products_remain_available_to_product_comparison(self):
        offering = {
            "kind": "integration",
            "name": "Lab Link",
            "description": "Lab exchange",
            "source": "partner",
            "developer": "Lab Vendor",
            "functions": ["Laboratory"],
            "specialties": [],
            "other_functions": [],
            "other_specialties": [],
            "all_specialties": True,
            "standalone": False,
            "purposes": ["Laboratory / LIS"],
            "workflow": {
                "reused_data": ["patient", "lab"],
                "write_back": "automatic",
                "separate_app": "sso",
                "patient_context": "automatic",
                "manual_steps": "Review",
            },
        }
        answer = corrected_answer("clinicalCapabilities", {"offerings": [offering]}, IMPORT_SCHEMA)
        self.assertEqual(answer["offerings"][0]["developer"], "Lab Vendor")
        self.assertIn("Connected CIS write-back: Automatically", answer["readable_answer"][0])
        recovered = recover_selections("clinicalCapabilities", answer["readable_answer"])
        self.assertEqual(recovered["offerings"][0]["name"], "Lab Link")
        self.assertEqual(recovered["offerings"][0]["workflow"]["reused_data"], ["patient", "lab"])

    def test_legacy_capabilities_and_questions_can_be_corrected(self):
        product = {
            "name": "Emergency Module",
            "description": "Triage",
            "source": "0",
            "standalone": True,
        }
        answer = corrected_answer(
            "specialties",
            {"rows": {"0": {"provided": "yes"}}, "products": {"0": [product]}},
            IMPORT_SCHEMA,
        )
        self.assertIn(
            "Emergency: Yes; Product / module name: Emergency Module", answer["readable_answer"][0]
        )
        self.assertEqual(
            recover_selections("specialties", answer["readable_answer"])["products"]["0"][0],
            product,
        )
        answer = corrected_answer(
            "externalIntegration", {"text": "Legacy answer correction"}, IMPORT_SCHEMA
        )
        self.assertEqual(answer["readable_answer"], ["Legacy answer correction"])

    def test_invalid_questions_or_choices_do_not_partially_change_payload(self):
        original = {"answers": {"apiTypes": {"selected": ["0"]}}}
        for overrides in (
            {"unknown": {"text": "Bad"}},
            {"deployment": {"selected": ["0"]}, "apiAccess": {"selected": ["0", "1"]}},
            {"costs": {"rows": {"0": {"cost": "99"}}}},
            {"standards": {"selected": ["0"], "followups": {"0": ["invalid"]}}},
        ):
            payload = deepcopy(original)
            with (
                self.subTest(overrides=overrides),
                self.assertRaises((ValueError, ValidationError)),
            ):
                apply_corrections(payload, overrides, IMPORT_SCHEMA)
            self.assertEqual(payload, original)

    def test_all_current_question_kinds_accept_an_empty_answer(self):
        for key in SCHEMA:
            with self.subTest(question=key):
                answer = corrected_answer(key, {}, IMPORT_SCHEMA)
                self.assertEqual(answer["question"], SCHEMA[key]["label"])
