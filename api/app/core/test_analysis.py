import csv
import io
from types import SimpleNamespace

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.test import RequestFactory, TestCase

from .analysis import analysis, analysis_css, analysis_js, export_csv
from .models import QuestionnaireResponse


class AnalysisTests(TestCase):
    def setUp(self):
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
        for view in (analysis, analysis_css, analysis_js, export_csv):
            self.assertEqual(
                view(self.request("/admin/analysis/", authenticated=False)).status_code, 302
            )
            with self.assertRaises(PermissionDenied):
                view(self.request("/admin/analysis/", superuser=False))

    def test_page_contains_data_and_is_not_cached(self):
        response = analysis(self.request("/admin/analysis/"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "analysis-data")
        self.assertContains(response, '/admin/analysis/style.css')
        self.assertContains(response, '/admin/analysis/app.js')
        self.assertIn("no-store", response["Cache-Control"])

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
        self.assertEqual(rows[1][7], "REST\nOther: custom")
        self.assertEqual(rows[1][8], "Not asked")
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
