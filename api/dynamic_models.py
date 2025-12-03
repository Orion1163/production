"""
Dynamic Model Factory for creating per-part data tables.

This module handles the creation of dynamic Django models at runtime,
where each part number gets its own model class with the part name as the class name.
"""
import re
from django.db import models
from django.apps import apps
from django.core.exceptions import ImproperlyConfigured


class DynamicModelRegistry:
    """
    Registry to track dynamically created models.
    Maps part names to their dynamically created model classes.
    """
    _registry = {}
    
    @classmethod
    def register(cls, part_name, model_class):
        """Register a dynamic model for a part name."""
        cls._registry[part_name] = model_class
    
    @classmethod
    def get(cls, part_name):
        """Get a dynamic model class for a part name."""
        return cls._registry.get(part_name)
    
    @classmethod
    def exists(cls, part_name):
        """Check if a dynamic model exists for a part name."""
        return part_name in cls._registry
    
    @classmethod
    def get_all(cls):
        """Get all registered dynamic models."""
        return cls._registry.copy()
    
    @classmethod
    def unregister(cls, part_name):
        """Unregister a dynamic model (use with caution)."""
        if part_name in cls._registry:
            del cls._registry[part_name]


def sanitize_part_name(part_name):
    """
    Sanitize part name to be a valid Python class name and database table name.
    
    Rules:
    - Replace special characters with underscores
    - Ensure it starts with a letter or underscore
    - Remove consecutive underscores
    - Convert to valid identifier
    """
    # Replace special characters with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', str(part_name))
    
    # Remove consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Ensure it starts with a letter or underscore (not a number)
    if sanitized and sanitized[0].isdigit():
        sanitized = f'Part_{sanitized}'
    
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    
    # If empty after sanitization, use a default
    if not sanitized:
        sanitized = 'Part'
    
    return sanitized


def get_table_name(part_name):
    """
    Generate a valid database table name from part name.
    Format: <sanitized_part_name> (just the part name, no prefix)
    """
    sanitized = sanitize_part_name(part_name)
    # Convert to lowercase for table name
    table_name = sanitized.lower()
    import sys
    print("Generated table name for '%s': '%s'" % (part_name, table_name), file=sys.stderr)
    return table_name


def create_dynamic_part_model(part_name, enabled_sections, procedure_config=None):
    """
    Create a dynamic Django model for a specific part number.
    
    Args:
        part_name (str): The part number/name (e.g., 'EICS112_Part')
        enabled_sections (list): List of enabled main sections (e.g., ['qc', 'testing', 'dispatch'])
        procedure_config (dict): Procedure configuration with fields from each section
    
    Returns:
        Model class: The dynamically created model class
    """
    # Check if model already exists
    # If procedure_config is provided and different, we need to recreate the model
    # to include new fields from the updated procedure_config
    if DynamicModelRegistry.exists(part_name):
        if procedure_config is None:
            # No new config, return existing model
            existing_model = DynamicModelRegistry.get(part_name)
            return existing_model
        else:
            # New config provided - unregister old model and create new one
            # This allows the model to be updated with new fields
            import sys
            print("Recreating model %s with updated procedure_config" % part_name, file=sys.stderr)
            DynamicModelRegistry.unregister(part_name)
    
    # Sanitize part name for class name
    class_name = sanitize_part_name(part_name)
    
    # Generate table name (just the part name)
    db_table = get_table_name(part_name)
    
    # Define common fields that should NOT be section-prefixed
    # These are shared across all sections
    COMMON_FIELDS = {
        'usid': 'USID',
        'serial_number': 'Serial Number',
        'tag_no': 'Tag Number',
        'in-process_tag_number': 'Serial Number',  # Alias for serial_number
    }
    
    # Define the model fields
    fields = {
        'id': models.BigAutoField(primary_key=True),
    }
    
    # Store field metadata (name -> label mapping)
    field_metadata = {}
    
    # Add common fields first (not section-prefixed)
    common_fields_added = set()
    for common_field, label in COMMON_FIELDS.items():
        if common_field == 'in-process_tag_number':
            # Skip this - it's an alias for serial_number
            continue
        fields[common_field] = models.CharField(
            max_length=255,
            blank=True,
            null=True,
            verbose_name=label,
            help_text=label
        )
        if common_field == 'usid':
            # Make usid unique
            fields[common_field].unique = True
        common_fields_added.add(common_field)
        field_metadata[common_field] = {
            'label': label,
            'original_name': common_field,
            'section': None,  # Common field, not section-specific
            'is_common': True
        }
    
    # Add fields from procedure_config if provided
    if procedure_config:
        # Collect all fields from all enabled sections, organized by section
        # Structure: {section_name: {field_name: {type: 'text'|'checkbox', label: str}}}
        section_fields = {}
        
        for section_name, section_data in procedure_config.items():
            if not section_data.get('enabled', False):
                continue
            
            section_fields[section_name] = {}
            
            # Add default fields (text fields) with section prefix
            default_fields = section_data.get('default_fields', [])
            for field_name in default_fields:
                # Check if this is a common field - don't prefix it
                if field_name in common_fields_added:
                    # Common field already added, skip
                    continue
                
                # Handle alias: in-process_tag_number -> serial_number
                if field_name == 'in-process_tag_number':
                    # This is already handled as serial_number, skip
                    continue
                
                # Check if field already has section prefix to avoid double-prefixing
                # (e.g., "dispatch_done_by" already has "dispatch_" prefix)
                section_prefix = f"{section_name}_"
                if field_name.startswith(section_prefix):
                    # Field already has section prefix, use as-is
                    prefixed_name = field_name
                else:
                    # Prefix field name with section name to organize by section
                    prefixed_name = f"{section_name}_{field_name}"
                
                section_fields[section_name][prefixed_name] = {
                    'type': 'text',
                    'label': field_name.replace('_', ' ').title(),
                    'original_name': field_name,
                    'section': section_name
                }
                # Store metadata: original name for display, section for grouping
                field_metadata[prefixed_name] = {
                    'label': field_name.replace('_', ' ').title(),
                    'original_name': field_name,
                    'section': section_name,
                    'is_common': False
                }
            
            # Add custom checkboxes (boolean fields) with section prefix
            custom_checkboxes = section_data.get('custom_checkboxes', [])
            for checkbox in custom_checkboxes:
                field_name = checkbox.get('name')
                field_label = checkbox.get('label', field_name)
                if field_name:
                    # Prefix field name with section name
                    prefixed_name = f"{section_name}_{field_name}"
                    section_fields[section_name][prefixed_name] = {
                        'type': 'checkbox',
                        'label': field_label,
                        'original_name': field_name,
                        'section': section_name
                    }
                    # Store metadata: original label for display, section for grouping
                    field_metadata[prefixed_name] = {
                        'label': field_label,
                        'original_name': field_name,
                        'section': section_name,
                        'is_common': False
                    }
        
        # Create fields for each section's fields
        for section_name in sorted(section_fields.keys()):
            for field_name, field_info in sorted(section_fields[section_name].items()):
                # Get metadata for this field
                meta = field_metadata.get(field_name, {})
                if isinstance(meta, str):
                    # Legacy format - convert to dict
                    meta = {'label': meta, 'section': field_info.get('section', '')}
                
                display_label = meta.get('label', field_name.replace('_', ' ').title())
                
                if field_info['type'] == 'checkbox':
                    # Create boolean field for checkboxes
                    fields[field_name] = models.BooleanField(
                        default=False,
                        verbose_name=display_label,
                        help_text=display_label
                    )
                else:
                    # Create CharField for text fields
                    fields[field_name] = models.CharField(
                        max_length=255,
                        blank=True,
                        null=True,
                        verbose_name=display_label,
                        help_text=display_label
                    )
                
                # Store section info in field for admin organization
                fields[field_name]._section = field_info.get('section', '')
    
    # Add boolean fields for all possible main sections
    # These will be set to True/False based on enabled_sections
    main_sections = [
        'smd', 'leaded', 'prod_qc', 'qc', 'testing', 
        'glueing', 'cleaning', 'spraying', 'dispatch'
    ]
    
    for section in main_sections:
        field_name = f'is_{section}'
        # Set default to True if section is enabled, False otherwise
        default_value = section in enabled_sections
        fields[field_name] = models.BooleanField(
            default=default_value,
            help_text=f'Indicates if {section.upper()} section is enabled for this entry'
        )
    
    # Add timestamps
    fields['created_at'] = models.DateTimeField(auto_now_add=True)
    fields['updated_at'] = models.DateTimeField(auto_now=True)
    
    # Create Meta class
    meta_attrs = {
        'db_table': db_table,
        'verbose_name': part_name,  # Use part name directly for admin display
        'verbose_name_plural': f'{part_name} Entries',
        'ordering': ['-created_at'],
        'app_label': 'api',  # Important: Associate with 'api' app
    }
    
    Meta = type('Meta', (), meta_attrs)
    fields['Meta'] = Meta
    
    # Add __str__ method
    def __str__(self):
        # Use usid as primary identifier
        identifier = None
        if hasattr(self, 'usid') and getattr(self, 'usid'):
            identifier = getattr(self, 'usid')
        elif hasattr(self, 'serial_number') and getattr(self, 'serial_number'):
            identifier = getattr(self, 'serial_number')
        elif hasattr(self, 'tag_no') and getattr(self, 'tag_no'):
            identifier = getattr(self, 'tag_no')
        return f"{part_name} Entry: {identifier or 'N/A'}"
    
    fields['__str__'] = __str__
    
    # Store field metadata in the model class (for reference)
    fields['_field_labels'] = field_metadata
    
    # Add __module__ to make it appear in the api.models module
    # This is critical for Django admin to discover the model
    fields['__module__'] = 'api.models'
    
    # Set __qualname__ for proper module resolution
    fields['__qualname__'] = class_name
    
    # Create the model class dynamically
    model_class = type(class_name, (models.Model,), fields)
    
    # Ensure the model is properly associated with the 'api' app
    # This is critical for Django admin to discover it
    if hasattr(model_class._meta, 'app_label'):
        model_class._meta.app_label = 'api'
    else:
        # Set app_label via Meta if not already set
        if hasattr(model_class, 'Meta'):
            model_class.Meta.app_label = 'api'
    
    # Register the model
    DynamicModelRegistry.register(part_name, model_class)
    
    # Register with Django's app registry
    # This is important for migrations and admin
    app_config = apps.get_app_config('api')
    if not hasattr(app_config, '_dynamic_models'):
        app_config._dynamic_models = {}
    app_config._dynamic_models[part_name] = model_class
    
    # Add to app's models module so Django can discover it
    try:
        from api import models as api_models
        setattr(api_models, class_name, model_class)
        
        # Also add to app's models registry
        if not hasattr(app_config, 'models'):
            app_config.models = api_models
    except Exception as e:
        import sys
        print("Warning: Could not add model to api.models module: %s" % str(e), file=sys.stderr)
    
    # Ensure model is in Django's app registry (critical for admin discovery)
    try:
        from django.apps import apps as django_apps
        # Add to Django's all_models registry - this is how admin discovers models
        if 'api' not in django_apps.all_models:
            django_apps.all_models['api'] = {}
        
        # Use the lowercase class name as the model key (for admin URLs)
        # Django admin uses the lowercase class name for URLs, not the table name
        # This ensures URLs match: /admin/api/eics112_part/
        class_key = class_name.lower()
        django_apps.all_models['api'][class_key] = model_class
        
        # Also add with table name as key (for compatibility, in case it's different)
        table_key = db_table.lower()
        if table_key != class_key:
            django_apps.all_models['api'][table_key] = model_class
        
        # Also ensure it's in the app config's models
        app_config = django_apps.get_app_config('api')
        if not hasattr(app_config, 'models'):
            from api import models as api_models_module
            app_config.models = api_models_module
        
        # Set the model in the app's models module (for admin discovery)
        try:
            from api import models as api_models_module
            setattr(api_models_module, class_name, model_class)
        except Exception as e:
            import sys
            print("Warning: Could not set model in api.models: %s" % str(e), file=sys.stderr)
        
        # Ensure model has proper metadata for admin index
        if not hasattr(model_class._meta, 'verbose_name') or not model_class._meta.verbose_name:
            model_class._meta.verbose_name = f'Data Entry for {part_name}'
        if not hasattr(model_class._meta, 'verbose_name_plural') or not model_class._meta.verbose_name_plural:
            model_class._meta.verbose_name_plural = f'Data Entries for {part_name}'
        
        import sys
        print("Added model %s to Django's app registry (key: %s)" % (class_name, class_key), file=sys.stderr)
        print("  - Verbose name: %s" % model_class._meta.verbose_name, file=sys.stderr)
        print("  - App label: %s" % model_class._meta.app_label, file=sys.stderr)
    except Exception as e:
        import sys
        import traceback
        print("Warning: Could not add model to Django's model registry: %s" % str(e), file=sys.stderr)
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Register in Django admin immediately
    try:
        from api.admin import register_dynamic_model_in_admin
        register_dynamic_model_in_admin(model_class, part_name)
        import sys
        print("Registered dynamic model '%s' in admin" % part_name, file=sys.stderr)
    except Exception as e:
        # Admin registration might fail if admin hasn't loaded yet
        # It will be registered when admin loads via register_all_dynamic_models_in_admin
        import sys
        print("Note: Could not register %s in admin immediately: %s" % (part_name, str(e)), file=sys.stderr)
    
    return model_class


def get_dynamic_part_model(part_name):
    """
    Get the dynamic model class for a part name.
    Returns None if the model doesn't exist.
    """
    return DynamicModelRegistry.get(part_name)


def ensure_dynamic_model_exists(part_name, enabled_sections, procedure_config=None):
    """
    Ensure a dynamic model exists for a part. Create it if it doesn't.
    
    Args:
        part_name (str): The part number/name
        enabled_sections (list): List of enabled main sections
        procedure_config (dict): Procedure configuration with fields
    
    Returns:
        Model class: The dynamic model class
    """
    model = get_dynamic_part_model(part_name)
    if model is None:
        model = create_dynamic_part_model(part_name, enabled_sections, procedure_config)
    return model


def create_table_for_dynamic_model(model_class):
    """
    Create the database table for a dynamic model using Django's schema editor.
    This should be called after creating the model.
    
    Note: In production, you should use migrations instead of this.
    This is mainly for development/testing.
    """
    from django.db import connection
    
    # Use schema editor to create the table
    try:
        with connection.schema_editor() as schema_editor:
            schema_editor.create_model(model_class)
        return True
    except Exception as e:
        print(f"Error creating table for {model_class.__name__}: {e}")
        return False

