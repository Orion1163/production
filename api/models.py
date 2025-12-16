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
        sections = [
            'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
            'leaded_qc', 'prod_qc', 'qc', 'qc_images', 'testing',
            'heat_run', 'glueing', 'cleaning', 'spraying', 'dispatch'
        ]
        
        for section in sections:
            section_data = self.procedure_config.get(section, {})
            if section_data.get('enabled', False):
                enabled.append(section)
        
        return enabled
    
    def create_dynamic_model(self):
        """
        Create the dynamic models for this part based on enabled sections and procedure config.
        This is called automatically when the procedure detail is saved.
        Returns both in_process and completion models.
        """
        enabled_sections = self.get_enabled_sections()
        models_dict = ensure_dynamic_model_exists(
            self.model_part.part_no,
            enabled_sections,
            procedure_config=self.procedure_config
        )
        return models_dict


@receiver(post_save, sender=PartProcedureDetail)
def create_dynamic_model_on_save(sender, instance, created, **kwargs):
    """
    Signal handler to automatically create the dynamic models, database tables, and register in admin
    when a PartProcedureDetail is saved.
    Creates two models: in_process and completion.
    """
    part_name = instance.model_part.part_no
    
    # Create the dynamic models for this part (returns dict with both models)
    models_dict = instance.create_dynamic_model()
    
    # Create database tables for both models
    from api.dynamic_model_utils import create_dynamic_table_in_db
    from api.admin import register_dynamic_model_in_admin, register_all_dynamic_models_in_admin
    from django.contrib import admin
    
    # Process in_process model first
    if models_dict.get('in_process'):
        in_process_model = models_dict['in_process']
        try:
            result = create_dynamic_table_in_db(in_process_model)
            if result:
                import sys
                print("SUCCESS: Created in_process table for %s" % part_name, file=sys.stderr)
                # Register in admin
                register_dynamic_model_in_admin(in_process_model, f"{part_name}_in_process")
            else:
                import sys
                print("WARNING: In-process table creation returned False for %s" % part_name, file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print("ERROR: Could not create in_process table for %s: %s" % (part_name, str(e)), file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Process completion model (depends on in_process)
    if models_dict.get('completion'):
        completion_model = models_dict['completion']
        try:
            result = create_dynamic_table_in_db(completion_model)
            if result:
                import sys
                print("SUCCESS: Created completion table for %s" % part_name, file=sys.stderr)
                # Register in admin
                register_dynamic_model_in_admin(completion_model, f"{part_name}_completion")
            else:
                import sys
                print("WARNING: Completion table creation returned False for %s" % part_name, file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print("ERROR: Could not create completion table for %s: %s" % (part_name, str(e)), file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Run full registration to ensure all models are properly registered
    try:
        import sys
        print("=" * 80, file=sys.stderr)
        print("Running full dynamic model registration...", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        
        register_all_dynamic_models_in_admin()
        
        # Clear admin's app_dict cache to force rebuild
        if hasattr(admin.site, '_app_dict'):
            delattr(admin.site, '_app_dict')
        
        import sys
        print("=" * 80, file=sys.stderr)
        print("SUCCESS: Full registration completed for all dynamic models", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
    except Exception as e:
        import sys
        import traceback
        print("WARNING: Full registration had errors (this is usually okay): %s" % str(e), file=sys.stderr)
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)


class ProductionProcedure(models.Model):
    """
    Legacy model - kept for backward compatibility.
    Consider removing if not needed.
    """
    pass

    def __str__(self):
        return "Production Procedure"