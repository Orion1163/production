# Generated manually for USIDCounter model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_modelpart_partproceduredetail'),
    ]

    operations = [
        migrations.CreateModel(
            name='USIDCounter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('part_no', models.CharField(db_index=True, help_text='Part number', max_length=100)),
                ('date', models.DateField(db_index=True, help_text='Date for which the counter is valid')),
                ('counter', models.IntegerField(default=0, help_text='Daily counter for this part (increments for each USID generated)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'USID Counter',
                'verbose_name_plural': 'USID Counters',
                'db_table': 'usid_counter',
                'ordering': ['-date', 'part_no'],
                'unique_together': {('part_no', 'date')},
            },
        ),
    ]

