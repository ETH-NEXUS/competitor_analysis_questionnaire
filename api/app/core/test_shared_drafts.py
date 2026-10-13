from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
import json
from threading import Barrier

from django.db import close_old_connections
from django.test import Client, TestCase, TransactionTestCase
from django.utils import timezone

from .models import QuestionnaireDraft, QuestionnaireResponse
from .shared_drafts import MAX_DRAFT_BYTES, token_hash


ROOT = "/api/v1/questionnaire-drafts/"


def draft_data():
    return {
        "version": 14,
        "scopes": ["C"],
        "identity": {
            "respondentName": "",
            "respondentEmail": "colleague@example.com",
            "providerName": "Example Health",
            "solutionName": "Example Suite",
        },
        "answers": {"apiAccess": {"selected": [], "text": "", "details": {}, "rows": {}}},
    }


def response_data():
    return {
        "respondent_email": "colleague@example.com",
        "provider_name": "Example Health",
        "solution_name": "Example Suite",
        "data_interoperability": True,
        "answers": {
            "apiAccess": {
                "question": "API access",
                "selected": [],
                "text": "",
                "details": {},
                "rows": {},
                "readable_answer": [],
            }
        },
    }


class SharedDraftTests(TestCase):
    def setUp(self):
        self.data = draft_data()
        self.created = self.post("", {"data": self.data}).json()
        self.token = self.created["token"]

    def post(self, path, body, *, token="", method="post"):
        return getattr(self.client, method)(
            ROOT + path,
            json.dumps(body),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}" if token else "",
        )

    def test_private_draft_does_not_create_a_submission_or_expose_token(self):
        self.assertFalse(QuestionnaireResponse.objects.exists())
        row = QuestionnaireDraft.objects.get()
        self.assertEqual(row.token_hash, token_hash(self.token))
        self.assertNotEqual(row.token_hash, self.token)
        self.assertEqual(len(self.token), 43)
        self.assertEqual(self.client.get(ROOT).status_code, 405)
        self.assertEqual(self.client.get(ROOT + "current/").status_code, 404)
        self.assertEqual(
            self.client.get(ROOT + "current/", HTTP_AUTHORIZATION="Bearer wrong").status_code, 404
        )
        read = self.client.get(ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.assertEqual(read.status_code, 200)
        self.assertEqual(read.json()["data"], self.data)
        self.assertNotIn("token", read.json())
        self.assertIn("no-store", read["Cache-Control"])

    def test_drafts_accept_empty_identity_and_half_typed_followups(self):
        data = draft_data()
        data["identity"] = dict.fromkeys(data["identity"], "")
        data["scopes"] = []
        data["answers"]["apiAccess"]["other_items"] = [""]
        data["answers"]["certifications"] = {
            "selected": ["0"],
            "text": "",
            "details": {},
            "rows": {},
            "certification_details": {"0": {"scopes": [], "valid_until": "20"}},
        }
        self.assertEqual(self.post("", {"data": data}).status_code, 201)

    def test_second_browser_can_save_and_stale_browser_cannot_overwrite(self):
        colleague = Client()
        data = deepcopy(self.data)
        data["answers"]["apiAccess"]["text"] = "Filled in by my colleague"
        updated = colleague.patch(
            ROOT + "current/",
            json.dumps({"revision": 1, "data": data}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(updated.status_code, 200)
        stale = self.post(
            "current/", {"revision": 1, "data": self.data}, token=self.token, method="patch"
        )
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()["draft"]["revision"], 2)
        self.assertEqual(QuestionnaireDraft.objects.get().data, data)
        stale_submit = self.post(
            "current/submit/",
            {"revision": 1, "data": self.data, "response": response_data()},
            token=self.token,
        )
        self.assertEqual(stale_submit.status_code, 409)
        self.assertFalse(QuestionnaireResponse.objects.exists())

    def test_submit_is_idempotent_and_shared_copy_is_read_only(self):
        body = {"revision": 1, "data": self.data, "response": response_data()}
        first = self.post("current/submit/", body, token=self.token)
        self.assertEqual(first.status_code, 201, first.content)
        again = self.post("current/submit/", body, token=self.token)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(first.json()["response_id"], again.json()["response_id"])
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)
        read = self.client.get(ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {self.token}").json()
        self.assertTrue(read["submitted"])
        self.assertEqual(read["data"], self.data)
        self.assertEqual(
            self.post(
                "current/", {"revision": 2, "data": self.data}, token=self.token, method="patch"
            ).status_code,
            409,
        )
        self.assertEqual(
            self.post("current/rotate/", {"revision": 2}, token=self.token).status_code, 409
        )
        QuestionnaireResponse.objects.get().delete()
        self.assertTrue(
            self.client.get(ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {self.token}").json()[
                "submitted"
            ]
        )

    def test_rotating_invalidates_old_link_and_preserves_answers(self):
        result = self.post("current/rotate/", {"revision": 1}, token=self.token)
        self.assertEqual(result.status_code, 200)
        replacement = result.json()["token"]
        self.assertNotEqual(replacement, self.token)
        self.assertEqual(
            self.client.get(
                ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {self.token}"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {replacement}").json()[
                "data"
            ],
            self.data,
        )
        QuestionnaireDraft.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(
            self.client.get(
                ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {replacement}"
            ).status_code,
            404,
        )
        self.assertEqual(self.post("current/submit/", {}, token=replacement).status_code, 404)

    def test_client_can_recover_a_replacement_link_after_an_interrupted_response(self):
        candidate = "r" * 43
        replaced = self.post(
            "current/rotate/", {"revision": 1, "new_token": candidate}, token=self.token
        )
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.json()["token"], candidate)
        self.assertEqual(
            self.client.get(ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {candidate}").json()[
                "data"
            ],
            self.data,
        )
        self.assertEqual(
            self.client.get(
                ROOT + "current/", HTTP_AUTHORIZATION=f"Bearer {self.token}"
            ).status_code,
            404,
        )

    def test_invalid_payloads_and_mismatched_submission_do_not_modify_data(self):
        for invalid in (
            None,
            [],
            {**self.data, "version": 1},
            {**self.data, "scopes": ["X"]},
            {**self.data, "answers": {"unknown": {}}},
        ):
            self.assertEqual(self.post("", {"data": invalid}).status_code, 400)
        self.assertEqual(
            self.client.post(ROOT, "broken", content_type="application/json").status_code, 400
        )
        self.assertEqual(
            self.client.post(
                ROOT, "x" * (MAX_DRAFT_BYTES + 1), content_type="application/json"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.post(
                "current/", {"revision": True, "data": self.data}, token=self.token, method="patch"
            ).status_code,
            400,
        )
        wrong = {**response_data(), "provider_name": "Another company"}
        self.assertEqual(
            self.post(
                "current/submit/",
                {"revision": 1, "data": self.data, "response": wrong},
                token=self.token,
            ).status_code,
            400,
        )
        self.assertFalse(QuestionnaireResponse.objects.exists())
        self.assertEqual(QuestionnaireDraft.objects.get().revision, 1)

    def test_malformed_nested_answers_are_rejected_without_creating_broken_links(self):
        for field, value in (
            ("offerings", [None]),
            ("details", {"0": None}),
            ("rows", {"0": []}),
            ("other_items", [None]),
            ("testing_events", [None]),
            ("certification_details", {"0": {"scopes": None}}),
        ):
            data = draft_data()
            data["answers"]["apiAccess"][field] = value
            self.assertEqual(self.post("", {"data": data}).status_code, 400)
        self.assertEqual(QuestionnaireDraft.objects.count(), 1)

    def test_csrf_required_for_anonymous_draft_writes(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(
            client.post(
                ROOT, json.dumps({"data": self.data}), content_type="application/json"
            ).status_code,
            403,
        )

        token = client.get("/api/v1/auth/csrf/").json()["csrfToken"]
        self.assertEqual(
            client.post(
                ROOT,
                json.dumps({"data": self.data}),
                content_type="application/json",
                HTTP_X_CSRFTOKEN=token,
            ).status_code,
            201,
        )
        self.assertEqual(
            client.patch(
                ROOT + "current/",
                json.dumps({"revision": 1, "data": self.data}),
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.token}",
            ).status_code,
            403,
        )


class ConcurrentSharedDraftTests(TransactionTestCase):
    def test_two_simultaneous_submissions_create_only_one_response(self):
        client = Client()
        data = draft_data()
        token = client.post(
            ROOT, json.dumps({"data": data}), content_type="application/json"
        ).json()["token"]
        barrier = Barrier(2)

        def submit():
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return (
                    Client()
                    .post(
                        ROOT + "current/submit/",
                        json.dumps({"revision": 1, "data": data, "response": response_data()}),
                        content_type="application/json",
                        HTTP_AUTHORIZATION=f"Bearer {token}",
                    )
                    .status_code
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: submit(), range(2)))
        self.assertEqual(sorted(results), [200, 201])
        self.assertEqual(QuestionnaireResponse.objects.count(), 1)
