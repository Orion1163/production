from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.admin.apps import AdminConfig
from django.http import Http404
from django.urls import reverse, NoReverseMatch
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from .models import User, Admin, ModelPart, PartProcedureDetail
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
            'leaded_qc', 'prod_qc', 'qc', 'testing',
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
        'testing': 'Testing',
        'heat_run': 'Heat Run',
        'glueing': 'Glueing',
        'cleaning': 'Cleaning',
        'spraying': 'Spraying',
        'dispatch': 'Dispatch'
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
        'testing',                # 9. Testing
        'heat_run',               # 10. Heat Run
        'glueing',                # 11. Glueing
        'cleaning',               # 12. Cleaning
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
        
        def response_post_save_add(self, request, obj):
            """
            Override to fix URL reversing after adding an object.
            """
            response = super().response_post_save_add(request, obj)
            # Fix the redirect URL to use our catch-all pattern
            if hasattr(response, 'url') and response.url:
                model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                # Replace any reversed URLs with direct paths
                if 'api_' + model_name in response.url or 'admin/api/' + model_name in response.url:
                    response.url = '/admin/api/%s/' % model_name
            return response
        
        def response_post_save_change(self, request, obj):
            """
            Override to fix URL reversing after changing an object.
            """
            response = super().response_post_save_change(request, obj)
            # Fix the redirect URL to use our catch-all pattern
            if hasattr(response, 'url') and response.url:
                model_name = getattr(model_class._meta, 'model_name', model_class.__name__.lower())
                # Replace any reversed URLs with direct paths
                if 'api_' + model_name in response.url or 'admin/api/' + model_name in response.url:
                    response.url = '/admin/api/%s/' % model_name
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
        if viewname.startswith('admin:') and '_' in viewname:
            parts = viewname.split(':')
            if len(parts) == 2:
                url_name = parts[1]
                # Check if it matches pattern: api_<model_name>_<action>
                if url_name.startswith('api_') and url_name.count('_') >= 2:
                    url_parts = url_name.split('_')
                    if len(url_parts) >= 3:
                        # Reconstruct model name (everything between 'api' and last part)
                        model_name_from_url = '_'.join(url_parts[1:-1])
                        action = url_parts[-1]
                        
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
                            # Also check admin registry
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
                                
                                # Check normalized match
                                normalized_class = class_name_lower.replace('_', '')
                                normalized_model_attr = model_name_attr.replace('_', '')
                                if (normalized_class == normalized_url_name or 
                                    normalized_model_attr == normalized_url_name):
                                    actual_model_name = model_name_attr
                                    break
                            
                            # If still not found, search in DynamicModelRegistry
                            if actual_model_name is None:
                                all_models = DynamicModelRegistry.get_all()
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
                                                    actual_model_name = model_name_attr
                                                    break
                                        
                                        # Handle "completion" variations
                                        if 'completion' in normalized_url_name or 'completion' in model_name_from_url.lower():
                                            if 'completion' in normalized_class or 'completion' in class_name_lower:
                                                if table_type == 'completion':
                                                    actual_model_name = model_name_attr
                                                    break
                                    
                                    if actual_model_name:
                                        break
                        
                        # Use the found model name, or fall back to the URL model name
                        # Try to use the actual model name if found, otherwise use URL name
                        # But also try variations if the catch-all view can handle them
                        model_name = actual_model_name or model_name_from_url.lower()
                        
                        # Get object_id from args or kwargs
                        object_id = None
                        if args and len(args) > 0:
                            object_id = args[0]
                        elif kwargs and 'object_id' in kwargs:
                            object_id = kwargs['object_id']
                        
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
        
        # If we can't handle it, re-raise the original exception
        raise

# Replace Django's reverse function
import django.urls
django.urls.reverse = reverse_with_dynamic_models

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
