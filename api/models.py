from django.db import models

class User(models.Model):
    name = models.CharField(max_length=255)
    emp_id = models.IntegerField(unique=True)
    roles = models.JSONField(default=list)
    pin = models.IntegerField(max_length=4)

    def __str__(self):
        return self.name

class Admin(models.Model):
    emp_id = models.IntegerField(unique=True)
    pin = models.IntegerField(max_length=4)

    def __str__(self):
        return str(self.emp_id)

class ProductionProcedure(models.Model):
    

    def __str__(self):
        return self.model_no