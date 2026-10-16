from django.db import migrations


RENAMES = {
    "GECO (EOC)": "EOC(GECO)",
    "IQVia": "IQVIA",
    "KISIM (CISTEC)": "CISTEC",
    "M-KIS (Meierhofer)": "Meierhofer",
    "NEXUS": "nexus",
    "Dedalus (ORBIS)": "ORBIS",
    "POLYPOINT": "Polypoint AG",
    "Tetjoevery": "Tietoevry",
    "Timerbee (Imilia)": "Imilia",
}


def update_vendor_names(apps, schema_editor):
    vendors = apps.get_model("core", "VendorInvitation").objects.using(
        schema_editor.connection.alias
    )
    for old_name, new_name in RENAMES.items():
        vendor = vendors.filter(provider_name__iexact=old_name).first()
        if vendor is None:
            continue
        # Retain both records if an administrator already added the new name.
        # Neither record's contact details or invitation history can be discarded.
        if vendors.filter(provider_name__iexact=new_name).exclude(pk=vendor.pk).exists():
            continue
        fields = ["provider_name"]
        if not vendor.submission_match_name and old_name.casefold() != new_name.casefold():
            vendor.submission_match_name = old_name
            fields.append("submission_match_name")
        vendor.provider_name = new_name
        vendor.save(using=schema_editor.connection.alias, update_fields=fields)

    # The revised list includes Esanita. Keep Swiss Medlink and its history until
    # an administrator explicitly confirms that the entries should be combined.
    if not vendors.filter(provider_name__iexact="Esanita").exists():
        vendors.create(provider_name="Esanita")


class Migration(migrations.Migration):
    dependencies = [("core", "0027_questionnairedraft")]

    operations = [migrations.RunPython(update_vendor_names, migrations.RunPython.noop)]
