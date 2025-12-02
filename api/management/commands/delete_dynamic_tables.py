"""
Management command to delete dynamic tables and their associated data.

Usage:
    python manage.py delete_dynamic_tables --list                    # List all dynamic tables
    python manage.py delete_dynamic_tables --table eics112_part      # Delete specific table
    python manage.py delete_dynamic_tables --table eics112_part --keep-data  # Keep ModelPart record
    python manage.py delete_dynamic_tables --all                      # Delete all dynamic tables (with confirmation)
"""
from django.core.management.base import BaseCommand
from django.db import connection
from api.models import ModelPart, PartProcedureDetail
from django.contrib import admin
from django.apps import apps as django_apps


class Command(BaseCommand):
    help = 'Delete dynamic tables and optionally their associated ModelPart records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--list',
            action='store_true',
            help='List all dynamic tables in the database',
        )
        parser.add_argument(
            '--table',
            type=str,
            help='Name of the table to delete (e.g., eics112_part)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Delete all dynamic tables (requires confirmation)',
        )
        parser.add_argument(
            '--keep-data',
            action='store_true',
            help='Keep the ModelPart and PartProcedureDetail records (only delete the table)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompts',
        )

    def handle(self, *args, **options):
        if options['list']:
            self.list_tables()
        elif options['table']:
            self.delete_table(options['table'], options['keep_data'], options['force'])
        elif options['all']:
            self.delete_all_tables(options['keep_data'], options['force'])
        else:
            self.stdout.write(self.style.ERROR('Please specify --list, --table, or --all'))
            self.stdout.write('Use --help for more information')

    def list_tables(self):
        """List all dynamic tables in the database."""
        self.stdout.write('=' * 80)
        self.stdout.write('DYNAMIC TABLES IN DATABASE')
        self.stdout.write('=' * 80)
        
        with connection.cursor() as cursor:
            # Use raw SQL with proper escaping for table names
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                AND (name LIKE '%%eics%%' OR name LIKE 'part_%%')
                ORDER BY name
            """)
            tables = cursor.fetchall()
        
        if not tables:
            self.stdout.write(self.style.WARNING('No dynamic tables found.'))
            return
        
        self.stdout.write(f'\nFound {len(tables)} dynamic table(s):\n')
        
        for table_name, in tables:
            # Check if there's a corresponding ModelPart
            part_name = table_name.replace('part_', '').replace('_part', '')
            model_part = ModelPart.objects.filter(part_no__icontains=part_name).first()
            
            if model_part:
                self.stdout.write(f'  ✓ {table_name} (ModelPart: {model_part.part_no}, Model: {model_part.model_no})')
            else:
                self.stdout.write(f'  ✗ {table_name} (No ModelPart found)')
            
            # Check row count
            try:
                cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                count = cursor.fetchone()[0]
                self.stdout.write(f'    Rows: {count}')
            except Exception as e:
                self.stdout.write(f'    Error counting rows: {e}')
        
        self.stdout.write('\n' + '=' * 80)

    def delete_table(self, table_name, keep_data, force):
        """Delete a specific dynamic table."""
        self.stdout.write('=' * 80)
        self.stdout.write(f'DELETING TABLE: {table_name}')
        self.stdout.write('=' * 80)
        
        # Check if table exists
        with connection.cursor() as cursor:
            # Use raw SQL with proper quoting for SQLite (avoid parameterized queries for table names)
            quoted_table_name = connection.ops.quote_name(table_name)
            # Use execute with raw SQL string to avoid Django's parameter formatting
            cursor.execute(
                f"SELECT name FROM sqlite_master WHERE type='table' AND name = {quoted_table_name}"
            )
            if not cursor.fetchone():
                self.stdout.write(self.style.ERROR(f'Table {table_name} does not exist!'))
                return
        
        # Find associated ModelPart
        part_name = table_name.replace('part_', '').replace('_part', '')
        model_parts = ModelPart.objects.filter(part_no__icontains=part_name)
        
        if model_parts.exists():
            self.stdout.write(f'\nFound {model_parts.count()} associated ModelPart record(s):')
            for mp in model_parts:
                self.stdout.write(f'  - {mp.part_no} (Model: {mp.model_no})')
        
        # Confirm deletion
        if not force:
            if not keep_data and model_parts.exists():
                confirm = input(f'\nThis will delete the table AND {model_parts.count()} ModelPart record(s). Continue? (yes/no): ')
            else:
                confirm = input(f'\nDelete table "{table_name}"? (yes/no): ')
            
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.WARNING('Deletion cancelled.'))
                return
        
        # Delete the table
        try:
            with connection.cursor() as cursor:
                cursor.execute(f'DROP TABLE IF EXISTS "{table_name}"')
                self.stdout.write(self.style.SUCCESS(f'✓ Deleted table: {table_name}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error deleting table: {e}'))
            return
        
        # Delete ModelPart and PartProcedureDetail records if not keeping data
        if not keep_data and model_parts.exists():
            deleted_count = 0
            for mp in model_parts:
                try:
                    # Delete PartProcedureDetail first (if exists)
                    try:
                        procedure_detail = PartProcedureDetail.objects.get(model_part=mp)
                        procedure_detail.delete()
                        self.stdout.write(f'  ✓ Deleted PartProcedureDetail for {mp.part_no}')
                    except PartProcedureDetail.DoesNotExist:
                        pass
                    
                    # Delete ModelPart
                    mp.delete()
                    deleted_count += 1
                    self.stdout.write(f'  ✓ Deleted ModelPart: {mp.part_no}')
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'  Error deleting ModelPart {mp.part_no}: {e}'))
            
            self.stdout.write(self.style.SUCCESS(f'\n✓ Deleted {deleted_count} ModelPart record(s)'))
        
        # Unregister from admin if registered
        try:
            from api.dynamic_models import DynamicModelRegistry
            DynamicModelRegistry.unregister(part_name)
            
            # Try to unregister from admin
            for model_class in list(admin.site._registry.keys()):
                if hasattr(model_class, '_meta') and model_class._meta.db_table == table_name:
                    try:
                        admin.site.unregister(model_class)
                        self.stdout.write(f'  ✓ Unregistered from admin: {model_class.__name__}')
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f'  Could not unregister from admin: {e}'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  Could not unregister from registry: {e}'))
        
        # Remove from Django app registry
        try:
            if 'api' in django_apps.all_models:
                to_remove = []
                for key, model in django_apps.all_models['api'].items():
                    if hasattr(model, '_meta') and model._meta.db_table == table_name:
                        to_remove.append(key)
                for key in to_remove:
                    del django_apps.all_models['api'][key]
                    self.stdout.write(f'  ✓ Removed from app registry: {key}')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  Could not remove from app registry: {e}'))
        
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('Deletion complete!'))

    def delete_all_tables(self, keep_data, force):
        """Delete all dynamic tables."""
        self.stdout.write('=' * 80)
        self.stdout.write('DELETING ALL DYNAMIC TABLES')
        self.stdout.write('=' * 80)
        
        # Get all dynamic tables
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                AND (name LIKE '%%eics%%' OR name LIKE 'part_%%')
                ORDER BY name
            """)
            tables = [row[0] for row in cursor.fetchall()]
        
        if not tables:
            self.stdout.write(self.style.WARNING('No dynamic tables found.'))
            return
        
        self.stdout.write(f'\nFound {len(tables)} dynamic table(s) to delete:')
        for table in tables:
            self.stdout.write(f'  - {table}')
        
        # Count associated ModelParts
        model_part_count = 0
        for table in tables:
            part_name = table.replace('part_', '').replace('_part', '')
            model_part_count += ModelPart.objects.filter(part_no__icontains=part_name).count()
        
        if model_part_count > 0:
            self.stdout.write(f'\nThis will also delete {model_part_count} ModelPart record(s)')
        
        # Confirm deletion
        if not force:
            if not keep_data:
                confirm = input(f'\nDelete ALL {len(tables)} table(s) and {model_part_count} ModelPart record(s)? Type "DELETE ALL" to confirm: ')
                if confirm != 'DELETE ALL':
                    self.stdout.write(self.style.WARNING('Deletion cancelled.'))
                    return
            else:
                confirm = input(f'\nDelete ALL {len(tables)} table(s) (keeping ModelPart records)? (yes/no): ')
                if confirm.lower() != 'yes':
                    self.stdout.write(self.style.WARNING('Deletion cancelled.'))
                    return
        
        # Delete each table
        deleted_tables = 0
        for table_name in tables:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f'DROP TABLE IF EXISTS "{table_name}"')
                    deleted_tables += 1
                    self.stdout.write(f'  ✓ Deleted table: {table_name}')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error deleting {table_name}: {e}'))
        
        # Delete ModelPart records if not keeping data
        if not keep_data:
            deleted_parts = 0
            for table in tables:
                part_name = table.replace('part_', '').replace('_part', '')
                model_parts = ModelPart.objects.filter(part_no__icontains=part_name)
                
                for mp in model_parts:
                    try:
                        # Delete PartProcedureDetail first
                        try:
                            procedure_detail = PartProcedureDetail.objects.get(model_part=mp)
                            procedure_detail.delete()
                        except PartProcedureDetail.DoesNotExist:
                            pass
                        
                        mp.delete()
                        deleted_parts += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'  Error deleting ModelPart {mp.part_no}: {e}'))
            
            self.stdout.write(self.style.SUCCESS(f'\n✓ Deleted {deleted_parts} ModelPart record(s)'))
        
        # Clear admin registry
        try:
            from api.dynamic_models import DynamicModelRegistry
            DynamicModelRegistry._registry.clear()
            
            # Unregister all dynamic models from admin
            to_unregister = []
            for model_class in admin.site._registry.keys():
                if hasattr(model_class, '_meta'):
                    table_name = model_class._meta.db_table
                    if table_name in tables or any(t in table_name for t in ['eics', 'part_']):
                        to_unregister.append(model_class)
            
            for model_class in to_unregister:
                try:
                    admin.site.unregister(model_class)
                except:
                    pass
            
            self.stdout.write('  ✓ Cleared admin registry')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  Could not clear registry: {e}'))
        
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_tables} table(s)!'))

