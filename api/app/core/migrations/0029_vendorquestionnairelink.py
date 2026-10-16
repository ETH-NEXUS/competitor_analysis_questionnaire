import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0028_update_vendor_names")]

    operations = [
        migrations.CreateModel(
            name="VendorQuestionnaireLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("organization_name", models.CharField(max_length=200)),
                ("normalized_name", models.CharField(max_length=200, unique=True)),
                ("vendor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questionnaire_links", to="core.vendorinvitation")),
            ],
        ),
    ]
