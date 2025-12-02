"""
Management command to manually register all dynamic models in Django admin.

Usage:
    python manage.py register_dynamic_admin
"""
from django.core.management.base import BaseCommand
from api.admin import register_all_dynamic_models_in_admin
from django.contrib import admin


class Command(BaseCommand):
    help = 'Register all dynamic models in Django admin'

    def handle(self, *args, **options):
        self.stdout.write('Registering dynamic models in admin...')
        
        # Register all dynamic models
        register_all_dynamic_models_in_admin()
        
        # Show what's registered
        self.stdout.write('\nAll registered models in admin:')
        api_models = []
        for model, admin_class in admin.site._registry.items():
            if hasattr(model, '_meta'):
                model_info = '  - %s (table: %s, app: %s)' % (
                    model._meta.verbose_name or model.__name__,
                    model._meta.db_table,
                    getattr(model._meta, 'app_label', 'unknown')
                )
                self.stdout.write(model_info)
                # Check if it's a dynamic model (table name matches part pattern)
                if hasattr(model._meta, 'db_table') and not model._meta.db_table.startswith('api_') and not model._meta.db_table.startswith('auth_') and not model._meta.db_table.startswith('django_'):
                    api_models.append(model._meta.verbose_name or model.__name__)
        
        self.stdout.write('\nDynamic part models found: %d' % len(api_models))
        for model_name in api_models:
            self.stdout.write('  - %s' % model_name)
        
        self.stdout.write(self.style.SUCCESS('\nSuccessfully registered dynamic models in admin!'))
        self.stdout.write(self.style.WARNING('\nNote: You may need to refresh your browser to see the new models.'))

