from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0018_vendorinvitation')]

    operations = [
        migrations.AddField(
            model_name='vendorinvitation', name='submission_match_name',
            field=models.CharField(blank=True, help_text='Use this when the vendor submits under a different organization name.', max_length=200),
        ),
        migrations.AddField(
            model_name='vendorinvitation', name='invitation_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='vendorinvitation', name='reminder_sent',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='vendorinvitation', name='declined',
            field=models.BooleanField(default=False, help_text='Mark this only when the vendor explicitly declined.'),
        ),
        migrations.AlterModelOptions(
            name='vendorinvitation',
            options={'ordering': ['provider_name'], 'verbose_name': 'Vendor outreach', 'verbose_name_plural': 'Vendor outreach'},
        ),
    ]
