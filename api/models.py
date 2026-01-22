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
    ROLE_CHOICES = [
        (1, 'Super Admin'),
        (2, 'Admin'),
    ]
    
    emp_id = models.IntegerField(unique=True)
    pin = models.IntegerField(max_length=4)
    role = models.IntegerField(choices=ROLE_CHOICES, default=1)

    def __str__(self):
        return str(self.emp_id)
    
    def get_role_name(self):
        """Get the role name based on role value."""
        if self.role == 1:
            return 'superadmin'
        elif self.role == 2:
            return 'admin'
        return 'unknown'
    
    def get_role_display_name(self):
        """Get the display name for the role."""
        return dict(self.ROLE_CHOICES).get(self.role, 'Unknown')

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
            'leaded', 'leaded_qc', 'prod_qc', 'qc', 'qc_images', 'programming', 'testing',
            'heat_run', 'cleaning', 'glueing', 'spraying', 'dispatch'
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
        Always recreates models to ensure table structure matches current config.
        """
        enabled_sections = self.get_enabled_sections()
        # Always pass procedure_config to ensure models are recreated with latest structure
        models_dict = ensure_dynamic_model_exists(
            self.model_part.part_no,
            enabled_sections,
            procedure_config=self.procedure_config  # Always pass config to force recreation
        )
        return models_dict


@receiver(post_save, sender=PartProcedureDetail)
def create_dynamic_model_on_save(sender, instance, created, **kwargs):
    """
    Signal handler to automatically create the dynamic models, database tables, and register in admin
    when a PartProcedureDetail is saved.
    Creates two models: in_process and completion.
    Also updates existing entries when new fields are added (for updates, not creates).
    """
    part_name = instance.model_part.part_no
    from api.dynamic_models import DynamicModelRegistry
    
    # For updates, we need to force recreation of models if config changed
    # Unregister existing models from admin and clean up to ensure fresh recreation
    if not created and DynamicModelRegistry.exists(part_name):
        # Get existing models before unregistering
        existing_models = DynamicModelRegistry.get_both(part_name)
        
        # Unregister old models from admin FIRST
        try:
            from django.contrib import admin
            from api.dynamic_models import sanitize_part_name
            
            # Find and unregister old models from admin
            models_to_unregister = []
            for model_class in list(admin.site._registry.keys()):
                if hasattr(model_class, '_meta'):
                    table_name = model_class._meta.db_table
                    # Check if this model belongs to this part
                    if part_name.lower() in table_name.lower() or table_name.lower().startswith(part_name.lower().replace('_', '')):
                        models_to_unregister.append(model_class)
            
            for model_class in models_to_unregister:
                try:
                    admin.site.unregister(model_class)
                    import sys
                    print(f"Unregistered old model {model_class.__name__} from admin", file=sys.stderr)
                except Exception as e:
                    import sys
                    print(f"Warning: Could not unregister {model_class.__name__}: {e}", file=sys.stderr)
            
            # Clear admin caches
            if hasattr(admin.site, '_app_dict'):
                delattr(admin.site, '_app_dict')
            if hasattr(admin.site, '_registry'):
                # Force rebuild on next request
                pass
        except Exception as e:
            import sys
            import traceback
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        
        # Unregister from DynamicModelRegistry
        DynamicModelRegistry.unregister(part_name)
        
        # Also clean up from api.models module
        try:
            from api import models as api_models
            from api.dynamic_models import sanitize_part_name
            class_base = sanitize_part_name(part_name)
            in_process_class = f"{class_base}InProcess"
            completion_class = f"{class_base}Completion"
            
            if hasattr(api_models, in_process_class):
                delattr(api_models, in_process_class)
            if hasattr(api_models, completion_class):
                delattr(api_models, completion_class)
        except Exception as e:
            import sys
            import traceback
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Create the dynamic models for this part (returns dict with both models)
    # This will recreate models with the new procedure_config
    models_dict = instance.create_dynamic_model()
    
    # Create database tables for both models
    from api.dynamic_model_utils import create_dynamic_table_in_db
    from api.admin import register_dynamic_model_in_admin, register_all_dynamic_models_in_admin
    from django.contrib import admin
    from api.dynamic_models import DynamicModelRegistry
    
    # Process in_process model first
    if models_dict.get('in_process'):
        in_process_model = models_dict['in_process']
        try:
            import sys
            print(f"Updating table structure for {part_name}_in_process...", file=sys.stderr)
            # This will create the table if it doesn't exist, or add missing columns if it does
            result = create_dynamic_table_in_db(in_process_model)
            if result:
                print(f"Successfully updated table structure for {part_name}_in_process", file=sys.stderr)
                # Register in admin
                register_dynamic_model_in_admin(in_process_model, f"{part_name}_in_process")
                
                # If this is an update (not create), update existing entries with defaults for new fields
                if not created:
                    print(f"Updating existing entries with defaults for {part_name}_in_process...", file=sys.stderr)
                    _update_existing_entries_with_defaults(in_process_model, part_name, 'in_process')
            else:
                # Log warning if table creation/update failed
                print(f"Warning: Failed to create/update table for {part_name}_in_process", file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print(f"Error creating/updating table for {part_name}_in_process: {e}", file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Process completion model (depends on in_process)
    if models_dict.get('completion'):
        completion_model = models_dict['completion']
        try:
            import sys
            print(f"Updating table structure for {part_name}_completion...", file=sys.stderr)
            # This will create the table if it doesn't exist, or add missing columns if it does
            result = create_dynamic_table_in_db(completion_model)
            if result:
                print(f"Successfully updated table structure for {part_name}_completion", file=sys.stderr)
                # Register in admin
                register_dynamic_model_in_admin(completion_model, f"{part_name}_completion")
                
                # If this is an update (not create), update existing entries with defaults for new fields
                if not created:
                    print(f"Updating existing entries with defaults for {part_name}_completion...", file=sys.stderr)
                    _update_existing_entries_with_defaults(completion_model, part_name, 'completion')
            else:
                # Log warning if table creation/update failed
                import sys
                print(f"Warning: Failed to create/update table for {part_name}_completion", file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print(f"Error creating/updating table for {part_name}_completion: {e}", file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Run full registration to ensure all models are properly registered
    try:
        register_all_dynamic_models_in_admin()
        
        # Aggressively clear all admin caches to force rebuild
        if hasattr(admin.site, '_app_dict'):
            delattr(admin.site, '_app_dict')
        
        # Clear URL pattern cache - this is critical for admin to see new models
        if hasattr(admin.site, '_urls'):
            delattr(admin.site, '_urls')
        
        # Clear any lazy-loaded URL patterns
        if hasattr(admin.site, 'urls'):
            # Force rebuild of URLs on next access
            if hasattr(admin.site.urls, 'url_patterns'):
                # Clear the cached URL patterns
                pass
        
        # Clear any other caches that might prevent admin from seeing new models
        if hasattr(admin.site, '_registry'):
            # Force admin to rebuild its internal structures
            pass
        
        # Also clear Django's app registry cache if needed
        from django.apps import apps as django_apps
        if hasattr(django_apps, 'all_models'):
            # The models should already be in all_models from create_dynamic_part_model
            # But we can force a refresh if needed
            pass
        
        # Force Django to rebuild admin URLs by accessing the urls property
        # This will trigger URL pattern regeneration
        try:
            _ = admin.site.urls  # Access to trigger lazy evaluation
        except:
            pass
        
        import sys
        print(f"Completed admin registration for {part_name}. Admin caches cleared.", file=sys.stderr)
    except Exception as e:
        import sys
        import traceback
        print(f"Error in final admin registration for {part_name}: {e}", file=sys.stderr)
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)


def _update_existing_entries_with_defaults(model_class, part_name, table_type):
    """
    Update existing entries in a dynamic table with default values for newly added fields.
    Sets True for BooleanField (checkboxes) and empty string for CharField (text inputs).
    """
    try:
        from django.db import connection
        from django.db import models
        
        # Get table name
        table_name = model_class._meta.db_table
        
        # Get existing columns in the database
        with connection.cursor() as cursor:
            cursor.execute(f"PRAGMA table_info({table_name})")
            existing_columns = {row[1] for row in cursor.fetchall()}
        
        # Get all model fields
        all_model_fields = {}
        for field in model_class._meta.get_fields():
            if field.one_to_many or field.many_to_many:
                continue
            if isinstance(field, models.ForeignKey):
                column_name = field.column
            else:
                column_name = field.name
            
            # Check if this is a newly added field (exists in model but might have default)
            # We'll update all BooleanField and CharField that don't have values set
            if column_name in existing_columns:
                all_model_fields[column_name] = field
        
        # Get all entries
        all_entries = model_class.objects.all()
        
        # Check which fields have NULL values (newly added fields)
        # and build update dict only for those
        update_dict = {}
        
        # Sample a few entries to see which fields are NULL
        sample_entries = all_entries[:5] if all_entries.exists() else []
        
        if sample_entries:
            # Check which fields are NULL across sample entries
            null_fields = set()
            for entry in sample_entries:
                for column_name, field in all_model_fields.items():
                    # Skip id, timestamps
                    if column_name in ['id', 'created_at', 'updated_at']:
                        continue
                    
                    # Check if field value is NULL/None/empty
                    field_value = getattr(entry, field.name, None)
                    if field_value is None or (isinstance(field, models.CharField) and field_value == ''):
                        null_fields.add(field.name)
            
            # Build update dict only for fields that are NULL
            for field_name in null_fields:
                field = all_model_fields.get(field_name) or next(
                    (f for f in model_class._meta.get_fields() if f.name == field_name), None
                )
                if field:
                    # For BooleanField (checkboxes), set to True
                    if isinstance(field, models.BooleanField):
                        update_dict[field.name] = True
                    # For CharField (text inputs), set to empty string (already empty, but ensure consistency)
                    elif isinstance(field, models.CharField):
                        update_dict[field.name] = ''
        
        # Bulk update if we have fields to update
        if update_dict and all_entries.exists():
            all_entries.update(**update_dict)
    except Exception as e:
        # Log error but don't fail
        import sys
        import traceback
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)


class ProductionProcedure(models.Model):
    """
    Legacy model - kept for backward compatibility.
    Consider removing if not needed.
    """
    pass

    def __str__(self):
        return "Production Procedure"


class USIDCounter(models.Model):
    """
    Tracks daily counters for USID generation per part.
    USID format: yymmdd-partno-counter (e.g., 241220-EICS145-0001)
    """
    part_no = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Part number'
    )
    date = models.DateField(
        db_index=True,
        help_text='Date for which the counter is valid'
    )
    counter = models.IntegerField(
        default=0,
        help_text='Daily counter for this part (increments for each USID generated)'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['part_no', 'date']]
        ordering = ['-date', 'part_no']
        verbose_name = 'USID Counter'
        verbose_name_plural = 'USID Counters'
        db_table = 'usid_counter'
    
    def __str__(self):
        return f"{self.part_no} - {self.date} - Counter: {self.counter}"