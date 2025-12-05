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
    Now stores two models per part: in_process and completion.
    """
    _registry = {}  # {part_name: {'in_process': model_class, 'completion': model_class}}
    
    @classmethod
    def register(cls, part_name, model_class, table_type='in_process'):
        """Register a dynamic model for a part name.
        
        Args:
            part_name: The part name
            model_class: The model class to register
            table_type: 'in_process' or 'completion'
        """
        if part_name not in cls._registry:
            cls._registry[part_name] = {}
        cls._registry[part_name][table_type] = model_class
    
    @classmethod
    def get(cls, part_name, table_type='in_process'):
        """Get a dynamic model class for a part name.
        
        Args:
            part_name: The part name
            table_type: 'in_process' or 'completion'
        """
        if part_name in cls._registry:
            return cls._registry[part_name].get(table_type)
        return None
    
    @classmethod
    def get_both(cls, part_name):
        """Get both models (in_process and completion) for a part name.
        
        Returns:
            tuple: (in_process_model, completion_model) or (None, None)
        """
        if part_name in cls._registry:
            return (
                cls._registry[part_name].get('in_process'),
                cls._registry[part_name].get('completion')
            )
        return (None, None)
    
    @classmethod
    def exists(cls, part_name, table_type=None):
        """Check if a dynamic model exists for a part name.
        
        Args:
            part_name: The part name
            table_type: 'in_process', 'completion', or None (checks both)
        """
        if part_name not in cls._registry:
            return False
        if table_type is None:
            return 'in_process' in cls._registry[part_name] or 'completion' in cls._registry[part_name]
        return table_type in cls._registry[part_name]
    
    @classmethod
    def get_all(cls):
        """Get all registered dynamic models."""
        return cls._registry.copy()
    
    @classmethod
    def unregister(cls, part_name, table_type=None):
        """Unregister a dynamic model (use with caution).
        
        Args:
            part_name: The part name
            table_type: 'in_process', 'completion', or None (unregisters both)
        """
        if part_name in cls._registry:
            if table_type is None:
                del cls._registry[part_name]
            elif table_type in cls._registry[part_name]:
                del cls._registry[part_name][table_type]
                if not cls._registry[part_name]:
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


def get_table_name(part_name, suffix=''):
    """
    Generate a valid database table name from part name.
    Format: <sanitized_part_name>_<suffix> (e.g., eics112_part_in_process)
    
    Args:
        part_name: The part name
        suffix: Optional suffix (e.g., 'in_process', 'completion')
    """
    sanitized = sanitize_part_name(part_name)
    # Convert to lowercase for table name
    table_name = sanitized.lower()
    if suffix:
        table_name = f"{table_name}_{suffix}"
    import sys
    print("Generated table name for '%s' (suffix: '%s'): '%s'" % (part_name, suffix, table_name), file=sys.stderr)
    return table_name


def split_sections_by_qc(enabled_sections, procedure_config):
    """
    Split sections into pre-QC (in_process) and post-QC (completion) groups.
    
    Pre-QC sections: kit, smd, smd_qc, pre_forming_qc, accessories_packing, leaded_qc, prod_qc, qc
    Post-QC sections: qc, testing, heat_run, glueing, cleaning, spraying, dispatch
    
    Args:
        enabled_sections: List of enabled section names
        procedure_config: Full procedure configuration dict
    
    Returns:
        tuple: (pre_qc_sections, post_qc_sections, pre_qc_config, post_qc_config)
    """
    pre_qc_sections_list = [
        'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
        'leaded_qc', 'prod_qc', 'qc'
    ]
    post_qc_sections_list = [
        'qc', 'testing', 'heat_run', 'glueing', 'cleaning', 'spraying', 'dispatch'
    ]
    
    pre_qc_sections = [s for s in enabled_sections if s in pre_qc_sections_list]
    post_qc_sections = [s for s in enabled_sections if s in post_qc_sections_list]
    
    # Build configs for each group
    pre_qc_config = {}
    post_qc_config = {}
    
    if procedure_config:
        for section_name, section_data in procedure_config.items():
            if section_name in pre_qc_sections_list:
                pre_qc_config[section_name] = section_data
            if section_name in post_qc_sections_list:
                post_qc_config[section_name] = section_data
    
    return pre_qc_sections, post_qc_sections, pre_qc_config, post_qc_config


def _create_single_dynamic_model(part_name, enabled_sections, procedure_config, table_type, related_model_class=None):
    """
    Internal function to create a single dynamic model (either in_process or completion).
    
    Args:
        part_name: The part number/name
        enabled_sections: List of enabled sections for this model
        procedure_config: Procedure configuration for this model
        table_type: 'in_process' or 'completion'
        related_model_class: For completion model, the in_process model class to link to
    
    Returns:
        Model class: The dynamically created model class
    """
    # Sanitize part name for class name
    class_name = sanitize_part_name(part_name)
    if table_type == 'in_process':
        class_name = f"{class_name}InProcess"
    elif table_type == 'completion':
        class_name = f"{class_name}Completion"
    
    # Generate table name
    db_table = get_table_name(part_name, table_type)
    
    # Define common fields that should NOT be section-prefixed
    COMMON_FIELDS = {
        'usid': 'USID',
        'serial_number': 'Serial Number',
        'in-process_tag_number': 'Serial Number',  # Alias for serial_number
    }
    
    # Define the model fields
    fields = {
        'id': models.BigAutoField(primary_key=True),
    }
    
    # For completion model, add ForeignKey to in_process model
    if table_type == 'completion' and related_model_class:
        fields['in_process_entry'] = models.ForeignKey(
            related_model_class,
            on_delete=models.CASCADE,
            related_name='completion_entries',
            blank=True,
            null=True,
            help_text='Link to the corresponding in-process entry'
        )
    
    # Store field metadata
    field_metadata = {}
    
    # Add common fields first (not section-prefixed)
    common_fields_added = set()
    for common_field, label in COMMON_FIELDS.items():
        if common_field == 'in-process_tag_number':
            continue
        fields[common_field] = models.CharField(
            max_length=255,
            blank=True,
            null=True,
            verbose_name=label,
            help_text=label
        )
        if common_field == 'usid':
            fields[common_field].unique = True
        common_fields_added.add(common_field)
        field_metadata[common_field] = {
            'label': label,
            'original_name': common_field,
            'section': None,
            'is_common': True
        }
    
    # Add fields from procedure_config if provided
    if procedure_config:
        section_fields = {}
        
        for section_name, section_data in procedure_config.items():
            if not section_data.get('enabled', False):
                continue
            
            section_fields[section_name] = {}
            
            # Add default fields (text fields) with section prefix
            default_fields = section_data.get('default_fields', [])
            for field_name in default_fields:
                if field_name in common_fields_added:
                    continue
                if field_name == 'in-process_tag_number':
                    continue
                
                section_prefix = f"{section_name}_"
                if field_name.startswith(section_prefix):
                    prefixed_name = field_name
                else:
                    prefixed_name = f"{section_name}_{field_name}"
                
                section_fields[section_name][prefixed_name] = {
                    'type': 'text',
                    'label': field_name.replace('_', ' ').title(),
                    'original_name': field_name,
                    'section': section_name
                }
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
                    prefixed_name = f"{section_name}_{field_name}"
                    section_fields[section_name][prefixed_name] = {
                        'type': 'checkbox',
                        'label': field_label,
                        'original_name': field_name,
                        'section': section_name
                    }
                    field_metadata[prefixed_name] = {
                        'label': field_label,
                        'original_name': field_name,
                        'section': section_name,
                        'is_common': False
                    }
        
        # Create fields for each section's fields
        for section_name in sorted(section_fields.keys()):
            for field_name, field_info in sorted(section_fields[section_name].items()):
                meta = field_metadata.get(field_name, {})
                if isinstance(meta, str):
                    meta = {'label': meta, 'section': field_info.get('section', '')}
                
                display_label = meta.get('label', field_name.replace('_', ' ').title())
                
                if field_info['type'] == 'checkbox':
                    fields[field_name] = models.BooleanField(
                        default=False,
                        verbose_name=display_label,
                        help_text=display_label
                    )
                else:
                    fields[field_name] = models.CharField(
                        max_length=255,
                        blank=True,
                        null=True,
                        verbose_name=display_label,
                        help_text=display_label
                    )
                
                fields[field_name]._section = field_info.get('section', '')
    
    # Add timestamps
    fields['created_at'] = models.DateTimeField(auto_now_add=True)
    fields['updated_at'] = models.DateTimeField(auto_now=True)
    
    # Create Meta class
    meta_attrs = {
        'db_table': db_table,
        'verbose_name': f'{part_name} - {table_type.replace("_", " ").title()}',
        'verbose_name_plural': f'{part_name} - {table_type.replace("_", " ").title()} Entries',
        'ordering': ['-created_at'],
        'app_label': 'api',
    }
    
    Meta = type('Meta', (), meta_attrs)
    fields['Meta'] = Meta
    
    # Add __str__ method
    def __str__(self):
        identifier = None
        if hasattr(self, 'usid') and getattr(self, 'usid'):
            identifier = getattr(self, 'usid')
        elif hasattr(self, 'serial_number') and getattr(self, 'serial_number'):
            identifier = getattr(self, 'serial_number')
        return f"{part_name} {table_type.replace('_', ' ').title()}: {identifier or 'N/A'}"
    
    fields['__str__'] = __str__
    fields['_field_labels'] = field_metadata
    fields['__module__'] = 'api.models'
    fields['__qualname__'] = class_name
    
    # Create the model class dynamically
    model_class = type(class_name, (models.Model,), fields)
    
    # Ensure the model is properly associated with the 'api' app
    if hasattr(model_class._meta, 'app_label'):
        model_class._meta.app_label = 'api'
    else:
        if hasattr(model_class, 'Meta'):
            model_class.Meta.app_label = 'api'
    
    return model_class


def create_dynamic_part_model(part_name, enabled_sections, procedure_config=None):
    """
    Create two dynamic Django models for a specific part number:
    1. In-Process model: sections up to and including QC
    2. Completion model: sections from QC onwards (with ForeignKey to In-Process)
    
    Args:
        part_name (str): The part number/name (e.g., 'EICS112_Part')
        enabled_sections (list): List of enabled main sections
        procedure_config (dict): Procedure configuration with fields from each section
    
    Returns:
        dict: {'in_process': model_class, 'completion': model_class}
    """
    # Check if models already exist
    if DynamicModelRegistry.exists(part_name):
        if procedure_config is None:
            # No new config, return existing models
            in_process_model, completion_model = DynamicModelRegistry.get_both(part_name)
            return {'in_process': in_process_model, 'completion': completion_model}
        else:
            # New config provided - unregister old models and create new ones
            import sys
            print("Recreating models for %s with updated procedure_config" % part_name, file=sys.stderr)
            DynamicModelRegistry.unregister(part_name)
    
    # Split sections into pre-QC and post-QC
    pre_qc_sections, post_qc_sections, pre_qc_config, post_qc_config = split_sections_by_qc(
        enabled_sections, procedure_config
    )
    
    import sys
    print("Creating two models for %s:" % part_name, file=sys.stderr)
    print("  In-Process sections: %s" % pre_qc_sections, file=sys.stderr)
    print("  Completion sections: %s" % post_qc_sections, file=sys.stderr)
    
    # Create in_process model first
    in_process_model = None
    if pre_qc_sections or pre_qc_config:
        in_process_model = _create_single_dynamic_model(
            part_name, pre_qc_sections, pre_qc_config, 'in_process'
        )
        # Register in_process model
        DynamicModelRegistry.register(part_name, in_process_model, 'in_process')
    
    # Create completion model with ForeignKey to in_process
    completion_model = None
    if post_qc_sections or post_qc_config:
        completion_model = _create_single_dynamic_model(
            part_name, post_qc_sections, post_qc_config, 'completion', 
            related_model_class=in_process_model
        )
        # Register completion model
        DynamicModelRegistry.register(part_name, completion_model, 'completion')
    
    # Register both models with Django's app registry
    models_to_register = []
    if in_process_model:
        models_to_register.append(('in_process', in_process_model))
    if completion_model:
        models_to_register.append(('completion', completion_model))
    
    # Register both models with Django's app registry and admin
    for table_type, model_class in models_to_register:
        class_name = model_class.__name__
        db_table = model_class._meta.db_table
        
        # Register with Django's app registry
        app_config = apps.get_app_config('api')
        if not hasattr(app_config, '_dynamic_models'):
            app_config._dynamic_models = {}
        if part_name not in app_config._dynamic_models:
            app_config._dynamic_models[part_name] = {}
        app_config._dynamic_models[part_name][table_type] = model_class
        
        # Add to app's models module so Django can discover it
        try:
            from api import models as api_models
            setattr(api_models, class_name, model_class)
            if not hasattr(app_config, 'models'):
                app_config.models = api_models
        except Exception as e:
            import sys
            print("Warning: Could not add model to api.models module: %s" % str(e), file=sys.stderr)
        
        # Ensure model is in Django's app registry (critical for admin discovery)
        try:
            from django.apps import apps as django_apps
            if 'api' not in django_apps.all_models:
                django_apps.all_models['api'] = {}
            
            class_key = class_name.lower()
            django_apps.all_models['api'][class_key] = model_class
            
            table_key = db_table.lower()
            if table_key != class_key:
                django_apps.all_models['api'][table_key] = model_class
            
            import sys
            print("Added model %s (%s) to Django's app registry (key: %s)" % (class_name, table_type, class_key), file=sys.stderr)
        except Exception as e:
            import sys
            import traceback
            print("Warning: Could not add model to Django's model registry: %s" % str(e), file=sys.stderr)
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        
        # Register in Django admin immediately
        try:
            from api.admin import register_dynamic_model_in_admin
            register_dynamic_model_in_admin(model_class, f"{part_name}_{table_type}")
            import sys
            print("Registered dynamic model '%s' (%s) in admin" % (part_name, table_type), file=sys.stderr)
        except Exception as e:
            import sys
            print("Note: Could not register %s (%s) in admin immediately: %s" % (part_name, table_type, str(e)), file=sys.stderr)
    
    # Return both models
    return {'in_process': in_process_model, 'completion': completion_model}


def get_dynamic_part_model(part_name, table_type='in_process'):
    """
    Get the dynamic model class for a part name.
    
    Args:
        part_name: The part name
        table_type: 'in_process', 'completion', or None (returns dict with both)
    
    Returns:
        Model class, dict, or None
    """
    if table_type is None:
        return DynamicModelRegistry.get_both(part_name)
    return DynamicModelRegistry.get(part_name, table_type)


def ensure_dynamic_model_exists(part_name, enabled_sections, procedure_config=None):
    """
    Ensure dynamic models exist for a part. Create them if they don't.
    
    Args:
        part_name (str): The part number/name
        enabled_sections (list): List of enabled main sections
        procedure_config (dict): Procedure configuration with fields
    
    Returns:
        dict: {'in_process': model_class, 'completion': model_class}
    """
    in_process_model, completion_model = get_dynamic_part_model(part_name, None)
    if in_process_model is None and completion_model is None:
        models_dict = create_dynamic_part_model(part_name, enabled_sections, procedure_config)
        return models_dict
    return {'in_process': in_process_model, 'completion': completion_model}


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

