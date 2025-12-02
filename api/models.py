from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from .dynamic_models import ensure_dynamic_model_exists, get_dynamic_part_model


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


class ModelPart(models.Model):
    """
    Table 1: Model and Part information with media files.
    Stores model number, part number, and associated images/videos.
    """
    model_no = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Model number (e.g., EICS112)'
    )
    part_no = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Part number (e.g., EICS112_Part)'
    )
    form_image = models.ImageField(
        upload_to='procedure_images/',
        blank=True,
        null=True,
        help_text='Main form image for this model-part combination'
    )
    part_image = models.ImageField(
        upload_to='part_images/',
        blank=True,
        null=True,
        help_text='Part-specific image'
    )
    qc_video = models.FileField(
        upload_to='qc_videos/',
        blank=True,
        null=True,
        help_text='QC video file'
    )
    testing_video = models.FileField(
        upload_to='testing_videos/',
        blank=True,
        null=True,
        help_text='Testing video file'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['model_no', 'part_no']]
        ordering = ['-created_at']
        verbose_name = 'Model Part'
        verbose_name_plural = 'Model Parts'
    
    def __str__(self):
        return f"{self.model_no} - {self.part_no}"
    
    def get_dynamic_model(self):
        """
        Get the dynamic model class for this part.
        Returns None if the dynamic model hasn't been created yet.
        """
        from .dynamic_models import get_dynamic_part_model
        return get_dynamic_part_model(self.part_no)


class PartProcedureDetail(models.Model):
    """
    Table 2: Procedure form configuration details.
    Stores all procedure form fields, sub-procedures, and custom inputs in JSON format.
    """
    model_part = models.OneToOneField(
        ModelPart,
        on_delete=models.CASCADE,
        related_name='procedure_detail',
        help_text='Link to the ModelPart record'
    )
    procedure_config = models.JSONField(
        default=dict,
        help_text='Stores all procedure details including sections, custom fields, and checkboxes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Part Procedure Detail'
        verbose_name_plural = 'Part Procedure Details'
        db_table = 'part_procedure_detail'
    
    def __str__(self):
        return f"Procedure: {self.model_part.part_no}"
    
    def get_enabled_sections(self):
        """
        Extract enabled main sections from procedure_config.
        Returns a list of section names that are enabled (checked).
        """
        enabled = []
        sections = ['smd', 'leaded', 'prod_qc', 'qc', 'testing', 
                   'glueing', 'cleaning', 'spraying', 'dispatch']
        
        for section in sections:
            section_data = self.procedure_config.get(section, {})
            if section_data.get('enabled', False):
                enabled.append(section)
        
        return enabled
    
    def create_dynamic_model(self):
        """
        Create the dynamic model for this part based on enabled sections and procedure config.
        This is called automatically when the procedure detail is saved.
        """
        enabled_sections = self.get_enabled_sections()
        dynamic_model = ensure_dynamic_model_exists(
            self.model_part.part_no,
            enabled_sections,
            procedure_config=self.procedure_config
        )
        return dynamic_model


@receiver(post_save, sender=PartProcedureDetail)
def create_dynamic_model_on_save(sender, instance, created, **kwargs):
    """
    Signal handler to automatically create the dynamic model, database table, and register in admin
    when a PartProcedureDetail is saved.
    """
    part_name = instance.model_part.part_no
    
    # Create the dynamic model for this part
    dynamic_model = instance.create_dynamic_model()
    
    # Create the database table for this model
    if dynamic_model:
        try:
            from api.dynamic_model_utils import create_dynamic_table_in_db
            result = create_dynamic_table_in_db(dynamic_model)
            if result:
                import sys
                print("SUCCESS: Created table for %s" % part_name, file=sys.stderr)
            else:
                import sys
                print("WARNING: Table creation returned False for %s" % part_name, file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print("ERROR: Could not create table for %s: %s" % (part_name, str(e)), file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        
        # Register the model in Django admin
        # This MUST happen after table creation to ensure everything is ready
        try:
            from api.admin import register_dynamic_model_in_admin
            admin_result = register_dynamic_model_in_admin(dynamic_model, part_name)
            if admin_result:
                import sys
                admin_url = f"/admin/api/{dynamic_model._meta.db_table}/"
                print("=" * 80, file=sys.stderr)
                print("SUCCESS: Registered %s in admin" % part_name, file=sys.stderr)
                print("  Admin URL: %s" % admin_url, file=sys.stderr)
                print("  Table: %s" % dynamic_model._meta.db_table, file=sys.stderr)
                print("  Model Name: %s" % getattr(dynamic_model._meta, 'model_name', 'N/A'), file=sys.stderr)
                print("=" * 80, file=sys.stderr)
            else:
                import sys
                print("WARNING: Admin registration returned False for %s" % part_name, file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print("ERROR: Could not register %s in admin: %s" % (part_name, str(e)), file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)


class ProductionProcedure(models.Model):
    """
    Legacy model - kept for backward compatibility.
    Consider removing if not needed.
    """
    pass

    def __str__(self):
        return "Production Procedure"