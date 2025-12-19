import re
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.admin.apps import AdminConfig
from django.http import Http404, HttpResponseRedirect
from django.urls import reverse, NoReverseMatch
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from .models import User, Admin, ModelPart, PartProcedureDetail, USIDCounter
from .dynamic_models import DynamicModelRegistry


admin.site.register(Admin)

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('name', 'emp_id', 'roles',)
    search_fields = ('name', 'emp_id')
    list_filter = ('roles',)


@admin.register(ModelPart)
class ModelPartAdmin(admin.ModelAdmin):
    list_display = ('model_no', 'part_no', 'created_at', 'updated_at')
    search_fields = ('model_no', 'part_no')
    list_filter = ('created_at', 'model_no')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PartProcedureDetail)
class PartProcedureDetailAdmin(admin.ModelAdmin):
    list_display = ('model_part', 'created_at', 'updated_at')
    search_fields = ('model_part__part_no', 'model_part__model_no')
    list_filter = ('created_at',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(USIDCounter)
class USIDCounterAdmin(admin.ModelAdmin):
    list_display = ('part_no', 'date', 'counter', 'created_at', 'updated_at')
    search_fields = ('part_no',)
    list_filter = ('date', 'part_no')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-date', 'part_no')


# Dynamic Model Admin Registration
def register_dynamic_model_in_admin(model_class, part_name):
    """
    Register a dynamic model in Django admin.
    
    Args:
        model_class: The dynamic model class
        part_name: The part name (for display)
    """
    # Check if already registered by checking the registry
    # admin.site._registry is a dict where keys are model classes
    try:
        if model_class in admin.site._registry:
            import sys
            print("Model %s already registered in admin" % part_name, file=sys.stderr)
            return True
    except (TypeError, AttributeError):
        # If comparison fails, try checking by model name
        try:
            model_name = model_class._meta.label
            registered_models = [m._meta.label for m in admin.site._registry.keys()]
            if model_name in registered_models:
                import sys
                print("Model %s already registered in admin (by name)" % part_name, file=sys.stderr)
                return True
        except:
            pass
    
    # For completion models, ensure the related in_process model is also registered FIRST
    # This prevents NoReverseMatch errors when Django admin tries to generate URLs for ForeignKey widgets
    is_completion_model = (
        'completion' in model_class.__name__.lower() or 
        'completion' in model_class._meta.db_table.lower()
    )
    if is_completion_model:
        # Check for ForeignKey fields that point to in_process models
        for field in model_class._meta.get_fields():
            if hasattr(field, 'remote_field') and field.remote_field:
                related_model = field.remote_field.model
                # Check if related model is an in_process model
                is_related_in_process = (
                    'inprocess' in related_model.__name__.lower() or 
                    'in_process' in getattr(related_model._meta, 'db_table', '').lower()
                )
                if is_related_in_process and related_model not in admin.site._registry:
                    # Extract part name from the completion model's part_name
                    # The part_name should be like "eics120_completion", so we extract "eics120"
                    if '_completion' in part_name.lower():
                        related_part_name = part_name.lower().replace('_completion', '').rstrip('_')
                    elif 'completion' in part_name.lower():
                        related_part_name = part_name.lower().split('completion')[0].rstrip('_')
                    else:
                        # Fallback: try to extract from related model
                        related_class_name = related_model.__name__.lower()
                        if 'inprocess' in related_class_name:
                            related_part_name = related_class_name.split('inprocess')[0].rstrip('_')
                        else:
                            related_part_name = related_class_name.replace('_in_process', '').replace('inprocess', '')
                    
                    # Register the related in_process model FIRST (before registering completion model)
                    import sys
                    print("CRITICAL: Registering related in_process model FIRST for %s: %s" % (part_name, related_part_name), file=sys.stderr)
                    try:
                        # Use a flag to prevent infinite recursion
                        if not hasattr(related_model, '_registering_in_admin'):
                            related_model._registering_in_admin = True
                            try:
                                # Register with the proper part name format
                                related_part_display_name = f"{related_part_name}_in_process"
                                result = register_dynamic_model_in_admin(related_model, related_part_display_name)
                                if result:
                                    import sys
                                    print("SUCCESS: Registered related in_process model %s before completion model %s" % (
                                        related_part_display_name, part_name
                                    ), file=sys.stderr)
                                else:
                                    import sys
                                    print("WARNING: Failed to register related in_process model %s" % related_part_display_name, file=sys.stderr)
                            finally:
                                if hasattr(related_model, '_registering_in_admin'):
                                    delattr(related_model, '_registering_in_admin')
                    except Exception as e:
                        import sys
                        import traceback
                        print("ERROR: Could not register related in_process model: %s" % str(e), file=sys.stderr)
                        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Get all field names from the model
    all_fields = [f.name for f in model_class._meta.get_fields() if not f.one_to_many and not f.many_to_many]
    
    # Separate fields into categories
    timestamp_fields = ['created_at', 'updated_at']
    
    # Common fields that should NOT be section-prefixed
    # For in_process models, usid and serial_number are NOT common (each entry is different)
    # Check if this is an in_process model by checking the class name or table name
    is_in_process_model = (
        'inprocess' in model_class.__name__.lower() or 
        'in_process' in model_class._meta.db_table.lower()
    )
    
    # Common fields list - exclude usid and serial_number for in_process models
    common_fields_list = ['usid', 'serial_number']
    if is_in_process_model:
        # For in_process models, these are not common fields
        common_fields_list = []
    common_fields = [f for f in all_fields if f in common_fields_list]
    
    # Dynamic fields (section-specific, excluding common fields and timestamps)
    dynamic_fields = [f for f in all_fields if f not in ['id'] + timestamp_fields + common_fields]
    
    # Get procedure_config to organize fields by section
    from api.models import ModelPart
    section_map = {}  # {section_name: [field_names]}
    
    try:
        model_part = ModelPart.objects.filter(part_no=part_name).first()
        if model_part and hasattr(model_part, 'procedure_detail'):
            procedure_config = model_part.procedure_detail.procedure_config
            # All possible sections in production workflow order
            # Order: Kit → SMD → SMD QC → Pre-Forming QC → Accessories Packing → 
            #        Leaded QC → Production QC → QC → Testing → Heat Run → 
            #        Glueing → Cleaning → Spraying → Dispatch
            section_order = [
                'kit',                    # 1. Kit Verification (first step)
                'smd',                    # 2. SMD (Surface Mount Device)
                'smd_qc',                 # 3. SMD QC (QC after SMD)
                'pre_forming_qc',         # 4. Pre-Forming QC
                'accessories_packing',    # 5. Accessories Packing
                'leaded_qc',              # 6. Leaded QC
                'prod_qc',                # 7. Production QC
                'qc',                     # 8. QC (general QC)
                'testing',                # 9. Testing
                'heat_run',               # 10. Heat Run
                'glueing',                # 11. Glueing
                'cleaning',               # 12. Cleaning
                'spraying',               # 13. Spraying
                'dispatch'                # 14. Dispatch (final step)
            ]
            
            # Group fields by section - ensure each section's fields are isolated
            for section_name in section_order:
                if section_name in procedure_config and procedure_config[section_name].get('enabled'):
                    # Use exact prefix match to ensure fields are properly isolated
                    # e.g., 'smd_' matches 'smd_available_quantity' but NOT 'smd_qc_available_quantity'
                    section_prefix = f"{section_name}_"
                    section_fields = [f for f in dynamic_fields if f.startswith(section_prefix) and not any(
                        f.startswith(f"{other_section}_") for other_section in section_order 
                        if other_section != section_name and f.startswith(f"{other_section}_")
                    )]
                    # More precise matching: ensure field starts with section prefix and doesn't match a longer section name
                    # For example, 'smd_' should match 'smd_available_quantity' but not 'smd_qc_available_quantity'
                    precise_section_fields = []
                    for field_name in dynamic_fields:
                        if field_name.startswith(section_prefix):
                            # Check if this field belongs to a longer section name (e.g., smd_qc vs smd)
                            belongs_to_longer_section = False
                            for other_section in section_order:
                                if other_section != section_name and len(other_section) > len(section_name):
                                    other_prefix = f"{other_section}_"
                                    if field_name.startswith(other_prefix):
                                        belongs_to_longer_section = True
                                        break
                            if not belongs_to_longer_section:
                                precise_section_fields.append(field_name)
                    if precise_section_fields:
                        section_map[section_name] = sorted(precise_section_fields)
        else:
            # Fallback: group by prefix if no procedure_config
            # Use production workflow order
            section_order = [
                'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
                'leaded_qc', 'prod_qc', 'qc', 'qc_images', 'testing',
                'heat_run', 'glueing', 'cleaning', 'spraying', 'dispatch'
            ]
            # Process longer section names first to avoid conflicts
            sorted_sections = sorted(section_order, key=len, reverse=True)
            for field_name in dynamic_fields:
                for section in sorted_sections:
                    if field_name.startswith(f"{section}_"):
                        if section not in section_map:
                            section_map[section] = []
                        section_map[section].append(field_name)
                        break
    except Exception as e:
        import sys
        print("Warning: Could not get procedure_config for admin: %s" % str(e), file=sys.stderr)
        # Fallback grouping - process longer section names first
        # Use production workflow order
        section_order = [
            'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
            'leaded_qc', 'prod_qc', 'qc', 'qc_images', 'testing',
            'heat_run', 'glueing', 'cleaning', 'spraying', 'dispatch'
        ]
        sorted_sections = sorted(section_order, key=len, reverse=True)
        for field_name in dynamic_fields:
            for section in sorted_sections:
                if field_name.startswith(f"{section}_"):
                    if section not in section_map:
                        section_map[section] = []
                    section_map[section].append(field_name)
                    break
    
    # Build list_display - include common fields first, then some dynamic fields
    list_display = ['id'] + common_fields + dynamic_fields[:5] + ['created_at']
    
    # Build search fields - include common fields and dynamic text fields
    search_fields = common_fields + [f for f in dynamic_fields if not f.startswith('_')][:7]
    
    # Build list_filter - no section checkboxes
    list_filter = ['created_at']
    
    # Build fieldsets organized by section
    fieldsets_list = []
    
    # Add common fields first (usid, serial_number)
    if common_fields:
        fieldsets_list.append(('Common Fields', {
            'fields': tuple(common_fields),
            'description': 'These fields are shared across all sections'
        }))
    
    # Section title mapping
    section_titles = {
        'kit': 'Kit Verification',
        'smd': 'SMD',
        'smd_qc': 'SMD QC',
        'pre_forming_qc': 'Pre-Forming QC',
        'accessories_packing': 'Accessories Packing',
        'leaded_qc': 'Leaded QC',
        'prod_qc': 'Production QC',
        'qc': 'QC',
        'qc_images': 'QC Images',
        'testing': 'Testing',
        'heat_run': 'Heat Run',
        'cleaning': 'Cleaning',
        'glueing': 'Glueing',
        'spraying': 'Spraying',
        'dispatch': 'Dispatch',
    }
    
    # Add fieldsets for each section - process in order, longer names first to avoid conflicts
    # Production workflow order for display in admin
    section_order = [
        'kit',                    # 1. Kit Verification
        'smd',                    # 2. SMD
        'smd_qc',                 # 3. SMD QC
        'pre_forming_qc',         # 4. Pre-Forming QC
        'accessories_packing',    # 5. Accessories Packing
        'leaded_qc',              # 6. Leaded QC
        'prod_qc',                # 7. Production QC
        'qc',                     # 8. QC
        'qc_images',              # 8. QC Images
        'testing',                # 9. Testing
        'heat_run',               # 10. Heat Run
         'cleaning',               # 11. Cleaning
        'glueing',                # 12. Glueing   
        'spraying',               # 13. Spraying
        'dispatch'                # 14. Dispatch
    ]
    
    # For field matching, we need to process longer section names first to avoid conflicts
    # (e.g., 'smd_qc' before 'smd' to prevent 'smd' from matching 'smd_qc_*' fields)
    section_order_sorted_for_matching = sorted(section_order, key=len, reverse=True)
    
    # For display order, we use the workflow order
    section_order_sorted = section_order
    # Process sections in production workflow order for display
    # This ensures sections appear in the correct order in the admin interface
    for section_name in section_order_sorted:
        if section_name in section_map and section_map[section_name]:
            section_title = section_titles.get(section_name, section_name.replace('_', ' ').title())
            fieldsets_list.append((section_title, {
                'fields': tuple(sorted(section_map[section_name])),
                'description': f'Fields for {section_title} section'
            }))
    
    # Add any remaining fields that don't match a section (shouldn't happen, but safety)
    # Use sorted order for matching to ensure proper field isolation
    remaining_fields = [f for f in dynamic_fields if not any(f.startswith(f"{s}_") for s in section_order_sorted_for_matching)]
    if remaining_fields:
        fieldsets_list.append(('Other Fields', {
            'fields': tuple(remaining_fields)
        }))
    
    # Section Status checkboxes removed - not needed in admin
    
    # Add timestamps
    fieldsets_list.append(('Timestamps', {
        'fields': tuple(timestamp_fields),
        'classes': ('collapse',)
    }))
    
    # Create a custom admin class for dynamic models
    # We need to capture the variables in the closure before class definition
    admin_list_display = list_display
    admin_list_filter = list_filter
    admin_search_fields = search_fields
    admin_readonly_fields = timestamp_fields
    admin_fieldsets = tuple(fieldsets_list)
    
    class DynamicModelAdmin(admin.ModelAdmin):
        list_display = admin_list_display
        list_filter = admin_list_filter
        search_fields = admin_search_fields
        readonly_fields = admin_readonly_fields
        fieldsets = admin_fieldsets
        
        def get_model_perms(self, request):
            """
            Return empty perms dict to avoid permission issues.
            """
            return {}
        
        def formfield_for_foreignkey(self, db_field, request, **kwargs):
            """
            Customize ForeignKey fields to handle URL reversal for dynamic models.
            For completion models with ForeignKey to in_process models, prevent the add URL
            from being generated to avoid NoReverseMatch errors.
            """
            from django.contrib.admin.widgets import RelatedFieldWidgetWrapper
            from django.urls.exceptions import NoReverseMatch
            
            # Check if this is a completion model
            is_completion_model = (
                'completion' in model_class.__name__.lower() or 
                'completion' in model_class._meta.db_table.lower()
            )
            
            # Get the field using default behavior first
            field = super().formfield_for_foreignkey(db_field, request, **kwargs)
            
            # Check if this is a ForeignKey to a dynamic model
            is_dynamic_fk = (hasattr(db_field, 'remote_field') and db_field.remote_field and 
                            ('inprocess' in str(db_field.remote_field.model).lower() or 
                             'completion' in str(db_field.remote_field.model).lower()))
            
            # For all ForeignKey fields, especially dynamic model ForeignKeys, wrap widget methods
            if field and hasattr(field, 'widget'):
                widget = field.widget
                
                # Check if it's a RelatedFieldWidgetWrapper (Django admin wraps ForeignKey widgets)
                if isinstance(widget, RelatedFieldWidgetWrapper):
                    # First, ensure the related model is registered in admin
                    if hasattr(db_field, 'remote_field') and db_field.remote_field:
                        related_model = db_field.remote_field.model
                        
                        # Also try to register if not registered (for non-completion models too)
                        if related_model not in admin.site._registry:
                            # Try to register the related model
                            try:
                                related_part_name = getattr(related_model._meta, 'verbose_name', None)
                                if not related_part_name:
                                    # Extract from model name
                                    related_class_name = related_model.__name__.lower()
                                    if 'inprocess' in related_class_name:
                                        related_part_name = related_class_name.split('inprocess')[0].rstrip('_')
                                    elif 'completion' in related_class_name:
                                        related_part_name = related_class_name.split('completion')[0].rstrip('_')
                                    else:
                                        related_part_name = related_class_name
                                
                                import sys
                                print("Auto-registering related model %s for ForeignKey field %s" % (
                                    related_part_name, db_field.name
                                ), file=sys.stderr)
                                # Determine table type for registration
                                if 'inprocess' in related_class_name or 'in_process' in related_class_name:
                                    register_dynamic_model_in_admin(related_model, f"{related_part_name}_in_process")
                                elif 'completion' in related_class_name:
                                    register_dynamic_model_in_admin(related_model, f"{related_part_name}_completion")
                                else:
                                    register_dynamic_model_in_admin(related_model, related_part_name)
                            except Exception as e:
                                import sys
                                print("Warning: Could not auto-register related model: %s" % str(e), file=sys.stderr)
                    
                    # Override get_related_url to prevent URL reversal errors (general case)
                    if hasattr(widget, 'get_related_url'):
                        original_get_related_url = widget.get_related_url
                        def safe_get_related_url(info, action, *args, **kwargs):
                            try:
                                # Check if related model is registered before trying to reverse URL
                                if hasattr(db_field, 'remote_field') and db_field.remote_field:
                                    related_model = db_field.remote_field.model
                                    if related_model not in admin.site._registry:
                                        # Try to register it first
                                        try:
                                            related_class_name = related_model.__name__.lower()
                                            if 'inprocess' in related_class_name:
                                                related_part_name = related_class_name.split('inprocess')[0].rstrip('_')
                                                register_dynamic_model_in_admin(related_model, f"{related_part_name}_in_process")
                                            elif 'completion' in related_class_name:
                                                related_part_name = related_class_name.split('completion')[0].rstrip('_')
                                                register_dynamic_model_in_admin(related_model, f"{related_part_name}_completion")
                                            else:
                                                related_part_name = related_class_name
                                                register_dynamic_model_in_admin(related_model, related_part_name)
                                        except Exception as reg_e:
                                            import sys
                                            print("Warning: Could not register related model before URL reversal: %s" % str(reg_e), file=sys.stderr)
                                
                                # Try to get the URL using our custom reverse function
                                return original_get_related_url(info, action, *args, **kwargs)
                            except NoReverseMatch as e:
                                # If URL reversal fails (NoReverseMatch), return None to hide the add button
                                import sys
                                print("Warning: Could not reverse URL for %s.%s.%s: %s" % (
                                    info[0] if len(info) > 0 else 'unknown',
                                    info[1] if len(info) > 1 else 'unknown',
                                    action, str(e)
                                ), file=sys.stderr)
                                return None
                            except Exception as e:
                                # For other exceptions, also return None to be safe
                                import sys
                                print("Warning: Exception in get_related_url for %s.%s.%s: %s" % (
                                    info[0] if len(info) > 0 else 'unknown',
                                    info[1] if len(info) > 1 else 'unknown',
                                    action, str(e)
                                ), file=sys.stderr)
                                return None
                        # Only override if not already overridden for completion models
                        if not (is_completion_model and db_field.name == 'in_process_entry'):
                            widget.get_related_url = safe_get_related_url
                    
                    # Override get_context to catch any exceptions during template rendering
                    # This is the method that calls get_related_url and can fail with NoReverseMatch
                    if hasattr(widget, 'get_context'):
                        original_get_context = widget.get_context
                        def safe_get_context(name, value, attrs):
                            try:
                                return original_get_context(name, value, attrs)
                            except NoReverseMatch as e:
                                # If get_context fails due to NoReverseMatch,
                                # catch the exception and create a safe context without the add URL
                                import sys
                                print("Warning: NoReverseMatch in widget get_context for %s: %s" % (
                                    db_field.name, str(e)
                                ), file=sys.stderr)
                                
                                # Get the base widget context (without the wrapper's add URL)
                                try:
                                    if hasattr(widget, 'widget'):
                                        base_context = widget.widget.get_context(name, value, attrs)
                                        # Remove add_related_url from context to prevent errors
                                        base_context.pop('add_related_url', None)
                                        base_context.pop('change_related_url', None)
                                        base_context.pop('delete_related_url', None)
                                        base_context.pop('can_add_related', None)
                                        base_context.pop('can_change_related', None)
                                        base_context.pop('can_delete_related', None)
                                        return base_context
                                    else:
                                        # Fallback: return minimal context
                                        return {
                                            'widget': {'name': name, 'value': value, 'attrs': attrs},
                                            'name': name,
                                            'value': value,
                                            'attrs': attrs,
                                        }
                                except Exception as inner_e:
                                    import sys
                                    print("Warning: Could not create fallback context: %s" % str(inner_e), file=sys.stderr)
                                    # Return minimal context as last resort
                                    return {
                                        'widget': {'name': name, 'value': value, 'attrs': attrs},
                                        'name': name,
                                        'value': value,
                                        'attrs': attrs,
                                    }
                            except Exception as e:
                                # For other exceptions, try to handle gracefully
                                import sys
                                from django.urls.exceptions import NoReverseMatch
                                if isinstance(e, NoReverseMatch):
                                    # Same handling as above
                                    try:
                                        if hasattr(widget, 'widget'):
                                            base_context = widget.widget.get_context(name, value, attrs)
                                            base_context.pop('add_related_url', None)
                                            base_context.pop('change_related_url', None)
                                            base_context.pop('delete_related_url', None)
                                            return base_context
                                    except:
                                        pass
                                
                                # For non-NoReverseMatch exceptions, re-raise them
                                raise
                        widget.get_context = safe_get_context
                    
                    # Override can_add_related to return False if URL reversal might fail
                    if hasattr(widget, 'can_add_related'):
                        original_can_add_related = widget.can_add_related
                        def safe_can_add_related(*args, **kwargs):
                            try:
                                # Check if related model is registered
                                if hasattr(db_field, 'remote_field') and db_field.remote_field:
                                    related_model = db_field.remote_field.model
                                    if related_model not in admin.site._registry:
                                        # Don't allow adding if model isn't registered
                                        return False
                                return original_can_add_related(*args, **kwargs)
                            except (NoReverseMatch, Exception):
                                # If we can't determine, return False to hide the add button
                                return False
                        widget.can_add_related = safe_can_add_related
            
            return field
        
        def response_post_save_add(self, request, obj):
            """
            Override to fix URL reversing after adding an object.
            """
            response = super().response_post_save_add(request, obj)
            # Fix the redirect URL to use our catch-all pattern
            if isinstance(response, HttpResponseRedirect) and hasattr(response, 'url') and response.url:
                model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                # Replace any reversed URLs with direct paths
                if 'api_' + model_name in response.url or 'admin/api/' + model_name in response.url:
                    # Create a new HttpResponseRedirect with the corrected URL
                    return HttpResponseRedirect('/admin/api/%s/' % model_name)
            return response
        
        def response_post_save_change(self, request, obj):
            """
            Override to fix URL reversing after changing an object.
            """
            response = super().response_post_save_change(request, obj)
            # Fix the redirect URL to use our catch-all pattern
            if isinstance(response, HttpResponseRedirect) and hasattr(response, 'url') and response.url:
                model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                # Replace any reversed URLs with direct paths
                if 'api_' + model_name in response.url or 'admin/api/' + model_name in response.url:
                    # Create a new HttpResponseRedirect with the corrected URL
                    return HttpResponseRedirect('/admin/api/%s/' % model_name)
            return response
        
        def changelist_view(self, request, extra_context=None):
            """
            Override changelist_view to ensure table is synced and model is registered.
            """
            # Ensure model is registered in admin (in case registration failed earlier)
            try:
                if model_class not in admin.site._registry:
                    import sys
                    print("Model %s not in admin registry, registering now..." % part_name, file=sys.stderr)
                    register_dynamic_model_in_admin(model_class, part_name)
            except Exception as e:
                import sys
                print("Warning: Could not ensure admin registration: %s" % str(e), file=sys.stderr)
            
            # Sync table to ensure all columns exist
            from api.dynamic_model_utils import create_dynamic_table_in_db
            try:
                create_dynamic_table_in_db(model_class)
            except Exception as e:
                import sys
                print("Warning: Could not sync table: %s" % str(e), file=sys.stderr)
            
            return super().changelist_view(request, extra_context)
        
        def add_view(self, request, form_url='', extra_context=None):
            """
            Override add_view to ensure table is synced before adding and handle URL reversing.
            """
            # Ensure table has all required columns
            from api.dynamic_model_utils import create_dynamic_table_in_db
            try:
                create_dynamic_table_in_db(model_class)
            except Exception as e:
                import sys
                print("Warning: Could not sync table for %s: %s" % (part_name, str(e)), file=sys.stderr)
            
            # Patch extra_context to fix URL reversing in templates
            if extra_context is None:
                extra_context = {}
            
            model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
            # Override the changelist URL in the context
            extra_context['changelist_url'] = '/admin/api/%s/' % model_name
            
            return super().add_view(request, form_url, extra_context)
    
    # Register the model
    try:
        # Unregister first if it exists (to avoid AlreadyRegistered error)
        try:
            if model_class in admin.site._registry:
                admin.site.unregister(model_class)
                import sys
                print("Unregistered existing model %s before re-registering" % part_name, file=sys.stderr)
        except:
            pass
        
        # Ensure model has correct app_label and is properly configured
        if not hasattr(model_class._meta, 'app_label') or model_class._meta.app_label != 'api':
            model_class._meta.app_label = 'api'
        
        # Set model_name if not set (needed for admin URLs)
        # Django admin uses the lowercase class name for URLs, not the table name
        # So we need to ensure model_name matches the lowercase class name
        if not hasattr(model_class._meta, 'model_name'):
            # Use the lowercase class name for model_name (this is what Django admin uses for URLs)
            class_name_lower = model_class.__name__.lower()
            model_class._meta.model_name = class_name_lower
        
        # Ensure verbose_name is set (this is what shows in admin index)
        if not hasattr(model_class._meta, 'verbose_name') or not model_class._meta.verbose_name:
            model_class._meta.verbose_name = part_name
        if not hasattr(model_class._meta, 'verbose_name_plural') or not model_class._meta.verbose_name_plural:
            model_class._meta.verbose_name_plural = f'{part_name} Entries'
        
        # Note: Model should already be in Django's app registry from create_dynamic_part_model
        # We don't add it here to avoid duplicates - the model registration in 
        # django_apps.all_models and api.models happens in dynamic_models.py
        # We only register it in Django admin here
        
        # Register the model - handle AlreadyRegistered gracefully
        try:
            admin.site.register(model_class, DynamicModelAdmin)
        except AlreadyRegistered:
            # Model already registered, unregister and re-register to ensure it's up to date
            try:
                admin.site.unregister(model_class)
                admin.site.register(model_class, DynamicModelAdmin)
                import sys
                print("Re-registered %s in admin" % part_name, file=sys.stderr)
            except Exception as e:
                import sys
                print("Warning: Could not re-register %s: %s" % (part_name, str(e)), file=sys.stderr)
        except Exception as reg_error:
            import sys
            print("Warning: Registration error for %s: %s" % (part_name, str(reg_error)), file=sys.stderr)
            # Try to register directly in registry as fallback
            try:
                admin.site._registry[model_class] = DynamicModelAdmin(model_class, admin.site)
            except:
                pass
        
        # Force admin to recognize the model by updating its internal structures
        try:
            # Ensure the model is in admin's _registry
            if model_class not in admin.site._registry:
                admin.site._registry[model_class] = DynamicModelAdmin(model_class, admin.site)
            
            # Clear admin's app_dict cache to force rebuild on next request
            # This ensures the model appears in admin index immediately
            if hasattr(admin.site, '_app_dict'):
                delattr(admin.site, '_app_dict')
            
            # Also clear any per-request caches
            if hasattr(admin.site, '_registry'):
                # Force admin to rebuild its app list on next request
                pass
            
            # Ensure model_name is set correctly (Django admin uses this for URLs)
            if not hasattr(model_class._meta, 'model_name') or not model_class._meta.model_name:
                model_class._meta.model_name = model_class.__name__.lower()
            
            # Verify the model is in Django's app registry with the correct key
            from django.apps import apps as django_apps
            model_key = model_class.__name__.lower()
            if 'api' in django_apps.all_models and model_key in django_apps.all_models['api']:
                # Model is registered correctly
                pass
            else:
                # Re-register in app registry
                if 'api' not in django_apps.all_models:
                    django_apps.all_models['api'] = {}
                django_apps.all_models['api'][model_key] = model_class
                import sys
                print("Re-registered model %s in app registry with key: %s" % (part_name, model_key), file=sys.stderr)
        except Exception as e:
            import sys
            print("Warning: Could not update admin registry cache: %s" % str(e), file=sys.stderr)
        
        import sys
        # Use model_name (lowercase class name) for admin URL
        model_name_for_url = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
        admin_url = f"/admin/api/{model_name_for_url}/"
        print("=" * 80, file=sys.stderr)
        print("SUCCESS: Registered %s in admin" % part_name, file=sys.stderr)
        print("  - Admin URL: %s" % admin_url, file=sys.stderr)
        print("  - Table: %s" % model_class._meta.db_table, file=sys.stderr)
        print("  - App Label: %s" % model_class._meta.app_label, file=sys.stderr)
        print("  - Model Name: %s" % getattr(model_class._meta, 'model_name', 'N/A'), file=sys.stderr)
        print("  - Verbose Name: %s" % model_class._meta.verbose_name, file=sys.stderr)
        print("  - Fields: %d" % len(all_fields), file=sys.stderr)
        
        # Verify registration
        if model_class in admin.site._registry:
            print("  - VERIFIED: Model %s is in admin registry" % part_name, file=sys.stderr)
            print("  - Access at: %s" % admin_url, file=sys.stderr)
        else:
            print("  - WARNING: Model %s registered but not found in registry" % part_name, file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        
        return True
    except AlreadyRegistered:
        import sys
        print("Model %s already registered (AlreadyRegistered exception)" % part_name, file=sys.stderr)
        return True
    except Exception as e:
        # Model might already be registered or other error
        import sys
        import traceback
        print("ERROR: Could not register %s in admin: %s" % (part_name, str(e)), file=sys.stderr)
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        return False


def register_all_dynamic_models_in_admin():
    """
    Register all existing dynamic models in Django admin.
    This should be called when Django admin loads.
    """
    import sys
    print("=" * 80, file=sys.stderr)
    print("REGISTERING ALL DYNAMIC MODELS IN ADMIN", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    
    from .models import ModelPart
    
    registered_count = 0
    
    # Register models for all existing parts
    for model_part in ModelPart.objects.all():
        try:
            procedure_detail = PartProcedureDetail.objects.get(model_part=model_part)
            from .dynamic_models import get_dynamic_part_model, ensure_dynamic_model_exists
            from .dynamic_model_utils import get_or_create_part_data_model
            
            # Get or create both dynamic models
            models_dict = get_or_create_part_data_model(
                model_part.part_no,
                procedure_detail.get_enabled_sections(),
                procedure_detail.procedure_config,
                table_type=None  # Get both models
            )
            
            # Register in_process model
            if models_dict.get('in_process'):
                in_process_model = models_dict['in_process']
                result = register_dynamic_model_in_admin(in_process_model, f"{model_part.part_no}_in_process")
                if result:
                    registered_count += 1
                    print("Registered: %s (in_process)" % model_part.part_no, file=sys.stderr)
            
            # Register completion model
            if models_dict.get('completion'):
                completion_model = models_dict['completion']
                result = register_dynamic_model_in_admin(completion_model, f"{model_part.part_no}_completion")
                if result:
                    registered_count += 1
                    print("Registered: %s (completion)" % model_part.part_no, file=sys.stderr)
        except PartProcedureDetail.DoesNotExist:
            print("Skipping %s - no procedure_detail" % model_part.part_no, file=sys.stderr)
            continue
        except Exception as e:
            print("Error registering %s: %s" % (model_part.part_no, str(e)), file=sys.stderr)
            import traceback
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
            continue
    
    # Also register any models in the registry that might not have ModelPart records yet
    all_models = DynamicModelRegistry.get_all()
    for part_name, models_dict in all_models.items():
        # models_dict is now {'in_process': model, 'completion': model}
        for table_type, model_class in models_dict.items():
            if model_class:
                # Check if already registered
                is_registered = any(
                    registered_model == model_class 
                    for registered_model in admin.site._registry.keys()
                )
                if not is_registered:
                    result = register_dynamic_model_in_admin(model_class, f"{part_name}_{table_type}")
                    if result:
                        registered_count += 1
    
    print("Total registered: %d dynamic models" % registered_count, file=sys.stderr)
    print("=" * 80, file=sys.stderr)


# Monkey-patch Django's reverse function to handle dynamic model URLs
_original_reverse = reverse

def reverse_with_dynamic_models(viewname, urlconf=None, args=None, kwargs=None, current_app=None):
    """
    Custom reverse function that handles dynamic model URLs.
    """
    try:
        # Try the original reverse first
        return _original_reverse(viewname, urlconf, args, kwargs, current_app)
    except NoReverseMatch:
        # If it fails, check if it's a dynamic model URL
        # Handle both 'admin:' prefix and direct view names
        is_admin_url = viewname.startswith('admin:')
        viewname_str = str(viewname)
        
        # Early check for common dynamic model URL patterns
        # e.g., "api_eics144_partinprocess_add" or "admin:api_eics144_partinprocess_add"
        if 'partinprocess' in viewname_str.lower() or 'partcompletion' in viewname_str.lower() or 'part_inprocess' in viewname_str.lower() or 'part_completion' in viewname_str.lower():
            # Extract the URL name (part after 'admin:' if present)
            if is_admin_url:
                parts = viewname_str.split(':')
                if len(parts) == 2:
                    url_name = parts[1]
                else:
                    url_name = viewname_str
            else:
                url_name = viewname_str
            
            # Check if it matches pattern: api_<model_name>_<action>
            if url_name.startswith('api_') and url_name.count('_') >= 2:
                url_parts = url_name.split('_')
                if len(url_parts) >= 3:
                    # Reconstruct model name (everything between 'api' and last part)
                    model_name_from_url = '_'.join(url_parts[1:-1])
                    action = url_parts[-1]
                    
                    # CRITICAL: First, try to find and register the model if it's not in admin registry
                    # This ensures models are available even if they haven't been registered yet
                    from .dynamic_models import DynamicModelRegistry
                    all_dynamic_models = DynamicModelRegistry.get_all()
                    
                    # Try to find matching model in DynamicModelRegistry first
                    # This catches models that exist but aren't registered in admin yet
                    found_model = None
                    found_model_name = None
                    
                    # Extract part name from URL (e.g., "eics112" from "eics112_partinprocess")
                    url_lower_check = model_name_from_url.lower()
                    part_name_candidate = None
                    table_type_candidate = None
                    
                    # Try multiple patterns to extract part name
                    if 'partinprocess' in url_lower_check or 'part_inprocess' in url_lower_check or ('inprocess' in url_lower_check and 'completion' not in url_lower_check):
                        table_type_candidate = 'in_process'
                        # Try different patterns in order of specificity
                        for pattern in ['partinprocess', 'part_inprocess', 'inprocess', '_inprocess']:
                            if pattern in url_lower_check:
                                idx = url_lower_check.find(pattern)
                                if idx > 0:
                                    part_name_candidate = url_lower_check[:idx].rstrip('_')
                                    # Remove 'api_' prefix if present
                                    if part_name_candidate.startswith('api_'):
                                        part_name_candidate = part_name_candidate[4:].rstrip('_')
                                    break
                        # If still not found, try to extract from the beginning
                        if not part_name_candidate:
                            # Remove common suffixes
                            temp = url_lower_check
                            for suffix in ['partinprocess', 'part_inprocess', 'inprocess', '_inprocess']:
                                if temp.endswith(suffix):
                                    temp = temp[:-len(suffix)].rstrip('_')
                                    break
                            if temp and temp != url_lower_check:
                                part_name_candidate = temp
                    elif 'partcompletion' in url_lower_check or 'part_completion' in url_lower_check or ('completion' in url_lower_check and 'inprocess' not in url_lower_check):
                        table_type_candidate = 'completion'
                        # Try different patterns in order of specificity
                        for pattern in ['partcompletion', 'part_completion', 'completion']:
                            if pattern in url_lower_check:
                                idx = url_lower_check.find(pattern)
                                if idx > 0:
                                    part_name_candidate = url_lower_check[:idx].rstrip('_')
                                    # Remove 'api_' prefix if present
                                    if part_name_candidate.startswith('api_'):
                                        part_name_candidate = part_name_candidate[4:].rstrip('_')
                                    break
                        # If still not found, try to extract from the beginning
                        if not part_name_candidate:
                            # Remove common suffixes
                            temp = url_lower_check
                            for suffix in ['partcompletion', 'part_completion', 'completion']:
                                if temp.endswith(suffix):
                                    temp = temp[:-len(suffix)].rstrip('_')
                                    break
                            if temp and temp != url_lower_check:
                                part_name_candidate = temp
                    
                    # Search DynamicModelRegistry for matching model
                    if part_name_candidate and table_type_candidate:
                        # Normalize candidate for comparison
                        candidate_normalized = part_name_candidate.replace('_', '').replace('-', '').lower()
                        
                        for part_name, models_dict in all_dynamic_models.items():
                            # Normalize part names for comparison - try multiple strategies
                            part_normalized = part_name.lower().replace('_', '').replace('-', '')
                            
                            # Also check if part_name contains the candidate or vice versa
                            # e.g., "EICS112_Part" should match "eics112"
                            part_base = part_name.lower().split('_')[0] if '_' in part_name.lower() else part_name.lower()
                            
                            # Check multiple matching strategies
                            if (part_normalized == candidate_normalized or 
                                candidate_normalized in part_normalized or 
                                part_normalized in candidate_normalized or
                                part_base == candidate_normalized or
                                candidate_normalized in part_base):
                                if table_type_candidate in models_dict and models_dict[table_type_candidate]:
                                    found_model = models_dict[table_type_candidate]
                                    found_model_name = getattr(found_model._meta, 'model_name', found_model.__name__.lower())
                                    # Ensure it's registered in admin
                                    if found_model not in admin.site._registry:
                                        try:
                                            import sys
                                            print("Auto-registering model %s from DynamicModelRegistry for URL reverse" % found_model_name, file=sys.stderr)
                                            register_dynamic_model_in_admin(found_model, f"{part_name}_{table_type_candidate}")
                                        except Exception as e:
                                            import sys
                                            print("Warning: Could not auto-register model: %s" % str(e), file=sys.stderr)
                                    break
                    
                    # If we found a model in DynamicModelRegistry, use it
                    if found_model and found_model_name:
                        # Build URL using the found model
                        if action == 'changelist':
                            return '/admin/api/%s/' % found_model_name
                        elif action == 'add':
                            return '/admin/api/%s/add/' % found_model_name
                        elif action == 'change':
                            object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                            if object_id:
                                return '/admin/api/%s/%s/' % (found_model_name, object_id)
                            return '/admin/api/%s/' % found_model_name
                        elif action == 'delete':
                            object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                            if object_id:
                                return '/admin/api/%s/%s/delete/' % (found_model_name, object_id)
                            return '/admin/api/%s/' % found_model_name
                        else:
                            return '/admin/api/%s/' % found_model_name
                    
                    # Now try to find matching model in admin registry (fastest for already registered models)
                    for registered_model in admin.site._registry.keys():
                        if registered_model._meta.app_label != 'api':
                            continue
                        
                        registered_class_name = registered_model.__name__.lower()
                        registered_model_name = getattr(registered_model._meta, 'model_name', registered_class_name)
                        
                        # Normalize both names for comparison
                        normalized_url = model_name_from_url.lower().replace('_', '')
                        normalized_registered = registered_model_name.replace('_', '').lower()
                        normalized_class = registered_class_name.replace('_', '').lower()
                        
                        # Check if this is an in_process model
                        # Handle patterns like: api_eics120_partinprocess_add, api_eics120_part_inprocess_add
                        url_lower = url_name.lower()
                        is_inprocess_url = ('partinprocess' in url_lower or 'part_inprocess' in url_lower or 
                                           ('inprocess' in url_lower and 'completion' not in url_lower))
                        is_inprocess_model = ('inprocess' in normalized_registered or 'in_process' in registered_model_name.lower() or
                                            'inprocess' in registered_class_name or 'in_process' in registered_class_name)
                        
                        if is_inprocess_url and is_inprocess_model:
                            # Extract part names - try multiple strategies
                            # Strategy 1: Remove "partinprocess" or "part_inprocess" from URL
                            url_part = None
                            for pattern in ['partinprocess', 'part_inprocess', 'inprocess', '_inprocess']:
                                if pattern in normalized_url:
                                    url_part = normalized_url.split(pattern)[0].rstrip('_')
                                    break
                            if not url_part:
                                url_part = normalized_url
                            
                            # Strategy 2: Extract from registered model name
                            reg_part = None
                            for pattern in ['partinprocess', 'part_inprocess', 'inprocess', '_inprocess']:
                                if pattern in normalized_registered:
                                    reg_part = normalized_registered.split(pattern)[0].rstrip('_')
                                    break
                            if not reg_part:
                                reg_part = normalized_registered.split('part')[0].rstrip('_') if 'part' in normalized_registered else normalized_registered
                            
                            # Match if parts are similar (handle underscore variations)
                            if url_part and reg_part:
                                # Normalize for comparison (remove all underscores)
                                url_part_clean = url_part.replace('_', '').lower()
                                reg_part_clean = reg_part.replace('_', '').lower()
                                
                                # Also check if one contains the other (for cases like eics120 vs eics120_part)
                                if (url_part_clean == reg_part_clean or 
                                    url_part_clean in reg_part_clean or 
                                    reg_part_clean in url_part_clean):
                                    # Found match, build URL
                                    if action == 'changelist':
                                        return '/admin/api/%s/' % registered_model_name
                                    elif action == 'add':
                                        return '/admin/api/%s/add/' % registered_model_name
                                    elif action == 'change':
                                        object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                        if object_id:
                                            return '/admin/api/%s/%s/' % (registered_model_name, object_id)
                                        return '/admin/api/%s/' % registered_model_name
                                    elif action == 'delete':
                                        object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                        if object_id:
                                            return '/admin/api/%s/%s/delete/' % (registered_model_name, object_id)
                                        return '/admin/api/%s/' % registered_model_name
                                    else:
                                        return '/admin/api/%s/' % registered_model_name
                        
                        # Check if this is a completion model
                        # Handle patterns like: api_eics120_partcompletion_add, api_eics120_part_completion_add
                        url_lower = url_name.lower()
                        is_completion_url = ('partcompletion' in url_lower or 'part_completion' in url_lower or 
                                            ('completion' in url_lower and 'inprocess' not in url_lower))
                        is_completion_model = ('completion' in normalized_registered and 'inprocess' not in normalized_registered and
                                             'completion' in registered_class_name and 'inprocess' not in registered_class_name)
                        
                        if is_completion_url and is_completion_model:
                            # Extract part names - try multiple strategies
                            # Strategy 1: Remove "partcompletion" or "part_completion" from URL
                            url_part = None
                            for pattern in ['partcompletion', 'part_completion', 'completion']:
                                if pattern in normalized_url:
                                    url_part = normalized_url.split(pattern)[0].rstrip('_')
                                    break
                            if not url_part:
                                url_part = normalized_url
                            
                            # Strategy 2: Extract from registered model name
                            reg_part = None
                            for pattern in ['partcompletion', 'part_completion', 'completion']:
                                if pattern in normalized_registered:
                                    reg_part = normalized_registered.split(pattern)[0].rstrip('_')
                                    break
                            if not reg_part:
                                reg_part = normalized_registered.split('part')[0].rstrip('_') if 'part' in normalized_registered else normalized_registered
                            
                            # Match if parts are similar (handle underscore variations)
                            if url_part and reg_part:
                                # Normalize for comparison (remove all underscores)
                                url_part_clean = url_part.replace('_', '').lower()
                                reg_part_clean = reg_part.replace('_', '').lower()
                                
                                # Also check if one contains the other (for cases like eics120 vs eics120_part)
                                if (url_part_clean == reg_part_clean or 
                                    url_part_clean in reg_part_clean or 
                                    reg_part_clean in url_part_clean):
                                    # Found match, build URL
                                    if action == 'changelist':
                                        return '/admin/api/%s/' % registered_model_name
                                    elif action == 'add':
                                        return '/admin/api/%s/add/' % registered_model_name
                                    elif action == 'change':
                                        object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                        if object_id:
                                            return '/admin/api/%s/%s/' % (registered_model_name, object_id)
                                        return '/admin/api/%s/' % registered_model_name
                                    elif action == 'delete':
                                        object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                        if object_id:
                                            return '/admin/api/%s/%s/delete/' % (registered_model_name, object_id)
                                        return '/admin/api/%s/' % registered_model_name
                                    else:
                                        return '/admin/api/%s/' % registered_model_name
                
                # Aggressive fallback: If we haven't found a match yet, search all registered models
                # This handles cases where the URL pattern doesn't exactly match but the model exists
                if 'partinprocess' in url_name.lower() or 'part_inprocess' in url_name.lower():
                    # Extract part name from URL (e.g., "eics120" from "api_eics120_partinprocess_add")
                    url_lower = url_name.lower()
                    part_name_candidate = None
                    for pattern in ['partinprocess', 'part_inprocess']:
                        if pattern in url_lower:
                            # Extract everything before the pattern
                            idx = url_lower.find(pattern)
                            if idx > 0:
                                # Get the part after 'api_' and before the pattern
                                prefix = url_lower[:idx].rstrip('_')
                                if prefix.startswith('api_'):
                                    part_name_candidate = prefix[4:].rstrip('_')
                                else:
                                    part_name_candidate = prefix
                            break
                    
                    # Search all registered models for matching inprocess model
                    if part_name_candidate:
                        for registered_model in admin.site._registry.keys():
                            if registered_model._meta.app_label != 'api':
                                continue
                            
                            registered_class_name = registered_model.__name__.lower()
                            registered_model_name = getattr(registered_model._meta, 'model_name', registered_class_name)
                            
                            # Check if this is an inprocess model
                            if ('inprocess' in registered_class_name or 'in_process' in registered_class_name) and 'completion' not in registered_class_name:
                                # Extract part name from registered model
                                registered_part = None
                                for pattern in ['partinprocess', 'part_inprocess', 'inprocess', '_inprocess']:
                                    if pattern in registered_class_name:
                                        registered_part = registered_class_name.split(pattern)[0].rstrip('_')
                                        break
                                
                                if registered_part:
                                    # Normalize for comparison
                                    url_part_clean = part_name_candidate.replace('_', '').lower()
                                    reg_part_clean = registered_part.replace('_', '').lower()
                                    
                                    if url_part_clean == reg_part_clean or url_part_clean in reg_part_clean or reg_part_clean in url_part_clean:
                                        # Found match!
                                        if action == 'changelist':
                                            return '/admin/api/%s/' % registered_model_name
                                        elif action == 'add':
                                            return '/admin/api/%s/add/' % registered_model_name
                                        elif action == 'change':
                                            object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                            if object_id:
                                                return '/admin/api/%s/%s/' % (registered_model_name, object_id)
                                            return '/admin/api/%s/' % registered_model_name
                                        elif action == 'delete':
                                            object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                            if object_id:
                                                return '/admin/api/%s/%s/delete/' % (registered_model_name, object_id)
                                            return '/admin/api/%s/' % registered_model_name
                                        else:
                                            return '/admin/api/%s/' % registered_model_name
                
                # Similar aggressive fallback for completion models
                if 'partcompletion' in url_name.lower() or 'part_completion' in url_name.lower():
                    # Extract part name from URL
                    url_lower = url_name.lower()
                    part_name_candidate = None
                    for pattern in ['partcompletion', 'part_completion']:
                        if pattern in url_lower:
                            idx = url_lower.find(pattern)
                            if idx > 0:
                                prefix = url_lower[:idx].rstrip('_')
                                if prefix.startswith('api_'):
                                    part_name_candidate = prefix[4:].rstrip('_')
                                else:
                                    part_name_candidate = prefix
                            break
                    
                    # Search all registered models for matching completion model
                    if part_name_candidate:
                        for registered_model in admin.site._registry.keys():
                            if registered_model._meta.app_label != 'api':
                                continue
                            
                            registered_class_name = registered_model.__name__.lower()
                            registered_model_name = getattr(registered_model._meta, 'model_name', registered_class_name)
                            
                            # Check if this is a completion model
                            if 'completion' in registered_class_name and 'inprocess' not in registered_class_name:
                                # Extract part name from registered model
                                registered_part = None
                                for pattern in ['partcompletion', 'part_completion', 'completion']:
                                    if pattern in registered_class_name:
                                        registered_part = registered_class_name.split(pattern)[0].rstrip('_')
                                        break
                                
                                if registered_part:
                                    # Normalize for comparison
                                    url_part_clean = part_name_candidate.replace('_', '').lower()
                                    reg_part_clean = registered_part.replace('_', '').lower()
                                    
                                    if url_part_clean == reg_part_clean or url_part_clean in reg_part_clean or reg_part_clean in url_part_clean:
                                        # Found match!
                                        if action == 'changelist':
                                            return '/admin/api/%s/' % registered_model_name
                                        elif action == 'add':
                                            return '/admin/api/%s/add/' % registered_model_name
                                        elif action == 'change':
                                            object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                            if object_id:
                                                return '/admin/api/%s/%s/' % (registered_model_name, object_id)
                                            return '/admin/api/%s/' % registered_model_name
                                        elif action == 'delete':
                                            object_id = args[0] if args and len(args) > 0 else (kwargs.get('object_id') if kwargs else None)
                                            if object_id:
                                                return '/admin/api/%s/%s/delete/' % (registered_model_name, object_id)
                                            return '/admin/api/%s/' % registered_model_name
                                        else:
                                            return '/admin/api/%s/' % registered_model_name
        
        if (is_admin_url or 'api_' in viewname_str) and '_' in viewname_str:
            # Extract the URL name (part after 'admin:' if present)
            if is_admin_url:
                parts = str(viewname).split(':')
                if len(parts) == 2:
                    url_name = parts[1]
                else:
                    url_name = str(viewname)
            else:
                url_name = str(viewname)
            
            # Check if it matches pattern: api_<model_name>_<action>
            if url_name.startswith('api_') and url_name.count('_') >= 2:
                    url_parts = url_name.split('_')
                    if len(url_parts) >= 3:
                        # Reconstruct model name (everything between 'api' and last part)
                        model_name_from_url = '_'.join(url_parts[1:-1])
                        action = url_parts[-1]
                        
                        # Handle special cases: partinprocess, partcompletion patterns
                        # e.g., "api_eics144_partinprocess_add" -> model_name: "eics144_partinprocess"
                        # But we need to find the actual model which might be "eics144partinprocess" or "eics144_partinprocess"
                        # First, try to normalize the model name
                        if 'partinprocess' in model_name_from_url.lower() or 'part_inprocess' in model_name_from_url.lower():
                            # Extract part name and normalize
                            normalized = model_name_from_url.lower().replace('_', '')
                            # Try to find matching in_process model
                            from django.apps import apps as django_apps
                            if 'api' in django_apps.all_models:
                                for registered_key, registered_model in django_apps.all_models['api'].items():
                                    registered_normalized = registered_key.replace('_', '').lower()
                                    if ('inprocess' in registered_normalized or 'in_process' in registered_key.lower()) and normalized.startswith(registered_normalized.split('inprocess')[0].split('in_process')[0]):
                                        # Found matching model, use its actual model_name
                                        actual_model_name = getattr(registered_model._meta, 'model_name', registered_key)
                                        model_name_from_url = actual_model_name
                                        break
                        
                        if 'partcompletion' in model_name_from_url.lower() or 'part_completion' in model_name_from_url.lower():
                            # Extract part name and normalize
                            normalized = model_name_from_url.lower().replace('_', '')
                            # Try to find matching completion model
                            from django.apps import apps as django_apps
                            if 'api' in django_apps.all_models:
                                for registered_key, registered_model in django_apps.all_models['api'].items():
                                    registered_normalized = registered_key.replace('_', '').lower()
                                    if 'completion' in registered_normalized and normalized.startswith(registered_normalized.split('completion')[0]):
                                        # Found matching model, use its actual model_name
                                        actual_model_name = getattr(registered_model._meta, 'model_name', registered_key)
                                        model_name_from_url = actual_model_name
                                        break
                        
                        # Try to find the actual model by searching through registered models
                        # This handles variations in model names (with/without underscores)
                        actual_model_name = None
                        from django.apps import apps as django_apps
                        from .dynamic_models import DynamicModelRegistry
                        
                        # Normalize the model name from URL (remove underscores for comparison)
                        normalized_url_name = model_name_from_url.lower().replace('_', '')
                        
                        # First, try exact match in Django's app registry
                        if 'api' in django_apps.all_models:
                            for registered_key, registered_model in django_apps.all_models['api'].items():
                                # Exact match
                                if registered_key == model_name_from_url.lower():
                                    actual_model_name = registered_key
                                    break
                                # Normalized match (handles underscore variations)
                                normalized_registered = registered_key.replace('_', '')
                                if normalized_registered == normalized_url_name:
                                    actual_model_name = registered_key
                                    break
                        
                        # If not found, search in DynamicModelRegistry and admin registry
                        if actual_model_name is None:
                            # Extract part name and table type from URL model name
                            # e.g., "eics120_partinprocess" -> part: "eics120", type: "in_process"
                            # e.g., "eics120_partcompletion" -> part: "eics120", type: "completion"
                            url_lower = model_name_from_url.lower()
                            
                            # Try to extract part name by removing known suffixes
                            part_name_candidates = []
                            table_type_candidates = []
                            
                            # Check for "partinprocess" or "part_inprocess" pattern
                            if 'partinprocess' in url_lower or 'part_inprocess' in url_lower:
                                # Remove "partinprocess" or "part_inprocess" to get part name
                                for suffix in ['partinprocess', 'part_inprocess', '_partinprocess', '_part_inprocess']:
                                    if url_lower.endswith(suffix):
                                        candidate = url_lower[:-len(suffix)].rstrip('_')
                                        if candidate:
                                            part_name_candidates.append(candidate)
                                            table_type_candidates.append('in_process')
                                            break
                            
                            # Check for "partcompletion" or "part_completion" pattern
                            if 'partcompletion' in url_lower or 'part_completion' in url_lower:
                                for suffix in ['partcompletion', 'part_completion', '_partcompletion', '_part_completion']:
                                    if url_lower.endswith(suffix):
                                        candidate = url_lower[:-len(suffix)].rstrip('_')
                                        if candidate:
                                            part_name_candidates.append(candidate)
                                            table_type_candidates.append('completion')
                                            break
                            
                            # Also check admin registry - this is important for ForeignKey widgets
                            # This is the most reliable source since it contains all registered models
                            for registered_model in admin.site._registry.keys():
                                if registered_model._meta.app_label != 'api':
                                    continue
                                
                                class_name_lower = registered_model.__name__.lower()
                                model_name_attr = getattr(registered_model._meta, 'model_name', class_name_lower)
                                
                                # Check exact match
                                if (model_name_attr == model_name_from_url.lower() or 
                                    class_name_lower == model_name_from_url.lower()):
                                    actual_model_name = model_name_attr
                                    break
                                
                                # Check normalized match (remove all underscores)
                                normalized_class = class_name_lower.replace('_', '')
                                normalized_model_attr = model_name_attr.replace('_', '')
                                if (normalized_class == normalized_url_name or 
                                    normalized_model_attr == normalized_url_name):
                                    actual_model_name = model_name_attr
                                    break
                                
                                # Improved matching: Extract part name and table type from both URL and model
                                url_lower_check = model_name_from_url.lower()
                                
                                # Helper function to extract part name from a string
                                def extract_part_name(s, is_in_process=False, is_completion=False):
                                    """Extract part name from model name string."""
                                    s_lower = s.lower()
                                    # Try different patterns
                                    patterns = []
                                    if is_in_process:
                                        patterns = ['partinprocess', 'part_inprocess', '_partinprocess', '_part_inprocess', 'inprocess', 'in_process']
                                    elif is_completion:
                                        patterns = ['partcompletion', 'part_completion', '_partcompletion', '_part_completion', 'completion']
                                    else:
                                        patterns = ['partinprocess', 'part_inprocess', '_partinprocess', '_part_inprocess', 
                                                   'partcompletion', 'part_completion', '_partcompletion', '_part_completion',
                                                   'inprocess', 'in_process', 'completion']
                                    
                                    for pattern in patterns:
                                        if pattern in s_lower:
                                            # Split on pattern and take the part before it
                                            parts = s_lower.split(pattern)
                                            if parts and parts[0]:
                                                return parts[0].rstrip('_')
                                    # Fallback: try to extract by removing known suffixes
                                    for suffix in ['partinprocess', 'part_inprocess', 'partcompletion', 'part_completion', 
                                                   'inprocess', 'in_process', 'completion']:
                                        if s_lower.endswith(suffix):
                                            return s_lower[:-len(suffix)].rstrip('_')
                                    return None
                                
                                # Check for in_process patterns
                                url_is_in_process = 'partinprocess' in url_lower_check or 'part_inprocess' in url_lower_check or ('inprocess' in url_lower_check and 'completion' not in url_lower_check)
                                model_is_in_process = 'inprocess' in class_name_lower or 'in_process' in class_name_lower
                                
                                if url_is_in_process and model_is_in_process:
                                    url_part = extract_part_name(url_lower_check, is_in_process=True)
                                    model_part = extract_part_name(class_name_lower, is_in_process=True)
                                    
                                    if url_part and model_part:
                                        # Normalize part names for comparison
                                        url_part_norm = url_part.replace('_', '').lower()
                                        model_part_norm = model_part.replace('_', '').lower()
                                        if url_part_norm == model_part_norm:
                                            actual_model_name = model_name_attr
                                            break
                                
                                # Check for completion patterns
                                url_is_completion = 'partcompletion' in url_lower_check or 'part_completion' in url_lower_check or ('completion' in url_lower_check and 'inprocess' not in url_lower_check and 'in_process' not in url_lower_check)
                                model_is_completion = 'completion' in class_name_lower and 'inprocess' not in class_name_lower and 'in_process' not in class_name_lower
                                
                                if url_is_completion and model_is_completion:
                                    url_part = extract_part_name(url_lower_check, is_completion=True)
                                    model_part = extract_part_name(class_name_lower, is_completion=True)
                                    
                                    if url_part and model_part:
                                        # Normalize part names for comparison
                                        url_part_norm = url_part.replace('_', '').lower()
                                        model_part_norm = model_part.replace('_', '').lower()
                                        if url_part_norm == model_part_norm:
                                            actual_model_name = model_name_attr
                                            break
                                
                                # Fallback: Check if URL contains key parts of the model name
                                # e.g., "eics120_partinprocess" should match "EICS120_PartInProcess"
                                if 'partinprocess' in url_lower_check or 'part_inprocess' in url_lower_check:
                                    if 'inprocess' in class_name_lower or 'in_process' in class_name_lower:
                                        # Check if the part name matches (everything before "part")
                                        url_part_match = url_lower_check.split('part')[0].rstrip('_') if 'part' in url_lower_check else None
                                        class_part_match = class_name_lower.split('part')[0].rstrip('_') if 'part' in class_name_lower else None
                                        if url_part_match and class_part_match and url_part_match == class_part_match:
                                            actual_model_name = model_name_attr
                                            break
                                
                                if 'partcompletion' in url_lower_check or 'part_completion' in url_lower_check:
                                    if 'completion' in class_name_lower:
                                        # Check if the part name matches
                                        url_part_match = url_lower_check.split('part')[0].rstrip('_') if 'part' in url_lower_check else None
                                        class_part_match = class_name_lower.split('part')[0].rstrip('_') if 'part' in class_name_lower else None
                                        if url_part_match and class_part_match and url_part_match == class_part_match:
                                            actual_model_name = model_name_attr
                                            break
                            
                            # If still not found, search in DynamicModelRegistry
                            if actual_model_name is None:
                                all_models = DynamicModelRegistry.get_all()
                                
                                # First, try matching by part name if we extracted it
                                for part_candidate, table_type_candidate in zip(part_name_candidates, table_type_candidates):
                                    if part_candidate in all_models:
                                        models_dict = all_models[part_candidate]
                                        if table_type_candidate in models_dict and models_dict[table_type_candidate]:
                                            model_class = models_dict[table_type_candidate]
                                            model_name_attr = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                                            actual_model_name = model_name_attr
                                            break
                                
                                # If still not found, try all models
                                if actual_model_name is None:
                                    for part_name, models_dict in all_models.items():
                                        for table_type, model_class in models_dict.items():
                                            if model_class is None:
                                                continue
                                            
                                            # Get model name variations
                                            class_name_lower = model_class.__name__.lower()
                                            model_name_attr = getattr(model_class._meta, 'model_name', class_name_lower)
                                            
                                            # Check exact match
                                            if (model_name_attr == model_name_from_url.lower() or 
                                                class_name_lower == model_name_from_url.lower()):
                                                actual_model_name = model_name_attr
                                                break
                                            
                                            # Check normalized match
                                            normalized_class = class_name_lower.replace('_', '')
                                            normalized_model_attr = model_name_attr.replace('_', '')
                                            if (normalized_class == normalized_url_name or 
                                                normalized_model_attr == normalized_url_name):
                                                actual_model_name = model_name_attr
                                                break
                                            
                                            # Check if URL name contains keywords (for variations like partinprocess vs part_in_process)
                                            # Handle "inprocess" or "in_process" variations
                                            if ('inprocess' in normalized_url_name or 'in_process' in model_name_from_url.lower()):
                                                if ('inprocess' in normalized_class or 'in_process' in class_name_lower):
                                                    if table_type == 'in_process':
                                                        # Also check if part name matches
                                                        normalized_part = part_name.lower().replace('_', '')
                                                        if normalized_part in normalized_url_name or normalized_part in model_name_from_url.lower():
                                                            actual_model_name = model_name_attr
                                                            break
                                            
                                            # Handle "completion" variations
                                            if 'completion' in normalized_url_name or 'completion' in model_name_from_url.lower():
                                                if 'completion' in normalized_class or 'completion' in class_name_lower:
                                                    if table_type == 'completion':
                                                        # Also check if part name matches
                                                        normalized_part = part_name.lower().replace('_', '')
                                                        if normalized_part in normalized_url_name or normalized_part in model_name_from_url.lower():
                                                            actual_model_name = model_name_attr
                                                            break
                                        
                                        if actual_model_name:
                                            break
                        
                        # If we still don't have a match, try to find the model by searching for the part name
                        # This handles cases like "eics112_partinprocess" where we need to find "eics112partinprocess"
                        if actual_model_name is None:
                            # Try to extract part name from URL and find matching model
                            url_lower = model_name_from_url.lower()
                            
                            # Check for in_process patterns
                            if 'partinprocess' in url_lower or 'part_inprocess' in url_lower:
                                # Extract part name (everything before "part")
                                part_match = re.search(r'^(.+?)(?:part|_part)', url_lower)
                                if part_match:
                                    part_candidate = part_match.group(1).rstrip('_')
                                    # Search for in_process model with this part name
                                    all_models = DynamicModelRegistry.get_all()
                                    for part_name, models_dict in all_models.items():
                                        if part_name.lower().replace('_', '') == part_candidate.replace('_', ''):
                                            if 'in_process' in models_dict and models_dict['in_process']:
                                                model_class = models_dict['in_process']
                                                actual_model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                                                break
                            
                            # Check for completion patterns
                            if actual_model_name is None and ('partcompletion' in url_lower or 'part_completion' in url_lower):
                                # Extract part name (everything before "part")
                                part_match = re.search(r'^(.+?)(?:part|_part)', url_lower)
                                if part_match:
                                    part_candidate = part_match.group(1).rstrip('_')
                                    # Search for completion model with this part name
                                    all_models = DynamicModelRegistry.get_all()
                                    for part_name, models_dict in all_models.items():
                                        if part_name.lower().replace('_', '') == part_candidate.replace('_', ''):
                                            if 'completion' in models_dict and models_dict['completion']:
                                                model_class = models_dict['completion']
                                                actual_model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                                                break
                        
                        # If we still don't have a match, try one more time with more aggressive matching
                        # This handles cases like "eics144_partinprocess" where we need to find "eics144partinprocess"
                        if actual_model_name is None:
                            # Try to extract part name and find matching model
                            url_lower = model_name_from_url.lower()
                            
                            # Check for in_process patterns
                            if 'partinprocess' in url_lower or 'part_inprocess' in url_lower or 'inprocess' in url_lower:
                                # Extract part name (everything before "part" or "inprocess")
                                import re
                                part_match = re.search(r'^(.+?)(?:part|_part|inprocess|_inprocess)', url_lower)
                                if part_match:
                                    part_candidate = part_match.group(1).rstrip('_')
                                    # Search admin registry for matching in_process model
                                    for registered_model in admin.site._registry.keys():
                                        if registered_model._meta.app_label != 'api':
                                            continue
                                        registered_class_name = registered_model.__name__.lower()
                                        registered_model_name = getattr(registered_model._meta, 'model_name', registered_class_name)
                                        
                                        # Check if this is an in_process model for the same part
                                        if ('inprocess' in registered_class_name or 'in_process' in registered_class_name):
                                            # Extract part name from registered model
                                            registered_part_match = re.search(r'^(.+?)(?:part|_part|inprocess|_inprocess)', registered_class_name)
                                            if registered_part_match:
                                                registered_part = registered_part_match.group(1).rstrip('_')
                                                # Normalize for comparison
                                                if part_candidate.replace('_', '').lower() == registered_part.replace('_', '').lower():
                                                    actual_model_name = registered_model_name
                                                    break
                            
                            # Check for completion patterns
                            if actual_model_name is None and ('partcompletion' in url_lower or 'part_completion' in url_lower or 'completion' in url_lower):
                                import re
                                part_match = re.search(r'^(.+?)(?:part|_part|completion)', url_lower)
                                if part_match:
                                    part_candidate = part_match.group(1).rstrip('_')
                                    # Search admin registry for matching completion model
                                    for registered_model in admin.site._registry.keys():
                                        if registered_model._meta.app_label != 'api':
                                            continue
                                        registered_class_name = registered_model.__name__.lower()
                                        registered_model_name = getattr(registered_model._meta, 'model_name', registered_class_name)
                                        
                                        # Check if this is a completion model for the same part
                                        if 'completion' in registered_class_name and 'inprocess' not in registered_class_name:
                                            # Extract part name from registered model
                                            registered_part_match = re.search(r'^(.+?)(?:part|_part|completion)', registered_class_name)
                                            if registered_part_match:
                                                registered_part = registered_part_match.group(1).rstrip('_')
                                                # Normalize for comparison
                                                if part_candidate.replace('_', '').lower() == registered_part.replace('_', '').lower():
                                                    actual_model_name = registered_model_name
                                                    break
                        
                        # Use the found model name, or fall back to the URL model name
                        # Try to use the actual model name if found, otherwise use URL name
                        # The catch-all view should be able to handle variations
                        model_name = actual_model_name or model_name_from_url.lower()
                        
                        # Ensure we have a valid model name (should always be true at this point)
                        if not model_name:
                            model_name = model_name_from_url.lower()
                        
                        # If we still don't have a match but the URL looks like a dynamic model,
                        # use the URL name directly - the catch-all view will handle it
                        # This is important for ForeignKey widgets that try to reverse URLs
                        if not actual_model_name and ('partinprocess' in model_name_from_url.lower() or 
                                                      'partcompletion' in model_name_from_url.lower() or
                                                      'inprocess' in model_name_from_url.lower() or
                                                      'completion' in model_name_from_url.lower()):
                            # Use the URL model name as-is - catch-all view will match it
                            model_name = model_name_from_url.lower()
                        
                        # Get object_id from args or kwargs
                        object_id = None
                        if args and len(args) > 0:
                            object_id = args[0]
                        elif kwargs and 'object_id' in kwargs:
                            object_id = kwargs['object_id']
                        
                        # If we still don't have a match, try to find the model by searching admin registry
                        # This handles cases where the URL name doesn't exactly match the model name
                        if actual_model_name is None:
                            # Try to find by matching the normalized name
                            for registered_model in admin.site._registry.keys():
                                if registered_model._meta.app_label != 'api':
                                    continue
                                
                                registered_class_name = registered_model.__name__.lower()
                                registered_model_name = getattr(registered_model._meta, 'model_name', registered_class_name)
                                
                                # Normalize both names for comparison
                                normalized_registered = registered_model_name.replace('_', '').lower()
                                normalized_url = model_name_from_url.lower().replace('_', '')
                                
                                # Check if normalized names match
                                if normalized_registered == normalized_url:
                                    actual_model_name = registered_model_name
                                    break
                                
                                # Also check if URL contains key parts (e.g., "eics144" + "partinprocess")
                                # Extract part name from URL
                                url_lower = model_name_from_url.lower()
                                if 'partinprocess' in url_lower or 'part_inprocess' in url_lower:
                                    url_part = url_lower.split('part')[0].rstrip('_') if 'part' in url_lower else None
                                    registered_part = registered_class_name.split('part')[0].rstrip('_') if 'part' in registered_class_name else None
                                    if url_part and registered_part and url_part == registered_part:
                                        if 'inprocess' in registered_class_name or 'in_process' in registered_class_name:
                                            actual_model_name = registered_model_name
                                            break
                        
                        # Use the found model name, or fall back to the URL model name
                        model_name = actual_model_name or model_name_from_url.lower()
                        
                        # Build the URL manually - use the model name as-is
                        # The catch-all view will handle matching variations
                        if action == 'changelist':
                            return '/admin/api/%s/' % model_name
                        elif action == 'add':
                            return '/admin/api/%s/add/' % model_name
                        elif action == 'change' and object_id:
                            return '/admin/api/%s/%s/' % (model_name, object_id)
                        elif action == 'delete' and object_id:
                            return '/admin/api/%s/%s/delete/' % (model_name, object_id)
                        elif action == 'history' and object_id:
                            return '/admin/api/%s/%s/history/' % (model_name, object_id)
                        else:
                            # For any other action, try to construct a URL
                            # This handles cases where Django admin tries to reverse URLs we haven't explicitly handled
                            return '/admin/api/%s/' % model_name
                    
                    # If we got here, we matched the pattern but couldn't build a URL
                    # Return a default URL that the catch-all view can handle
                    return '/admin/api/%s/' % model_name_from_url.lower()
        
        # If we can't handle it, check if it looks like a dynamic model URL anyway
        # This is a last resort - return a URL that the catch-all view might handle
        viewname_str = str(viewname)
        if 'api_' in viewname_str and ('inprocess' in viewname_str.lower() or 'completion' in viewname_str.lower() or 'part' in viewname_str.lower()):
            # Try to extract a model name from the viewname
            if ':' in viewname_str:
                viewname_str = viewname_str.split(':', 1)[1]
            
            # Extract model name (everything after 'api_' and before last '_')
            if 'api_' in viewname_str and viewname_str.count('_') >= 2:
                parts = viewname_str.split('_')
                if len(parts) >= 3:
                    model_name_guess = '_'.join(parts[1:-1])
                    action_guess = parts[-1]
                    if action_guess in ['add', 'change', 'delete', 'history', 'changelist']:
                        if action_guess == 'changelist':
                            return '/admin/api/%s/' % model_name_guess
                        elif action_guess == 'add':
                            return '/admin/api/%s/add/' % model_name_guess
                        elif action_guess == 'change':
                            # For change, we might have an object_id
                            object_id = None
                            if args and len(args) > 0:
                                object_id = args[0]
                            elif kwargs and 'object_id' in kwargs:
                                object_id = kwargs['object_id']
                            if object_id:
                                return '/admin/api/%s/%s/' % (model_name_guess, object_id)
                            return '/admin/api/%s/' % model_name_guess
                        else:
                            return '/admin/api/%s/' % model_name_guess
        
        # If we can't handle it, re-raise the original exception
        raise

# Replace Django's reverse function
import django.urls
django.urls.reverse = reverse_with_dynamic_models

# Also patch the reverse function in django.urls.resolvers since Django admin might import it directly
try:
    from django.urls.resolvers import reverse as resolvers_reverse
    django.urls.resolvers.reverse = reverse_with_dynamic_models
except:
    pass

# Override Django admin's catch-all view to handle dynamic models
# This is necessary because Django admin's URL patterns are built at startup
# and don't automatically include dynamically registered models
_original_catch_all = admin.site.catch_all_view

def catch_all_view_with_dynamic_models(request, url):
    """
    Custom catch-all view that handles dynamic models registered after startup.
    """
    import sys
    print("Catch-all view called with URL: %s" % url, file=sys.stderr)
    
    # First, try to find the model in the registry
    from django.apps import apps as django_apps
    
    # Extract app_label and model_name from URL
    # URL format: admin/api/<model_name>/
    url_parts = url.strip('/').split('/')
    if len(url_parts) >= 2:
        app_label = url_parts[0]
        model_name = url_parts[1]
        print("Parsed URL - app_label: %s, model_name: %s" % (app_label, model_name), file=sys.stderr)
        
        # Check if this is a dynamic model in the 'api' app
        if app_label == 'api':
            model_class = None
            
            # First, try to find the model in Django's app registry
            try:
                if 'api' in django_apps.all_models and model_name in django_apps.all_models['api']:
                    model_class = django_apps.all_models['api'][model_name]
            except:
                pass
            
            # If not found in app registry, try DynamicModelRegistry
            if model_class is None:
                try:
                    # Try to find by part name (model_name might be the table name)
                    all_models = DynamicModelRegistry.get_all()
                    
                    # Normalize model_name for matching (remove underscores, convert to lowercase)
                    normalized_model_name = model_name.lower().replace('_', '')
                    
                    for part_name, models_dict in all_models.items():
                        # models_dict is now {'in_process': model, 'completion': model}
                        # Check both models
                        for table_type, registered_model in models_dict.items():
                            if registered_model is None:
                                continue
                            
                            # Try multiple matching strategies
                            registered_class_name = registered_model.__name__.lower()
                            registered_table_name = registered_model._meta.db_table.lower()
                            registered_class_normalized = registered_class_name.replace('_', '')
                            registered_table_normalized = registered_table_name.replace('_', '')
                            
                            # Check exact matches
                            if (registered_model._meta.db_table == model_name or 
                                registered_model.__name__.lower() == model_name):
                                model_class = registered_model
                                break
                            
                            # Check normalized matches (handles underscore variations)
                            if (normalized_model_name == registered_class_normalized or
                                normalized_model_name == registered_table_normalized):
                                model_class = registered_model
                                break
                            
                            # Check if model_name matches part name (for base part URLs)
                            # e.g., "eics112_part" should match "EICS112_Part" models
                            from .dynamic_models import sanitize_part_name
                            sanitized_part = sanitize_part_name(part_name).lower()
                            if model_name == sanitized_part or normalized_model_name == sanitized_part.replace('_', ''):
                                # For base part name, default to in_process model
                                if table_type == 'in_process':
                                    model_class = registered_model
                                    break
                            
                            # Check if model_name contains part name with suffix
                            # e.g., "eics112_part_completion" or "eics112_partcompletion"
                            if sanitized_part in model_name.lower() or sanitized_part.replace('_', '') in normalized_model_name:
                                # Check if suffix matches table_type
                                if ('completion' in model_name.lower() and table_type == 'completion') or \
                                   ('inprocess' in normalized_model_name and table_type == 'in_process') or \
                                   ('in_process' in model_name.lower() and table_type == 'in_process'):
                                    model_class = registered_model
                                    break
                                # If no suffix specified and it's in_process, use it
                                elif table_type == 'in_process' and 'completion' not in model_name.lower():
                                    model_class = registered_model
                                    break
                        
                        if model_class is not None:
                            break
                except Exception as e:
                    import sys
                    print("Error checking DynamicModelRegistry: {}".format(str(e)), file=sys.stderr)
            
            # If we found a model, try to register it if not already registered
            if model_class is not None:
                try:
                    # Check if model is registered in admin
                    if model_class in admin.site._registry:
                        # Model is registered - manually route to the admin view
                        admin_class = admin.site._registry[model_class]
                        
                        # Determine which view to call based on URL
                        if len(url_parts) == 2:
                            # Changelist view: /admin/api/eics120_part/
                            import sys
                            print("Routing to changelist view for %s" % model_name, file=sys.stderr)
                            return admin_class.changelist_view(request)
                        elif len(url_parts) == 3:
                            if url_parts[2] == 'add':
                                # Add view: /admin/api/eics120_part/add/
                                import sys
                                print("Routing to add view for %s" % model_name, file=sys.stderr)
                                return admin_class.add_view(request)
                            elif url_parts[2] == 'change':
                                # Change view (list): /admin/api/eics120_part/change/
                                import sys
                                print("Routing to changelist view for %s" % model_name, file=sys.stderr)
                                return admin_class.changelist_view(request)
                            else:
                                # Object detail view: /admin/api/eics120_part/<id>/
                                try:
                                    object_id = url_parts[2]
                                    import sys
                                    print("Routing to change view for %s, object_id=%s" % (model_name, object_id), file=sys.stderr)
                                    return admin_class.change_view(request, object_id)
                                except Exception as e:
                                    import sys
                                    print("Error in change view: %s" % str(e), file=sys.stderr)
                                    return _original_catch_all(request, url)
                        else:
                            # Try original catch-all for other URLs
                            return _original_catch_all(request, url)
                    else:
                        # Model exists but not registered - try to register it
                        try:
                            # Get part name from model
                            part_name = getattr(model_class._meta, 'verbose_name', model_name)
                            if not part_name or part_name == model_name:
                                # Try to get from DynamicModelRegistry
                                all_models = DynamicModelRegistry.get_all()
                                for pn, models_dict in all_models.items():
                                    # models_dict is {'in_process': model, 'completion': model}
                                    for table_type, m in models_dict.items():
                                        if m == model_class:
                                            part_name = pn
                                            break
                                    if part_name and part_name != model_name:
                                        break
                            
                            result = register_dynamic_model_in_admin(model_class, part_name)
                            if result:
                                import sys
                                print("Successfully registered dynamic model %s via catch-all view" % part_name, file=sys.stderr)
                                # Now route to the admin view
                                admin_class = admin.site._registry[model_class]
                                if len(url_parts) == 2:
                                    return admin_class.changelist_view(request)
                                elif len(url_parts) == 3:
                                    if url_parts[2] == 'add':
                                        return admin_class.add_view(request)
                                    else:
                                        return admin_class.change_view(request, url_parts[2])
                        except Exception as e:
                            import sys
                            import traceback
                            print("Error registering dynamic model in catch-all: %s" % str(e), file=sys.stderr)
                            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
                except Exception as e:
                    import sys
                    import traceback
                    print("Error in catch-all view: %s" % str(e), file=sys.stderr)
                    traceback.print_exception(*sys.exc_info(), file=sys.stderr)
    
    # Fall back to original catch-all view
    return _original_catch_all(request, url)

# Replace Django admin's catch-all view with our custom one
admin.site.catch_all_view = catch_all_view_with_dynamic_models


# Note: Dynamic models are auto-registered via ApiConfig.ready() method
# This ensures they're registered when Django starts up
