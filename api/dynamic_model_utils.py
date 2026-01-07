"""
Utility functions for working with dynamic part models.
Provides helper functions for creating, querying, and managing dynamic model instances.
"""
from django.db import connection
from django.core.management.color import no_style
from .dynamic_models import (
    get_dynamic_part_model,
    ensure_dynamic_model_exists,
    create_dynamic_part_model,
    DynamicModelRegistry
)
from .models import ModelPart, PartProcedureDetail


def get_or_create_part_data_model(part_name, enabled_sections=None, procedure_config=None, table_type='in_process'):
    """
    Get or create a dynamic model for a part.
    
    Args:
        part_name (str): The part number/name
        enabled_sections (list, optional): List of enabled sections.
                                          If None, will try to get from PartProcedureDetail
        procedure_config (dict, optional): Procedure configuration
        table_type (str): 'in_process', 'completion', or None (returns dict with both)
    
    Returns:
        Model class or dict: The dynamic model class(es)
    """
    # Try to get existing model(s)
    if table_type is None:
        in_process, completion = get_dynamic_part_model(part_name, None)
        if in_process or completion:
            return {'in_process': in_process, 'completion': completion}
    else:
        model = get_dynamic_part_model(part_name, table_type)
        if model:
            return model
    
    # If enabled_sections or procedure_config not provided, try to get from database
    if enabled_sections is None or procedure_config is None:
        try:
            model_part = ModelPart.objects.get(part_no=part_name)
            if hasattr(model_part, 'procedure_detail'):
                if enabled_sections is None:
                    enabled_sections = model_part.procedure_detail.get_enabled_sections()
                if procedure_config is None:
                    procedure_config = model_part.procedure_detail.procedure_config
            else:
                enabled_sections = enabled_sections or []
                procedure_config = procedure_config or {}
        except ModelPart.DoesNotExist:
            enabled_sections = enabled_sections or []
            procedure_config = procedure_config or {}
    
    # Create the models
    models_dict = ensure_dynamic_model_exists(part_name, enabled_sections or [], procedure_config)
    if table_type is None:
        return models_dict
    return models_dict.get(table_type)


def create_entry_for_part(part_name, data):
    """
    Create a new data entry for a part using its dynamic model.
    
    Args:
        part_name (str): The part number/name
        data (dict): Dictionary containing field values (usid, serial_number, is_qc, etc.)
    
    Returns:
        Model instance: The created entry
    """
    model = get_or_create_part_data_model(part_name)
    
    # Create the entry
    entry = model.objects.create(**data)
    return entry


def get_entries_for_part(part_name, **filters):
    """
    Get all entries for a part using its dynamic model.
    
    Args:
        part_name (str): The part number/name
        **filters: Additional filter arguments (e.g., usid='123', is_qc=True)
    
    Returns:
        QuerySet: QuerySet of entries
    """
    model = get_or_create_part_data_model(part_name)
    return model.objects.filter(**filters)


def create_dynamic_table_in_db(model_class):
    """
    Create the database table for a dynamic model.
    If table exists, add any missing columns.
    This should be used carefully - prefer migrations in production.
    
    Args:
        model_class: The dynamic model class
    
    Returns:
        bool: True if successful
    """
    from django.db import connection
    from django.db import models
    
    table_name = model_class._meta.db_table
    
    # Check if table exists and get existing columns
    table_exists = False
    existing_columns = set()
    
    try:
        with connection.cursor() as cursor:
            if connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name])
                if cursor.fetchone():
                    table_exists = True
                    # Get existing columns - PRAGMA doesn't support parameters, use string formatting
                    # This is safe because table_name is already validated and sanitized
                    # Escape quotes properly for SQLite
                    safe_table_name = table_name.replace('"', '""')
                    cursor.execute(f'PRAGMA table_info("{safe_table_name}")')
                    existing_columns = {row[1] for row in cursor.fetchall()}
            else:
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = %s", [table_name])
                if cursor.fetchone():
                    table_exists = True
                    # Get existing columns
                    cursor.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = %s
                    """, [table_name])
                    existing_columns = {row[0] for row in cursor.fetchall()}
    except Exception as e:
        pass
    
    # If table exists, check for missing columns and add them
    if table_exists:
        missing_columns = []
        from django.db import models
        
        # Get all fields and their corresponding column names
        for field in model_class._meta.get_fields():
            # Skip reverse relations
            if field.one_to_many or field.many_to_many:
                continue
            
            # For ForeignKey fields, use the column name (usually {field_name}_id)
            if isinstance(field, models.ForeignKey):
                column_name = field.column  # This is the actual database column name
                if column_name not in existing_columns:
                    missing_columns.append(column_name)
            else:
                # For other fields, use the field name
                if field.name not in existing_columns:
                    missing_columns.append(field.name)
        
        if missing_columns:
            result = _add_missing_columns(model_class, connection, table_name, missing_columns, existing_columns)
            if result:
                return result
            return result
        else:
            return True
    
    # Try manual SQL creation first (more reliable for dynamic models)
    # Then fall back to schema editor if needed
    import sys
    try:
        result = _create_table_manually(model_class, connection, table_name)
        if result:
            return True
    except Exception as e1:
        error_msg1 = str(e1)
        import traceback
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        
        # If manual creation fails, try schema editor
        try:
            with connection.schema_editor() as schema_editor:
                schema_editor.create_model(model_class)
            return True
        except Exception as e2:
            # Check if error is because table already exists
            error_msg2 = str(e2)
            if 'already exists' in error_msg1.lower() or 'already exists' in error_msg2.lower():
                return True  # Table exists, which is fine
            
            # Log errors
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)
            return False
    
    # Final check: Always verify table exists and has all required columns
    # This handles cases where table existence check failed or table was created without all columns
    try:
        with connection.cursor() as cursor:
            # Check if table exists
            table_found = False
            if connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table_name])
                if cursor.fetchone():
                    table_found = True
                    safe_table_name = table_name.replace('"', '""')
                    cursor.execute(f'PRAGMA table_info("{safe_table_name}")')
                    final_existing_columns = {row[1] for row in cursor.fetchall()}
            else:
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = %s", [table_name])
                if cursor.fetchone():
                    table_found = True
                    cursor.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = %s
                    """, [table_name])
                    final_existing_columns = {row[0] for row in cursor.fetchall()}
            
            if table_found:
                # Check for missing columns
                from django.db import models
                final_missing_columns = []
                for field in model_class._meta.get_fields():
                    if field.one_to_many or field.many_to_many:
                        continue
                    if isinstance(field, models.ForeignKey):
                        column_name = field.column
                        if column_name not in final_existing_columns:
                            final_missing_columns.append(column_name)
                    else:
                        if field.name not in final_existing_columns and field.name != 'id':
                            final_missing_columns.append(field.name)
                
                if final_missing_columns:
                    result = _add_missing_columns(model_class, connection, table_name, final_missing_columns, final_existing_columns)
                    if result:
                        return True
                else:
                    return True  # Table exists with all columns
    except Exception as final_error:
        pass
    
    return False


def _add_missing_columns(model_class, connection, table_name, missing_columns, existing_columns):
    """
    Add missing columns to an existing table.
    """
    from django.db import models
    import sys
    
    try:
        with connection.cursor() as cursor:
            for column_name in missing_columns:
                # Get the field from the model
                # For ForeignKey fields, the column name is {field_name}_id, so we need to find the field
                field = None
                for f in model_class._meta.get_fields():
                    # Check if this field's column matches the missing column name
                    if hasattr(f, 'column') and f.column == column_name:
                        field = f
                        break
                    # Also check if the field name matches (for non-ForeignKey fields)
                    elif f.name == column_name and not isinstance(f, models.ForeignKey):
                        field = f
                        break
                
                if not field:
                    continue
                
                # Handle ForeignKey fields - they use {field_name}_id column
                if isinstance(field, models.ForeignKey):
                    # Verify the column name matches
                    if field.column != column_name:
                        continue
                    
                    field_type = 'INTEGER'
                    nullable = 'NULL' if getattr(field, 'null', False) else 'NOT NULL'
                    default = ''
                else:
                    # Determine field type for non-ForeignKey fields
                    field_type = 'TEXT'
                    nullable = 'NULL'
                    
                    if isinstance(field, models.CharField):
                        max_length = getattr(field, 'max_length', 255)
                        if max_length:
                            field_type = 'VARCHAR(%d)' % max_length
                        else:
                            field_type = 'TEXT'
                    elif isinstance(field, models.IntegerField):
                        field_type = 'INTEGER'
                    elif isinstance(field, models.BooleanField):
                        field_type = 'INTEGER'  # SQLite uses INTEGER for booleans
                    elif isinstance(field, models.DateTimeField):
                        field_type = 'DATETIME'
                    
                    if not getattr(field, 'null', False) and not getattr(field, 'primary_key', False):
                        nullable = 'NOT NULL'
                    
                    # Set default value for non-ForeignKey fields
                    default = ''
                    if hasattr(field, 'default') and field.default is not None and field.default != models.NOT_PROVIDED:
                        if isinstance(field.default, bool):
                            default = ' DEFAULT %d' % (1 if field.default else 0)
                        elif isinstance(field.default, int):
                            default = ' DEFAULT %d' % field.default
                        elif isinstance(field.default, str):
                            default = " DEFAULT '%s'" % field.default.replace("'", "''")
                
                # Add column
                alter_sql = 'ALTER TABLE "%s" ADD COLUMN "%s" %s %s%s' % (
                    table_name, column_name, field_type, nullable, default
                )
                
                try:
                    cursor.execute(alter_sql)
                except Exception as e:
                    # Column might already exist or other error
                    pass
        
        return True
    except Exception as e:
        import sys
        import traceback
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        return False


def _create_table_manually(model_class, connection, table_name):
    """
    Manually create table using raw SQL as fallback.
    """
    from django.db import models
    
    # Build column definitions
    columns = []
    
    # Add ID field
    columns.append('"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT')
    
    # Add other fields
    for field in model_class._meta.get_fields():
        if field.name == 'id':
            continue
        
        # Skip reverse relations (one_to_many, many_to_many)
        if field.one_to_many or field.many_to_many:
            continue
        
        # Handle ForeignKey fields - they create a {field_name}_id column
        if isinstance(field, models.ForeignKey):
            column_name = field.column  # Django uses {field_name}_id for ForeignKey
            field_type = 'INTEGER'
            nullable = 'NULL' if getattr(field, 'null', False) else 'NOT NULL'
            default = ''
            columns.append('"%s" %s %s%s' % (column_name, field_type, nullable, default))
            continue
        
        field_type = 'TEXT'
        nullable = 'NULL'
        
        if isinstance(field, models.CharField):
            max_length = getattr(field, 'max_length', 255)
            if max_length:
                field_type = 'VARCHAR(%d)' % max_length
            else:
                field_type = 'TEXT'
        elif isinstance(field, models.IntegerField):
            field_type = 'INTEGER'
        elif isinstance(field, models.BooleanField):
            field_type = 'INTEGER'  # SQLite uses INTEGER for booleans
        elif isinstance(field, models.DateTimeField):
            field_type = 'DATETIME'
        
        if not getattr(field, 'null', False) and not getattr(field, 'primary_key', False):
            nullable = 'NOT NULL'
        
        default = ''
        if hasattr(field, 'default') and field.default is not None and field.default != models.NOT_PROVIDED:
            if isinstance(field.default, bool):
                default = ' DEFAULT %d' % (1 if field.default else 0)
            elif isinstance(field.default, int):
                default = ' DEFAULT %d' % field.default
            elif isinstance(field.default, str):
                default = " DEFAULT '%s'" % field.default.replace("'", "''")
        
        columns.append('"%s" %s %s%s' % (field.name, field_type, nullable, default))
    
    # Create table SQL
    create_sql = 'CREATE TABLE IF NOT EXISTS "%s" (%s)' % (table_name, ', '.join(columns))
    
    try:
        with connection.cursor() as cursor:
            cursor.execute(create_sql)
        
        # Verify table was created by checking all tables
        with connection.cursor() as cursor:
            if connection.vendor == 'sqlite':
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                existing_tables = [row[0] for row in cursor.fetchall()]
            else:
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                existing_tables = [row[0] for row in cursor.fetchall()]
            
            if table_name in existing_tables:
                # After creating table, check for missing columns and add them
                # This handles the case where table already existed but was missing columns
                try:
                    # Get existing columns
                    if connection.vendor == 'sqlite':
                        safe_table_name = table_name.replace('"', '""')
                        cursor.execute(f'PRAGMA table_info("{safe_table_name}")')
                        existing_columns_after = {row[1] for row in cursor.fetchall()}
                    else:
                        cursor.execute("""
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = %s
                        """, [table_name])
                        existing_columns_after = {row[0] for row in cursor.fetchall()}
                    
                    # Check for missing columns
                    missing_columns_after = []
                    from django.db import models
                    for field in model_class._meta.get_fields():
                        if field.one_to_many or field.many_to_many:
                            continue
                        if isinstance(field, models.ForeignKey):
                            column_name = field.column
                            if column_name not in existing_columns_after:
                                missing_columns_after.append(column_name)
                        else:
                            if field.name not in existing_columns_after and field.name != 'id':
                                missing_columns_after.append(field.name)
                    
                    if missing_columns_after:
                        result = _add_missing_columns(model_class, connection, table_name, missing_columns_after, existing_columns_after)
                        if result:
                            pass
                except Exception as col_error:
                    pass
                
                return True
            else:
                return False
    except Exception as e:
        import sys
        import traceback
        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        raise


def ensure_all_dynamic_tables_exist():
    """
    Ensure all dynamic model tables exist in the database.
    This iterates through all ModelPart records and creates their dynamic tables.
    """
    import sys
    created_tables = []
    failed_tables = []
    
    model_parts = ModelPart.objects.all()
    
    for model_part in model_parts:
        try:
            try:
                procedure_detail = PartProcedureDetail.objects.get(model_part=model_part)
            except PartProcedureDetail.DoesNotExist:
                failed_tables.append(model_part.part_no)
                continue
            
            enabled_sections = procedure_detail.get_enabled_sections()
            procedure_config = procedure_detail.procedure_config
            models_dict = ensure_dynamic_model_exists(
                model_part.part_no,
                enabled_sections,
                procedure_config
            )
            
            # Process both models
            all_success = True
            from api.admin import register_dynamic_model_in_admin
            
            # Create in_process table
            if models_dict.get('in_process'):
                in_process_model = models_dict['in_process']
                result = create_dynamic_table_in_db(in_process_model)
                if result:
                    register_dynamic_model_in_admin(in_process_model, f"{model_part.part_no}_in_process")
                else:
                    all_success = False
            
            # Create completion table
            if models_dict.get('completion'):
                completion_model = models_dict['completion']
                result = create_dynamic_table_in_db(completion_model)
                if result:
                    register_dynamic_model_in_admin(completion_model, f"{model_part.part_no}_completion")
                else:
                    all_success = False
            
            if all_success:
                created_tables.append(model_part.part_no)
            else:
                failed_tables.append(model_part.part_no)
        except Exception as e:
            import traceback
            # Get full error information
            exc_type, exc_value, exc_traceback = sys.exc_info()
            
            # Always print traceback
            traceback.print_exception(exc_type, exc_value, exc_traceback, file=sys.stderr)
            
            failed_tables.append(model_part.part_no)
    
    result = {
        'created': created_tables,
        'failed': failed_tables
    }
    return result


def get_dynamic_model_info(part_name):
    """
    Get information about a dynamic model for a part.
    
    Args:
        part_name (str): The part number/name
    
    Returns:
        dict: Information about the model (fields, table name, etc.)
    """
    model = get_dynamic_part_model(part_name)
    if not model:
        return None
    
    fields_info = {}
    for field in model._meta.get_fields():
        if hasattr(field, 'name'):
            fields_info[field.name] = {
                'type': field.__class__.__name__,
                'null': getattr(field, 'null', False),
                'blank': getattr(field, 'blank', False),
                'default': getattr(field, 'default', None),
            }
    
    return {
        'class_name': model.__name__,
        'table_name': model._meta.db_table,
        'fields': fields_info,
        'verbose_name': model._meta.verbose_name,
    }

