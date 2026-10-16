from importlib import import_module
from types import SimpleNamespace

from django.apps import apps
from django.db import connection
from django.test import TestCase
from django.utils import timezone

from .models import VendorInvitation


roster_migration = import_module("core.migrations.0028_update_vendor_names")


class VendorRosterMigrationTests(TestCase):
    def setUp(self):
        VendorInvitation.objects.all().delete()

    def migrate_roster(self):
        roster_migration.update_vendor_names(apps, SimpleNamespace(connection=connection))

    def test_renames_preserve_outreach_and_submission_matching(self):
        sent_at = timezone.now()
        for old_name in roster_migration.RENAMES:
            VendorInvitation.objects.create(
                provider_name=old_name, category="cis", invitation_sent=True,
                contact_email="contact@example.com", invitation_sent_by="Administrator",
                invitation_sent_at=sent_at, reminder_sent=True, declined=True, notes="Keep history",
            )
        original_ids = set(VendorInvitation.objects.values_list("pk", flat=True))
        self.migrate_roster()
        for old_name, new_name in roster_migration.RENAMES.items():
            vendor = VendorInvitation.objects.get(provider_name=new_name)
            self.assertIn(vendor.pk, original_ids)
            self.assertEqual(vendor.category, "cis")
            self.assertTrue(vendor.invitation_sent)
            self.assertEqual(vendor.contact_email, "contact@example.com")
            self.assertEqual(vendor.invitation_sent_by, "Administrator")
            self.assertEqual(vendor.invitation_sent_at, sent_at)
            self.assertTrue(vendor.reminder_sent)
            self.assertTrue(vendor.declined)
            self.assertEqual(vendor.notes, "Keep history")
            expected_alias = old_name if old_name.casefold() != new_name.casefold() else ""
            self.assertEqual(vendor.submission_match_name, expected_alias)

    def test_existing_custom_match_name_is_preserved(self):
        vendor = VendorInvitation.objects.create(
            provider_name="KISIM (CISTEC)", submission_match_name="Cistec response name",
        )
        self.migrate_roster()
        vendor.refresh_from_db()
        self.assertEqual(vendor.provider_name, "CISTEC")
        self.assertEqual(vendor.submission_match_name, "Cistec response name")

    def test_repeated_runs_and_existing_names_do_not_duplicate_or_merge(self):
        old = VendorInvitation.objects.create(provider_name="POLYPOINT", notes="Old history")
        new = VendorInvitation.objects.create(provider_name="Polypoint AG", notes="New history")
        swiss = VendorInvitation.objects.create(provider_name="Swiss Medlink", invitation_sent=True)
        esanita = VendorInvitation.objects.create(provider_name="ESANITA", notes="Already present")
        self.migrate_roster()
        self.migrate_roster()
        self.assertEqual(VendorInvitation.objects.count(), 4)
        for vendor in (old, new, swiss, esanita):
            saved = VendorInvitation.objects.get(pk=vendor.pk)
            self.assertEqual(saved.provider_name, vendor.provider_name)
            self.assertEqual(saved.notes, vendor.notes)
            self.assertEqual(saved.invitation_sent, vendor.invitation_sent)

    def test_new_vendor_is_added_without_removing_omitted_vendor(self):
        VendorInvitation.objects.create(provider_name="Swiss Medlink", notes="Keep this")
        self.migrate_roster()
        self.assertTrue(VendorInvitation.objects.filter(provider_name="Esanita").exists())
        self.assertTrue(VendorInvitation.objects.filter(provider_name="Swiss Medlink", notes="Keep this").exists())
