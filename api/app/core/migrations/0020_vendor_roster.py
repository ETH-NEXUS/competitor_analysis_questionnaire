from django.db import migrations, models


VENDORS = {
    "cis": [
        "Avelios Medical",
        "CGM MEDICO / Clinical",
        "DPI+",
        "Epic",
        "GECO (EOC)",
        "inesKIS",
        "IQVia",
        "KISIM (CISTEC)",
        "M-KIS (Meierhofer)",
        "NEXUS",
        "Opale",
        "Oracle Health",
        "Dedalus (ORBIS)",
        "Soarian",
    ],
    "platform": [
        "Better",
        "BINT",
        "CHMedic",
        "Swiss Medlink",
    ],
    "patient": [
        "AD Suisse",
        "Compassana/Well",
        "docdok.health",
    ],
    "documentation": [
        "Voicepoint Xenon",
        "Heidi Health",
        "DocNote",
        "House of charts",
        "Teton",
    ],
    "specialty": [
        "Basys Data (PathoWin+)",
        "BD Cato",
        "ChemoCompile (MPS)",
        "Elekta MOSAIQ",
        "FENIX",
        "InVitro LIS",
        "Nuvyta Italy",
        "PEDeus AG",
        "POLYPOINT",
        "Tetjoevery",
        "Terranui",
        "Timerbee (Imilia)",
    ],
}


def add_vendor_roster(apps, schema_editor):
    VendorInvitation = apps.get_model("core", "VendorInvitation")
    for category, names in VENDORS.items():
        for name in names:
            existing = VendorInvitation.objects.filter(provider_name__iexact=name).first()
            if existing:
                if not existing.category:
                    existing.category = category
                    existing.save(update_fields=["category"])
                continue
            VendorInvitation.objects.create(provider_name=name, category=category)


class Migration(migrations.Migration):
    dependencies = [("core", "0019_vendor_outreach")]

    operations = [
        migrations.AddField(
            model_name="vendorinvitation",
            name="category",
            field=models.CharField(
                blank=True,
                choices=[
                    ("cis", "Hospital-wide CIS / EHR"),
                    ("platform", "Clinical data platform / interoperability"),
                    ("patient", "Patient-facing / patient engagement"),
                    ("documentation", "Clinical documentation / Ambient AI"),
                    ("specialty", "Specialty modules / software"),
                ],
                max_length=20,
            ),
        ),
        migrations.RunPython(add_vendor_roster, migrations.RunPython.noop),
    ]
