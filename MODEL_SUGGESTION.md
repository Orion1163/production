# Production Procedure Database Schema Suggestion

## Overview
This document outlines the proposed database schema for storing production procedure data with two main tables:
1. **PartProcedure** - Stores Model No, Part No, and main workflow section flags
2. **PartProcedureDetail** (Optional) - For future expansion if needed

## Proposed Model Structure

### Table 1: PartProcedure
This table stores the main information about each part and which workflow sections are enabled.

**Fields:**
- `id` - Primary Key (Auto)
- `model_no` - CharField (Model Number from API)
- `part_no` - CharField (Part Number from API)
- `form_image` - ImageField (Optional - uploaded form image)
- `qc_video` - FileField (Optional - QC video)
- `testing_video` - FileField (Optional - Testing video)
- `created_at` - DateTimeField (Auto)
- `updated_at` - DateTimeField (Auto)

**Workflow Section Boolean Flags:**
- `has_smd` - BooleanField (Default: False)
- `has_leaded` - BooleanField (Default: False)
- `has_prod_qc` - BooleanField (Default: False)
- `has_qc` - BooleanField (Default: False)
- `has_testing` - BooleanField (Default: False)
- `has_glueing` - BooleanField (Default: False)
- `has_cleaning` - BooleanField (Default: False)
- `has_spraying` - BooleanField (Default: False)
- `has_dispatch` - BooleanField (Default: False)

**Additional Field for Testing:**
- `testing_mode` - CharField (Choices: 'automatic', 'manual', or null) - Only relevant if `has_testing=True`

**Constraints:**
- Unique constraint on `(model_no, part_no)` combination to prevent duplicates

---

## Django Model Code

```python
from django.db import models
from django.utils import timezone

class PartProcedure(models.Model):
    """
    Main table storing Model No, Part No, and workflow section flags.
    Each row represents a procedure configuration for a specific part.
    """
    
    # Main identifiers
    model_no = models.CharField(max_length=100, db_index=True)
    part_no = models.CharField(max_length=100, db_index=True)
    
    # File uploads
    form_image = models.ImageField(upload_to='procedure_images/', null=True, blank=True)
    qc_video = models.FileField(upload_to='qc_videos/', null=True, blank=True)
    testing_video = models.FileField(upload_to='testing_videos/', null=True, blank=True)
    
    # Workflow section flags (boolean)
    has_smd = models.BooleanField(default=False, verbose_name="SMD")
    has_leaded = models.BooleanField(default=False, verbose_name="Leaded")
    has_prod_qc = models.BooleanField(default=False, verbose_name="Production QC")
    has_qc = models.BooleanField(default=False, verbose_name="QC")
    has_testing = models.BooleanField(default=False, verbose_name="Testing")
    has_glueing = models.BooleanField(default=False, verbose_name="Glueing")
    has_cleaning = models.BooleanField(default=False, verbose_name="Cleaning")
    has_spraying = models.BooleanField(default=False, verbose_name="Spraying")
    has_dispatch = models.BooleanField(default=False, verbose_name="Dispatch")
    
    # Testing mode (only relevant if has_testing=True)
    TESTING_MODE_CHOICES = [
        ('automatic', 'Automatic'),
        ('manual', 'Manual'),
    ]
    testing_mode = models.CharField(
        max_length=20,
        choices=TESTING_MODE_CHOICES,
        null=True,
        blank=True,
        verbose_name="Testing Mode"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'part_procedure'
        verbose_name = 'Part Procedure'
        verbose_name_plural = 'Part Procedures'
        # Ensure unique combination of model_no and part_no
        unique_together = [['model_no', 'part_no']]
        indexes = [
            models.Index(fields=['model_no', 'part_no']),
            models.Index(fields=['model_no']),
        ]
    
    def __str__(self):
        return f"{self.model_no} - {self.part_no}"
    
    def get_enabled_sections(self):
        """Returns a list of enabled workflow section names"""
        sections = []
        if self.has_smd:
            sections.append('SMD')
        if self.has_leaded:
            sections.append('Leaded')
        if self.has_prod_qc:
            sections.append('Production QC')
        if self.has_qc:
            sections.append('QC')
        if self.has_testing:
            sections.append('Testing')
        if self.has_glueing:
            sections.append('Glueing')
        if self.has_cleaning:
            sections.append('Cleaning')
        if self.has_spraying:
            sections.append('Spraying')
        if self.has_dispatch:
            sections.append('Dispatch')
        return sections
```

---

## Alternative Approach: Using JSONField (More Flexible)

If you want more flexibility for future changes, you could use a JSONField to store workflow sections:

```python
class PartProcedure(models.Model):
    model_no = models.CharField(max_length=100, db_index=True)
    part_no = models.CharField(max_length=100, db_index=True)
    
    form_image = models.ImageField(upload_to='procedure_images/', null=True, blank=True)
    qc_video = models.FileField(upload_to='qc_videos/', null=True, blank=True)
    testing_video = models.FileField(upload_to='testing_videos/', null=True, blank=True)
    
    # Store workflow sections as JSON
    workflow_sections = models.JSONField(default=dict, help_text="Stores enabled workflow sections")
    # Example: {"smd": true, "qc": true, "testing": true, "testing_mode": "automatic"}
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['model_no', 'part_no']]
```

**Pros of JSONField:**
- More flexible, easier to add new sections
- Less schema changes needed

**Cons of JSONField:**
- Harder to query specific sections
- Less type-safe
- Database-level constraints are harder

---

## Recommendation

I recommend the **first approach (Boolean Fields)** because:
1. ✅ Better database performance for queries
2. ✅ Type-safe and clear schema
3. ✅ Easy to query (e.g., "get all parts with QC enabled")
4. ✅ Better for database indexing
5. ✅ Clearer in Django admin

---

## Form Data Mapping

When the form is submitted, map the checkbox states to the model:

```python
# Example mapping from form data
part_procedure = PartProcedure.objects.create(
    model_no=form.cleaned_data['model_no'],
    part_no=form.cleaned_data['part_no'],
    form_image=form.cleaned_data.get('form_image'),
    qc_video=form.cleaned_data.get('qc_video'),
    testing_video=form.cleaned_data.get('testing_video'),
    has_smd=form.cleaned_data.get('has_smd', False),
    has_leaded=form.cleaned_data.get('has_leaded', False),
    has_prod_qc=form.cleaned_data.get('has_prod_qc', False),
    has_qc=form.cleaned_data.get('has_qc', False),
    has_testing=form.cleaned_data.get('has_testing', False),
    has_glueing=form.cleaned_data.get('has_glueing', False),
    has_cleaning=form.cleaned_data.get('has_cleaning', False),
    has_spraying=form.cleaned_data.get('has_spraying', False),
    has_dispatch=form.cleaned_data.get('has_dispatch', False),
    testing_mode=form.cleaned_data.get('testing_mode'),
)
```

---

## Next Steps

1. Review this schema
2. Decide on Boolean Fields vs JSONField approach
3. Implement the model
4. Create and run migrations
5. Update the form view to save data accordingly

