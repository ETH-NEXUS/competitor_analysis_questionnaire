from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0010_questionnaire_version_3")]

    operations = [
        migrations.AlterField(
            model_name="questionnaireresponse",
            name="questionnaire_version",
            field=models.PositiveSmallIntegerField(default=4, editable=False),
        ),
    ]
