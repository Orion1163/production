"""
Management command to check which models are registered in Django admin.
"""
from django.core.management.base import BaseCommand
from django.contrib import admin
from django.apps import apps


class Command(BaseCommand):
    help = 'Check which models are registered in Django admin'

    def handle(self, *args, **options):
        self.stdout.write('=' * 80)
        self.stdout.write('ADMIN REGISTRY')
        self.stdout.write('=' * 80)
        
        for model, admin_class in admin.site._registry.items():
            if hasattr(model, '_meta'):
                self.stdout.write(f'\nModel: {model.__name__}')
                self.stdout.write(f'  - Label: {model._meta.label}')
                self.stdout.write(f'  - App Label: {model._meta.app_label}')
                self.stdout.write(f'  - Verbose Name: {model._meta.verbose_name}')
                self.stdout.write(f'  - DB Table: {model._meta.db_table}')
        
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write('DJANGO APP REGISTRY (api app)')
        self.stdout.write('=' * 80)
        
        api_models = apps.all_models.get('api', {})
        for model_key, model_class in api_models.items():
            self.stdout.write(f'\n{model_key}: {model_class.__name__}')
            if hasattr(model_class, '_meta'):
                self.stdout.write(f'  - Label: {model_class._meta.label}')
                self.stdout.write(f'  - Verbose Name: {model_class._meta.verbose_name}')
                self.stdout.write(f'  - DB Table: {model_class._meta.db_table}')

