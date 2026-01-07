from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
 
    def ready(self):
        """
        Called when the app is ready.
        Register all dynamic models in admin when Django starts.
        """
        # Only register if we're not in a migration
        import sys
        if 'migrate' in sys.argv or 'makemigrations' in sys.argv:
            return
        
        try:
            # Import here to avoid circular imports
            from django.contrib import admin
            from .admin import register_all_dynamic_models_in_admin
            
            # Register all dynamic models
            register_all_dynamic_models_in_admin()
            
        except Exception as e:
            # Don't fail if admin registration fails during startup
            import sys
            import traceback
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
 