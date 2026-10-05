from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0007_optional_solution_name")]

    operations = [
        migrations.AddField(
            model_name="questionnaireresponse",
            name="answer_data",
            field=models.JSONField(blank=True, default=dict, editable=False),
        ),
        migrations.CreateModel(
            name="OtherAnswerGrouping",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_id", models.CharField(max_length=100)),
                ("normalized_answer", models.CharField(max_length=2000)),
                ("group_label", models.CharField(max_length=200)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("question_id", "normalized_answer"), name="unique_other_answer_grouping"
                    )
                ]
            },
        ),
    ]
