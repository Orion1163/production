"""
Management command to create/sync dynamic model tables in the database.

Usage:
    python manage.py sync_dynamic_tables
"""
from django.core.management.base import BaseCommand
from api.dynamic_model_utils import ensure_all_dynamic_tables_exist
from api.models import ModelPart, PartProcedureDetail


class Command(BaseCommand):
    help = 'Create/sync database tables for all dynamic part models'

    def add_arguments(self, parser):
        parser.add_argument(
            '--part',
            type=str,
            help='Sync tables for a specific part number only',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force recreation of tables (WARNING: will drop existing tables)',
        )

    def handle(self, *args, **options):
        part_name = options.get('part')
        force = options.get('force', False)
        
        if part_name:
            # Sync specific part
            self.stdout.write(f'Syncing dynamic table for part: {part_name}')
            try:
                model_part = ModelPart.objects.get(part_no=part_name)
                if hasattr(model_part, 'procedure_detail'):
                    enabled_sections = model_part.procedure_detail.get_enabled_sections()
                    from api.dynamic_models import ensure_dynamic_model_exists
                    from api.dynamic_model_utils import create_dynamic_table_in_db
                    
                    dynamic_model = ensure_dynamic_model_exists(
                        model_part.part_no,
                        enabled_sections
                    )
                    
                    if force:
                        # Drop table if exists
                        from django.db import connection
                        with connection.cursor() as cursor:
                            cursor.execute(f"DROP TABLE IF EXISTS {dynamic_model._meta.db_table}")
                        self.stdout.write(self.style.WARNING(f'Dropped existing table: {dynamic_model._meta.db_table}'))
                    
                    if create_dynamic_table_in_db(dynamic_model):
                        self.stdout.write(
                            self.style.SUCCESS(f'Successfully created table for {part_name}')
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'Table may already exist for {part_name}')
                        )
                else:
                    self.stdout.write(
                        self.style.WARNING(f'No procedure detail found for {part_name}')
                    )
            except ModelPart.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'ModelPart with part_no="{part_name}" not found')
                )
        else:
            # Sync all parts
            self.stdout.write('Syncing dynamic tables for all parts...')
            result = ensure_all_dynamic_tables_exist()
            
            if result['created']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully created tables for {len(result["created"])} parts:'
                    )
                )
                for part in result['created']:
                    self.stdout.write(f'  - {part}')
            
            if result['failed']:
                self.stdout.write(
                    self.style.WARNING(
                        f'Failed to create tables for {len(result["failed"])} parts:'
                    )
                )
                for part in result['failed']:
                    self.stdout.write(f'  - {part}')
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nTotal: {len(result["created"])} created, {len(result["failed"])} failed'
                )
            )

