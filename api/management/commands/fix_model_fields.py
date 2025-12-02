"""
Management command to fix dynamic model field names by recreating models.
This fixes issues where fields were double-prefixed (e.g., dispatch_dispatch_done_by).
"""
from django.core.management.base import BaseCommand
from api.models import ModelPart, PartProcedureDetail
from api.dynamic_models import DynamicModelRegistry, ensure_dynamic_model_exists
from api.dynamic_model_utils import create_dynamic_table_in_db
from api.admin import register_dynamic_model_in_admin
import sys


class Command(BaseCommand):
    help = 'Recreate dynamic models with correct field names (fixes double-prefixing issues)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting model recreation process...'))
        
        # Get all ModelPart records
        model_parts = ModelPart.objects.all()
        
        fixed_count = 0
        error_count = 0
        
        for model_part in model_parts:
            try:
                part_name = model_part.part_no
                self.stdout.write(f'Processing part: {part_name}')
                
                # Check if procedure detail exists
                if not hasattr(model_part, 'procedure_detail'):
                    self.stdout.write(self.style.WARNING(f'  No procedure detail for {part_name}, skipping'))
                    continue
                
                procedure_detail = model_part.procedure_detail
                enabled_sections = procedure_detail.get_enabled_sections()
                procedure_config = procedure_detail.procedure_config
                
                # Unregister old model
                if DynamicModelRegistry.exists(part_name):
                    DynamicModelRegistry.unregister(part_name)
                    self.stdout.write(f'  Unregistered old model')
                
                # Recreate model with correct field names
                new_model = ensure_dynamic_model_exists(
                    part_name,
                    enabled_sections,
                    procedure_config=procedure_config
                )
                self.stdout.write(f'  Created new model with correct field names')
                
                # Sync table (add missing columns)
                result = create_dynamic_table_in_db(new_model)
                if result:
                    self.stdout.write(f'  Synced database table')
                else:
                    self.stdout.write(self.style.WARNING(f'  Warning: Table sync returned False'))
                
                # Re-register in admin
                try:
                    register_dynamic_model_in_admin(new_model, part_name)
                    self.stdout.write(f'  Registered in admin')
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  Warning: Could not register in admin: {e}'))
                
                fixed_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Successfully fixed {part_name}'))
                
            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f'  ✗ Error processing {model_part.part_no}: {e}'))
                import traceback
                traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Completed: Fixed {fixed_count} models, {error_count} errors'))

