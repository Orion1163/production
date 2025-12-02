"""
Management command to fix dynamic tables by adding missing columns.

Usage:
    python manage.py fix_dynamic_tables
"""
from django.core.management.base import BaseCommand
from api.dynamic_model_utils import ensure_all_dynamic_tables_exist
from api.models import ModelPart, PartProcedureDetail


class Command(BaseCommand):
    help = 'Fix dynamic tables by adding missing columns'

    def handle(self, *args, **options):
        self.stdout.write('Fixing dynamic tables...')
        
        # This will check each table and add missing columns
        result = ensure_all_dynamic_tables_exist()
        
        self.stdout.write('\nResults:')
        self.stdout.write('  Created/Updated: %d' % len(result.get('created', [])))
        self.stdout.write('  Failed: %d' % len(result.get('failed', [])))
        
        if result.get('created'):
            self.stdout.write('\nFixed tables:')
            for part in result['created']:
                self.stdout.write('  - %s' % part)
        
        if result.get('failed'):
            self.stdout.write(self.style.WARNING('\nFailed tables:'))
            for part in result['failed']:
                self.stdout.write(self.style.WARNING('  - %s' % part))
        
        self.stdout.write(self.style.SUCCESS('\nDone!'))

