from django.db import models

class User(models.Model):
    name = models.CharField(max_length=255)
    emp_id = models.IntegerField(unique=True)
    roles = models.JSONField(default=list)
    pin = models.IntegerField(max_length=4)

    def __str__(self):
        return self.name