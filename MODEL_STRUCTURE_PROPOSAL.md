# Production Procedure Data Model Structure Proposal

## Overview
This document outlines the proposed data model structure for storing production procedure form data with three main tables.

## Table 1: ModelPart
**Purpose**: Store model number, part number, and associated media files (images/videos)

### Fields:
- `id` (Primary Key, Auto)
- `model_no` (CharField) - Model number (e.g., EICS112)
- `part_no` (CharField) - Part number (e.g., EICS112_Part)
- `form_image` (ImageField, optional) - Main form image
- `part_image` (ImageField, optional) - Part-specific image
- `qc_video` (FileField, optional) - QC video file
- `testing_video` (FileField, optional) - Testing video file
- `created_at` (DateTimeField, auto)
- `updated_at` (DateTimeField, auto)

### Relationships:
- One-to-One with PartProcedureDetail
- One-to-Many with PartDataEntry (the dynamic table entries)

---

## Table 2: PartProcedureDetail
**Purpose**: Store all procedure form configuration details (all fields, sub-procedures, custom inputs)

### Fields:
- `id` (Primary Key, Auto)
- `model_part` (OneToOneField to ModelPart) - Links to the model-part combination
- `procedure_config` (JSONField) - Stores complete procedure configuration:
  ```json
  {
    "smd": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "leaded": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "prod_qc": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "qc": {
      "enabled": true,
      "custom_fields": [
        {"name": "field1", "type": "text", "label": "Custom Field 1"}
      ],
      "custom_checkboxes": [
        {"name": "check1", "label": "Checkbox 1"}
      ]
    },
    "testing": {
      "enabled": true,
      "mode": "manual",  // or "automatic"
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "glueing": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "cleaning": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "spraying": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    },
    "dispatch": {
      "enabled": true,
      "custom_fields": [],
      "custom_checkboxes": []
    }
  }
  ```
- `created_at` (DateTimeField, auto)
- `updated_at` (DateTimeField, auto)

---

## Table 3: PartDataEntry (Dynamic Table per Part)
**Purpose**: Store actual production data entries for each part number

### Approach Options:

### **Option A: Generic Table (Recommended)**
A single table that stores entries for all parts, filtered by `part_no`:

#### Fields:
- `id` (Primary Key, Auto)
- `model_part` (ForeignKey to ModelPart) - Links to the model-part
- `usid` (CharField) - USID field (default)
- `tag_no` (CharField) - Tag Number field (default)
- `is_smd` (BooleanField, default=False)
- `is_leaded` (BooleanField, default=False)
- `is_prod_qc` (BooleanField, default=False)
- `is_qc` (BooleanField, default=False)
- `is_testing` (BooleanField, default=False)
- `is_glueing` (BooleanField, default=False)
- `is_cleaning` (BooleanField, default=False)
- `is_spraying` (BooleanField, default=False)
- `is_dispatch` (BooleanField, default=False)
- `entry_data` (JSONField, optional) - Store any additional dynamic field values
- `created_at` (DateTimeField, auto)
- `updated_at` (DateTimeField, auto)

**Usage**: Query by `part_no` to get entries for a specific part
```python
PartDataEntry.objects.filter(model_part__part_no='EICS112_Part')
```

---

### **Option B: Dynamic Model Creation (Advanced)**
Create a Django model dynamically at runtime with the part name as the class name.

**Implementation Notes**:
- Use Django's `type()` function to create model classes dynamically
- Register models with Django's app registry
- Requires careful handling of migrations
- More complex but provides true per-part tables

**Example Structure**:
```python
# When saving procedure for part "EICS112_Part", create:
class EICS112_Part(models.Model):
    id = models.BigAutoField(primary_key=True)
    usid = models.CharField(max_length=255)
    tag_no = models.CharField(max_length=255)
    is_smd = models.BooleanField(default=False)
    is_qc = models.BooleanField(default=False)
    is_testing = models.BooleanField(default=False)
    # ... other boolean fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'part_eics112_part'  # Table name based on part
```

---

## Recommended Model Implementation

### Model Code Structure:

```python
# api/models.py

class ModelPart(models.Model):
    """Table 1: Model and Part information with media files"""
    model_no = models.CharField(max_length=100, db_index=True, help_text='Model number (e.g., EICS112)')
    part_no = models.CharField(max_length=100, db_index=True, help_text='Part number (e.g., EICS112_Part)')
    form_image = models.ImageField(upload_to='procedure_images/', blank=True, null=True)
    part_image = models.ImageField(upload_to='part_images/', blank=True, null=True)
    qc_video = models.FileField(upload_to='qc_videos/', blank=True, null=True)
    testing_video = models.FileField(upload_to='testing_videos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['model_no', 'part_no']]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.model_no} - {self.part_no}"


class PartProcedureDetail(models.Model):
    """Table 2: Procedure form configuration details"""
    model_part = models.OneToOneField(
        ModelPart, 
        on_delete=models.CASCADE, 
        related_name='procedure_detail'
    )
    procedure_config = models.JSONField(
        default=dict,
        help_text='Stores all procedure details including sections, custom fields, and checkboxes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Procedure: {self.model_part.part_no}"


class PartDataEntry(models.Model):
    """Table 3: Production data entries for parts (Generic approach)"""
    model_part = models.ForeignKey(
        ModelPart,
        on_delete=models.CASCADE,
        related_name='data_entries'
    )
    usid = models.CharField(max_length=255, blank=True, null=True)
    tag_no = models.CharField(max_length=255, blank=True, null=True)
    
    # Main section boolean flags
    is_smd = models.BooleanField(default=False)
    is_leaded = models.BooleanField(default=False)
    is_prod_qc = models.BooleanField(default=False)
    is_qc = models.BooleanField(default=False)
    is_testing = models.BooleanField(default=False)
    is_glueing = models.BooleanField(default=False)
    is_cleaning = models.BooleanField(default=False)
    is_spraying = models.BooleanField(default=False)
    is_dispatch = models.BooleanField(default=False)
    
    # Additional dynamic field values (for custom fields added in form)
    entry_data = models.JSONField(
        default=dict,
        help_text='Stores values for custom fields added in procedure form'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['model_part']),
        ]
    
    def __str__(self):
        return f"Entry: {self.model_part.part_no} - {self.usid or 'N/A'}"
```

---

## Data Flow

1. **Form Submission (Save Procedure)**:
   - Create/Update `ModelPart` with model_no, part_no, images, videos
   - Create/Update `PartProcedureDetail` with complete procedure_config JSON
   - Extract enabled main sections from procedure_config
   - Create `PartDataEntry` records are created later when users enter production data

2. **Production Data Entry**:
   - User selects a part number
   - System queries `PartDataEntry.objects.filter(model_part__part_no=selected_part)`
   - User fills in usid, tag_no, and selects which sections apply (sets boolean flags)
   - Save creates new `PartDataEntry` record

---

## Questions for Discussion

1. **Dynamic Table Approach**: Do you prefer Option A (generic table) or Option B (truly dynamic tables per part)?

2. **Part Name as Class Name**: If using Option B, how should we handle:
   - Special characters in part names (e.g., "EICS112_Part" → "EICS112_Part" or "EICS112Part")?
   - Part name changes?
   - Migration management?

3. **Default Fields**: Are `usid` and `tag_no` always present, or should they be dynamic too?

4. **Section Selection**: When a user creates a data entry, should they:
   - Select which sections apply (checkboxes for is_qc, is_testing, etc.)?
   - Or should this be auto-determined from the procedure_config?

5. **Multiple Entries**: Can there be multiple entries for the same part with different usid/tag_no combinations?

---

## Next Steps

Once we decide on the approach, I can:
1. Implement the models in `api/models.py`
2. Create migrations
3. Update serializers and views
4. Implement the dynamic model creation logic (if Option B is chosen)

