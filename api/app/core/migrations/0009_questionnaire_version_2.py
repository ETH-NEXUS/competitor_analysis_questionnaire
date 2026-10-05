from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0008_other_answers")]

    operations = [
        migrations.AlterField(
            model_name="questionnaireresponse",
            name="questionnaire_version",
            field=models.PositiveSmallIntegerField(default=2, editable=False),
        ),
    ]
