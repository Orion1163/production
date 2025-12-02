# Dynamic Models Usage Guide

## Overview

This system implements **Option B: Fully Dynamic Model Creation** where each part number gets its own Django model class with the part name as the class name. When you save a production procedure, a dynamic model is automatically created for each part.

## Architecture

### Three-Table Structure

1. **ModelPart** (Table 1): Stores model number, part number, images, and videos
2. **PartProcedureDetail** (Table 2): Stores all procedure form configuration in JSON
3. **Dynamic Part Models** (Table 3): One model per part, created dynamically with part name as class name

## How It Works

### 1. Saving a Procedure

When you save a production procedure:

```python
# 1. Create ModelPart
model_part = ModelPart.objects.create(
    model_no='EICS112',
    part_no='EICS112_Part',
    form_image=form_image,
    part_image=part_image,
    qc_video=qc_video,
    testing_video=testing_video
)

# 2. Create PartProcedureDetail with procedure config
procedure_detail = PartProcedureDetail.objects.create(
    model_part=model_part,
    procedure_config={
        'qc': {'enabled': True, 'custom_fields': [...]},
        'testing': {'enabled': True, 'mode': 'manual', ...},
        'dispatch': {'enabled': True, ...}
    }
)

# 3. Dynamic model is automatically created via signal
# The signal handler calls create_dynamic_model() which:
# - Extracts enabled sections: ['qc', 'testing', 'dispatch']
# - Creates a model class named after the part (e.g., 'EICS112_Part')
# - Creates fields: usid, tag_no, is_qc=True, is_testing=True, is_dispatch=True, etc.
```

### 2. Using Dynamic Models

#### Get the Dynamic Model Class

```python
from api.dynamic_model_utils import get_or_create_part_data_model

# Get the model class for a part
PartModel = get_or_create_part_data_model('EICS112_Part')

# Or from ModelPart instance
model_part = ModelPart.objects.get(part_no='EICS112_Part')
PartModel = model_part.get_dynamic_model()
```

#### Create an Entry

```python
from api.dynamic_model_utils import create_entry_for_part

# Create a new entry
entry = create_entry_for_part('EICS112_Part', {
    'usid': 'USID123',
    'tag_no': 'TAG456',
    'is_qc': True,
    'is_testing': True,
    'is_dispatch': False
})

# Or directly using the model class
PartModel = get_or_create_part_data_model('EICS112_Part')
entry = PartModel.objects.create(
    usid='USID123',
    tag_no='TAG456',
    is_qc=True,
    is_testing=True
)
```

#### Query Entries

```python
from api.dynamic_model_utils import get_entries_for_part

# Get all entries for a part
entries = get_entries_for_part('EICS112_Part')

# Filter entries
qc_entries = get_entries_for_part('EICS112_Part', is_qc=True)
specific_entry = get_entries_for_part('EICS112_Part', usid='USID123').first()

# Or directly using the model class
PartModel = get_or_create_part_data_model('EICS112_Part')
all_entries = PartModel.objects.all()
qc_entries = PartModel.objects.filter(is_qc=True)
```

## Database Tables

### Static Tables

- `api_modelpart` - ModelPart records
- `part_procedure_detail` - PartProcedureDetail records

### Dynamic Tables

Dynamic tables are created with the naming pattern: `part_<sanitized_part_name>`

Examples:
- Part: `EICS112_Part` → Table: `part_eics112_part`
- Part: `EICS145` → Table: `part_eics145`
- Part: `ABC-123` → Table: `part_abc_123`

## Management Commands

### Sync Dynamic Tables

After creating procedures, you need to create the database tables:

```bash
# Sync all dynamic tables
python manage.py sync_dynamic_tables

# Sync a specific part
python manage.py sync_dynamic_tables --part EICS112_Part

# Force recreation (WARNING: drops existing table)
python manage.py sync_dynamic_tables --part EICS112_Part --force
```

## Model Structure

Each dynamic model has:

### Default Fields
- `id` (BigAutoField) - Primary key
- `usid` (CharField) - USID field
- `tag_no` (CharField) - Tag Number field

### Section Boolean Fields
- `is_smd` (BooleanField)
- `is_leaded` (BooleanField)
- `is_prod_qc` (BooleanField)
- `is_qc` (BooleanField)
- `is_testing` (BooleanField)
- `is_glueing` (BooleanField)
- `is_cleaning` (BooleanField)
- `is_spraying` (BooleanField)
- `is_dispatch` (BooleanField)

### Timestamps
- `created_at` (DateTimeField)
- `updated_at` (DateTimeField)

The boolean fields default to `True` if the section was enabled when the procedure was saved, `False` otherwise.

## Example: Complete Workflow

```python
# 1. Save procedure (in your view)
from api.models import ModelPart, PartProcedureDetail

model_part = ModelPart.objects.create(
    model_no='EICS112',
    part_no='EICS112_Part',
    # ... media files
)

procedure_detail = PartProcedureDetail.objects.create(
    model_part=model_part,
    procedure_config={
        'qc': {'enabled': True, 'custom_fields': []},
        'testing': {'enabled': True, 'mode': 'manual'},
        'dispatch': {'enabled': True}
    }
)
# Dynamic model is now created automatically!

# 2. Create database table
# Run: python manage.py sync_dynamic_tables --part EICS112_Part

# 3. Create production data entries
from api.dynamic_model_utils import create_entry_for_part

entry1 = create_entry_for_part('EICS112_Part', {
    'usid': 'USID001',
    'tag_no': 'TAG001',
    'is_qc': True,
    'is_testing': True,
    'is_dispatch': True
})

entry2 = create_entry_for_part('EICS112_Part', {
    'usid': 'USID002',
    'tag_no': 'TAG002',
    'is_qc': True,
    'is_testing': False,
    'is_dispatch': False
})

# 4. Query entries
from api.dynamic_model_utils import get_entries_for_part

all_entries = get_entries_for_part('EICS112_Part')
qc_entries = get_entries_for_part('EICS112_Part', is_qc=True)
```

## Important Notes

1. **Part Name Sanitization**: Part names are sanitized to be valid Python identifiers and database table names. Special characters are replaced with underscores.

2. **Table Creation**: Dynamic tables are NOT automatically created in the database. You must run `sync_dynamic_tables` management command after saving procedures.

3. **Model Registration**: Dynamic models are registered in memory and persist for the lifetime of the Django process. They are not saved to migrations.

4. **Migrations**: For production, consider creating migrations manually for dynamic models, or use a different approach for table creation.

5. **Model Retrieval**: Always use `get_or_create_part_data_model()` or `get_dynamic_part_model()` to retrieve dynamic models. Don't try to import them directly.

## Troubleshooting

### Model Not Found
```python
# If model doesn't exist, it will be created automatically
PartModel = get_or_create_part_data_model('EICS112_Part')
```

### Table Doesn't Exist
```bash
# Run sync command
python manage.py sync_dynamic_tables --part EICS112_Part
```

### Check Model Info
```python
from api.dynamic_model_utils import get_dynamic_model_info

info = get_dynamic_model_info('EICS112_Part')
print(info)  # Shows class name, table name, fields, etc.
```

## API Integration Example

```python
# In your views.py or serializers.py
from api.dynamic_model_utils import (
    get_or_create_part_data_model,
    create_entry_for_part,
    get_entries_for_part
)

class PartDataEntryView(APIView):
    def post(self, request, part_name):
        # Create entry
        entry = create_entry_for_part(part_name, request.data)
        return Response({'id': entry.id, 'usid': entry.usid})
    
    def get(self, request, part_name):
        # Get entries
        entries = get_entries_for_part(part_name)
        data = [{'id': e.id, 'usid': e.usid, 'tag_no': e.tag_no} 
                for e in entries]
        return Response(data)
```

