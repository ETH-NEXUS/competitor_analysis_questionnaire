from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0023_alter_questionnaireresponse_questionnaire_version"),
    ]

    operations = [
        migrations.AlterField(
            model_name="questionnaireresponse",
            name="questionnaire_version",
            field=models.PositiveSmallIntegerField(default=14, editable=False),
        ),
    ]
