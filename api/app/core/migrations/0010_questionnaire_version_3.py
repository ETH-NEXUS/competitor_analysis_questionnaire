from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0009_questionnaire_version_2")]

    operations = [
        migrations.AlterField(
            model_name="questionnaireresponse",
            name="questionnaire_version",
            field=models.PositiveSmallIntegerField(default=3, editable=False),
        ),
    ]
