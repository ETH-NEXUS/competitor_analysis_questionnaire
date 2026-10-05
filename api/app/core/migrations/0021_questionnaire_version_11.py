from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0020_vendor_roster")]

    operations = [
        migrations.AlterField(
            model_name="questionnaireresponse",
            name="questionnaire_version",
            field=models.PositiveSmallIntegerField(default=11, editable=False),
        ),
    ]
