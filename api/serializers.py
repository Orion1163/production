from rest_framework import serializers
from .models import User, Admin, ModelPart, PartProcedureDetail


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class AdminSerializer(serializers.ModelSerializer):
    role_name = serializers.SerializerMethodField()
    role_display_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Admin
        fields = '__all__'
    
    def get_role_name(self, obj):
        """Get the role name (superadmin or admin)."""
        return obj.get_role_name()
    
    def get_role_display_name(self, obj):
        """Get the display name for the role."""
        return obj.get_role_display_name()


class AdminLoginSerializer(serializers.Serializer):
    emp_id = serializers.IntegerField()
    pin = serializers.IntegerField()


class ModelPartSerializer(serializers.ModelSerializer):
    """Serializer for individual ModelPart"""
    form_image_url = serializers.SerializerMethodField()
    part_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ModelPart
        fields = ['id', 'model_no', 'part_no', 'part_image', 'form_image_url', 'part_image_url']
    
    def get_form_image_url(self, obj):
        if obj.form_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.form_image.url)
            return obj.form_image.url
        return None
    
    def get_part_image_url(self, obj):
        if obj.part_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.part_image.url)
            return obj.part_image.url
        return None


class ModelPartGroupSerializer(serializers.Serializer):
    """Serializer for grouping ModelParts by model_no"""
    model_no = serializers.CharField()
    product_name = serializers.SerializerMethodField()
    parts = serializers.SerializerMethodField()
    part_numbers = serializers.SerializerMethodField()
    display_image = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    
    def get_product_name(self, obj):
        """Return model_no as product name"""
        return obj.get('model_no', '')
    
    def get_parts(self, obj):
        """Serialize the parts list"""
        parts = obj.get('parts', [])
        serializer = ModelPartSerializer(parts, many=True, context=self.context)
        return serializer.data
    
    def get_part_numbers(self, obj):
        """Return comma-separated list of part numbers"""
        parts = obj.get('parts', [])
        return ', '.join([part.part_no for part in parts])
    
    def get_display_image(self, obj):
        """Return the first available image (form_image or part_image)"""
        parts = obj.get('parts', [])
        request = self.context.get('request')
        
        for part in parts:
            if part.form_image:
                if request:
                    return request.build_absolute_uri(part.form_image.url)
                return part.form_image.url
            if part.part_image:
                if request:
                    return request.build_absolute_uri(part.part_image.url)
                return part.part_image.url
        return None


class PartProcedureDetailSerializer(serializers.ModelSerializer):
    part_no = serializers.CharField(source='model_part.part_no', read_only=True)
    model_no = serializers.CharField(source='model_part.model_no', read_only=True)
    part_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = PartProcedureDetail
        fields = '__all__'
    
    def get_part_image_url(self, obj):
        if obj.model_part.part_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.model_part.part_image.url)
            return obj.model_part.part_image.url
        return None


class ProcedureDetailSerializer(serializers.Serializer):
    """Serializer for complete procedure details grouped by model"""
    model_no = serializers.CharField()
    parts = PartProcedureDetailSerializer(many=True, read_only=True)


class ProductionProcedureSerializer(serializers.Serializer):
    """
    Serializer for handling production procedure form submission.
    Handles both ModelPart and PartProcedureDetail creation.
    """
    model_no = serializers.CharField(required=True)
    form_image = serializers.ImageField(required=False, allow_null=True)
    qc_video = serializers.FileField(required=False, allow_null=True)
    testing_video = serializers.FileField(required=False, allow_null=True)
    parts = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        help_text='List of parts with their configurations'
    )

    def validate_parts(self, value):
        """Validate that parts list is not empty."""
        if not value:
            raise serializers.ValidationError("At least one part is required.")
        return value

    def create(self, validated_data):
        """
        Create ModelPart and PartProcedureDetail records for each part.
        """
        model_no = validated_data['model_no']
        form_image = validated_data.get('form_image')
        qc_video = validated_data.get('qc_video')
        testing_video = validated_data.get('testing_video')
        parts_data = validated_data['parts']
        
        created_parts = []
        
        for part_data in parts_data:
            part_no = part_data.get('part_no')
            if not part_no:
                continue
            
            # Get or create ModelPart
            model_part, created = ModelPart.objects.get_or_create(
                model_no=model_no,
                part_no=part_no
            )
            
            # Update files if provided
            part_image = part_data.get('part_image')
            
            if part_image:
                model_part.part_image = part_image
            
            # Update form-level files (only set if not already set or if this is first part)
            if form_image and (created or not model_part.form_image):
                model_part.form_image = form_image
            if qc_video and (created or not model_part.qc_video):
                model_part.qc_video = qc_video
            if testing_video and (created or not model_part.testing_video):
                model_part.testing_video = testing_video
            
            model_part.save()
            
            # Create or update PartProcedureDetail
            procedure_config = part_data.get('procedure_config', {})
            procedure_detail, _ = PartProcedureDetail.objects.update_or_create(
                model_part=model_part,
                defaults={
                    'procedure_config': procedure_config
                }
            )
            
            # Dynamic model will be created automatically via signal
            created_parts.append({
                'model_part_id': model_part.id,
                'part_no': part_no,
                'procedure_detail_id': procedure_detail.id
            })
        
        return {
            'model_no': model_no,
            'created_parts': created_parts,
            'message': f'Successfully created procedure for {len(created_parts)} part(s)'
        }

    def update(self, model_no, validated_data):
        """
        Update ModelPart and PartProcedureDetail records for each part.
        Also updates existing entries in dynamic tables when new fields/sections are added.
        """
        form_image = validated_data.get('form_image')
        qc_video = validated_data.get('qc_video')
        testing_video = validated_data.get('testing_video')
        parts_data = validated_data['parts']
        
        updated_parts = []
        
        for part_data in parts_data:
            part_no = part_data.get('part_no')
            if not part_no:
                continue
            
            # Get existing ModelPart
            try:
                model_part = ModelPart.objects.get(
                    model_no=model_no,
                    part_no=part_no
                )
            except ModelPart.DoesNotExist:
                # If part doesn't exist, create it (shouldn't happen in edit mode, but handle gracefully)
                model_part = ModelPart.objects.create(
                    model_no=model_no,
                    part_no=part_no
                )
            
            # Update files if provided
            part_image = part_data.get('part_image')
            if part_image:
                model_part.part_image = part_image
            
            # Update form-level files if provided
            if form_image:
                model_part.form_image = form_image
            if qc_video:
                model_part.qc_video = qc_video
            if testing_video:
                model_part.testing_video = testing_video
            
            model_part.save()
            
            # Get existing procedure detail to compare configs
            old_procedure_detail = None
            old_procedure_config = {}
            try:
                old_procedure_detail = model_part.procedure_detail
                old_procedure_config = old_procedure_detail.procedure_config.copy()
            except PartProcedureDetail.DoesNotExist:
                pass
            
            # Update or create PartProcedureDetail
            new_procedure_config = part_data.get('procedure_config', {})
            procedure_detail, created = PartProcedureDetail.objects.update_or_create(
                model_part=model_part,
                defaults={
                    'procedure_config': new_procedure_config
                }
            )
            
            # If this is an update (not creation), check for new fields/sections and removed sections
            if not created and old_procedure_detail:
                # Update existing entries with defaults for new fields
                self._update_existing_entries_with_new_fields(
                    part_no, old_procedure_config, new_procedure_config
                )
                # Note: Column removal is handled automatically by create_dynamic_table_in_db
                # which compares model fields to database columns and removes extra ones
            
            # Dynamic model will be created/updated automatically via signal
            updated_parts.append({
                'model_part_id': model_part.id,
                'part_no': part_no,
                'procedure_detail_id': procedure_detail.id
            })
        
        return {
            'model_no': model_no,
            'updated_parts': updated_parts,
            'message': f'Successfully updated procedure for {len(updated_parts)} part(s)'
        }
    
    def _update_existing_entries_with_new_fields(self, part_no, old_config, new_config):
        """
        Update existing entries in dynamic tables when new fields/sections are added.
        Sets default values: True for checkboxes, empty string for text fields.
        """
        from api.dynamic_models import DynamicModelRegistry
        
        try:
            # Get both in_process and completion models from registry
            models_dict = DynamicModelRegistry.get_both(part_no)
            if not models_dict:
                return
            
            in_process_model = models_dict.get('in_process')
            completion_model = models_dict.get('completion')
            
            models_to_update = []
            if in_process_model:
                models_to_update.append(('in_process', in_process_model))
            if completion_model:
                models_to_update.append(('completion', completion_model))
            
            for table_type, model_class in models_to_update:
                # Find new sections that were enabled
                new_sections = []
                for section_key, section_data in new_config.items():
                    if section_data.get('enabled', False):
                        old_section_data = old_config.get(section_key, {})
                        if not old_section_data.get('enabled', False):
                            new_sections.append(section_key)
                
                # Find new custom fields and checkboxes in existing sections
                new_fields = {}  # {field_name: 'checkbox' or 'text'}
                
                for section_key, section_data in new_config.items():
                    if not section_data.get('enabled', False):
                        continue
                    
                    old_section_data = old_config.get(section_key, {})
                    
                    # Check for new custom input fields
                    new_custom_fields = section_data.get('custom_fields', [])
                    old_custom_fields = old_section_data.get('custom_fields', [])
                    
                    old_field_names = set()
                    for field in old_custom_fields:
                        if isinstance(field, dict):
                            old_field_names.add(field.get('name', ''))
                        else:
                            old_field_names.add(str(field))
                    
                    for field in new_custom_fields:
                        field_name = field.get('name', '') if isinstance(field, dict) else str(field)
                        if field_name and field_name not in old_field_names:
                            # Generate the full field name with section prefix
                            full_field_name = f"{section_key}_{field_name}".lower().replace(' ', '_')
                            new_fields[full_field_name] = 'text'
                    
                    # Check for new custom checkboxes
                    new_custom_checkboxes = section_data.get('custom_checkboxes', [])
                    old_custom_checkboxes = old_section_data.get('custom_checkboxes', [])
                    
                    old_checkbox_names = set()
                    for checkbox in old_custom_checkboxes:
                        if isinstance(checkbox, dict):
                            old_checkbox_names.add(checkbox.get('name', ''))
                        else:
                            old_checkbox_names.add(str(checkbox))
                    
                    for checkbox in new_custom_checkboxes:
                        checkbox_name = checkbox.get('name', '') if isinstance(checkbox, dict) else str(checkbox)
                        if checkbox_name and checkbox_name not in old_checkbox_names:
                            # Generate the full field name with section prefix
                            full_field_name = f"{section_key}_{checkbox_name}".lower().replace(' ', '_')
                            new_fields[full_field_name] = 'checkbox'
                
                # Update existing entries with default values for new fields
                # Note: We need to wait for the signal to update the model first
                # So we'll do this after a short delay or in a separate task
                # For now, we'll update after the model is recreated by the signal
                if new_fields or new_sections:
                    # The signal will recreate the models with new fields
                    # We'll update entries after the models are updated
                    # This is handled by checking field existence in the model
                    try:
                        # Wait a moment for signal to process
                        import time
                        time.sleep(0.5)
                        
                        # Refresh models from registry (they may have been recreated)
                        models_dict = DynamicModelRegistry.get_both(part_no)
                        if models_dict:
                            model_class = models_dict.get(table_type)
                            if model_class:
                                # Get all existing entries
                                all_entries = model_class.objects.all()
                                
                                # Build update dictionary by checking actual model fields
                                update_dict = {}
                                
                                # Check each potential new field
                                for potential_field_name, field_type in new_fields.items():
                                    # Try to find the field in the model
                                    # Field names might have been sanitized
                                    for field in model_class._meta.get_fields():
                                        if field.name == potential_field_name or \
                                           field.name.endswith('_' + potential_field_name.split('_')[-1]):
                                            if field_type == 'checkbox':
                                                update_dict[field.name] = True
                                            else:  # text field
                                                update_dict[field.name] = ''
                                            break
                                
                                # For new sections, set all section fields to defaults
                                # This is handled by the field addition above
                                
                                # Bulk update if we have fields to update
                                if update_dict:
                                    all_entries.update(**update_dict)
                    except Exception as e:
                        # Log error but don't fail the update
                        import sys
                        import traceback
                        traceback.print_exception(*sys.exc_info(), file=sys.stderr)
        
        except Exception as e:
            # Log error but don't fail the update
            import sys
            import traceback
            traceback.print_exception(*sys.exc_info(), file=sys.stderr)


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_models = serializers.IntegerField()
    total_parts = serializers.IntegerField()
    total_users = serializers.IntegerField()
    total_procedures = serializers.IntegerField()
    total_production_entries = serializers.IntegerField()
    recent_models_count = serializers.IntegerField()
    recent_parts_count = serializers.IntegerField()


class DashboardChartDataSerializer(serializers.Serializer):
    """Serializer for dashboard chart data"""
    models_over_time = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of {date, count} objects for line chart'
    )
    parts_by_model = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of {model_no, count} objects for bar/pie chart'
    )
    production_by_section = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of {section, count} objects for production progress'
    )
    recent_activity = serializers.ListField(
        child=serializers.DictField(),
        help_text='List of recent activities with timestamp and description'
    )


class UserModelListSerializer(serializers.Serializer):
    """Serializer for user model list - returns model_no, image, and part numbers"""
    model_no = serializers.CharField()
    image_url = serializers.SerializerMethodField()
    part_numbers = serializers.SerializerMethodField()
    part_count = serializers.SerializerMethodField()
    
    def get_image_url(self, obj):
        """Return the first available image (form_image or part_image)"""
        parts = obj.get('parts', [])
        request = self.context.get('request')
        
        for part in parts:
            if part.form_image:
                if request:
                    return request.build_absolute_uri(part.form_image.url)
                return part.form_image.url
            if part.part_image:
                if request:
                    return request.build_absolute_uri(part.part_image.url)
                return part.part_image.url
        return None
    
    def get_part_numbers(self, obj):
        """Return list of part numbers for this model"""
        parts = obj.get('parts', [])
        return [part.part_no for part in parts]
    
    def get_part_count(self, obj):
        """Return count of parts for this model"""
        parts = obj.get('parts', [])
        return len(parts)


class KitVerificationSerializer(serializers.Serializer):
    """Serializer for kit verification data"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the kit verification')
    kit_no = serializers.CharField(required=True, help_text='Kit number')
    kit_quantity = serializers.IntegerField(required=True, help_text='Kit quantity')
    kit_verification = serializers.BooleanField(required=True, help_text='Kit verification status')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom field values from procedure config')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox values from procedure config')


class SMDDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching SMD data by SO No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')


class SMDUpdateSerializer(serializers.Serializer):
    """Serializer for updating SMD data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    smd_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the SMD')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class SMDQCDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching SMD QC data by SO No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')


class SMDQCUpdateSerializer(serializers.Serializer):
    """Serializer for updating SMD QC data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    smd_qc_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the SMD QC')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class PreFormingQCDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching Pre-Forming QC data by SO No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')


class PreFormingQCUpdateSerializer(serializers.Serializer):
    """Serializer for updating Pre-Forming QC data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    pre_forming_qc_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the Pre-Forming QC')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class LeadedQCDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching Leaded QC data by SO No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')


class LeadedQCUpdateSerializer(serializers.Serializer):
    """Serializer for updating Leaded QC data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    leaded_qc_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the Leaded QC')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class LeadedDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching Leaded data by Kit No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')


class LeadedUpdateSerializer(serializers.Serializer):
    """Serializer for updating Leaded data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    leaded_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the Leaded processing')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class ProdQCDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching Prod QC data by SO No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')


class ProdQCUpdateSerializer(serializers.Serializer):
    """Serializer for updating Prod QC data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    prodqc_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the Prod QC')
    production_qc = serializers.BooleanField(required=False, default=True, help_text='Alternative field name for Prod QC boolean')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class AccessoriesPackingDataFetchSerializer(serializers.Serializer):
    """Serializer for fetching Accessories Packing data by SO No"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    so_no = serializers.CharField(required=True, help_text='Sales Order Number')


class AccessoriesPackingUpdateSerializer(serializers.Serializer):
    """Serializer for updating Accessories Packing data with forwarding quantity"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    kit_no = serializers.CharField(required=True, help_text='Kit Number')
    forwarding_quantity = serializers.IntegerField(required=True, min_value=0, help_text='Quantity to forward to next section')
    accessories_packing_done_by = serializers.CharField(required=True, help_text='Name/ID of person who did the Accessories Packing')
    custom_fields = serializers.DictField(required=False, allow_null=True, help_text='Custom text/input field values')
    custom_checkboxes = serializers.DictField(required=False, allow_null=True, help_text='Custom checkbox name -> checked')


class QCProcedureConfigSerializer(serializers.Serializer):
    """Serializer for QC procedure configuration - extracts custom fields and checkboxes"""
    part_no = serializers.CharField(read_only=True)
    custom_fields = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text='List of custom input fields for QC section'
    )
    custom_checkboxes = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text='List of custom checkboxes for QC section'
    )
    enabled = serializers.BooleanField(read_only=True, help_text='Whether QC section is enabled')


class TestingProcedureConfigSerializer(serializers.Serializer):
    """Serializer for Testing procedure configuration - extracts mode, custom fields and checkboxes"""
    part_no = serializers.CharField(read_only=True)
    mode = serializers.CharField(read_only=True, help_text='Testing mode: Automatic or Manual')
    custom_fields = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text='List of custom input fields for Testing section (manual mode only)'
    )
    custom_checkboxes = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text='List of custom checkboxes for Testing section (manual mode only)'
    )
    enabled = serializers.BooleanField(read_only=True, help_text='Whether Testing section is enabled')


class DispatchProcedureConfigSerializer(serializers.Serializer):
    """Serializer for Dispatch procedure configuration - extracts custom fields and checkboxes"""
    part_no = serializers.CharField(read_only=True)
    model_no = serializers.CharField(read_only=True)
    custom_fields = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text='List of custom input fields for Dispatch section'
    )
    custom_checkboxes = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text='List of custom checkboxes for Dispatch section'
    )
    enabled = serializers.BooleanField(read_only=True, help_text='Whether Dispatch section is enabled')
    is_primary = serializers.BooleanField(read_only=True, help_text='Whether this is the primary part (matching current part_no)')


class QCSubmitSerializer(serializers.Serializer):
    """Serializer for submitting QC data to completion table"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    incoming_batch_no = serializers.CharField(required=False, allow_blank=True, help_text='Incoming Batch Number')
    qc_done_by = serializers.CharField(required=False, allow_blank=True, help_text='Person who did the QC')
    # Dynamic fields - these will be validated based on procedure_config
    custom_fields = serializers.DictField(
        required=False,
        allow_null=True,
        help_text='Dictionary of custom field values (field_name: value)'
    )
    custom_checkboxes = serializers.DictField(
        required=False,
        allow_null=True,
        help_text='Dictionary of custom checkbox values (checkbox_name: true/false)'
    )


class TestingSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Testing data to completion table"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    testing_done_by = serializers.CharField(required=False, allow_blank=True, help_text='Person who did the Testing')
    mode = serializers.CharField(required=True, help_text='Testing mode: Automatic or Manual')
    # For automatic mode
    test_message = serializers.CharField(required=False, allow_blank=True, help_text='Test message (for automatic mode)')
    # For manual mode - Dynamic fields
    custom_fields = serializers.DictField(
        required=False,
        allow_null=True,
        help_text='Dictionary of custom field values (field_name: value) - for manual mode'
    )
    custom_checkboxes = serializers.DictField(
        required=False,
        allow_null=True,
        help_text='Dictionary of custom checkbox values (checkbox_name: true/false) - for manual mode'
    )


class HeatRunSerialNumberSearchSerializer(serializers.Serializer):
    """Serializer for Heat Run serial number search response"""
    usid = serializers.CharField(read_only=True, help_text='Unique Serial ID')
    serial_number = serializers.CharField(read_only=True, help_text='Serial Number')
    part_no = serializers.CharField(read_only=True, help_text='Part number')
    message = serializers.CharField(read_only=True, help_text='Response message')


class HeatRunEntrySerializer(serializers.Serializer):
    """Serializer for a single Heat Run entry"""
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')


class HeatRunSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Heat Run data to completion table (multiple entries)"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    entries = HeatRunEntrySerializer(many=True, required=True, help_text='List of entries with serial_number and usid')
    heat_run = serializers.BooleanField(required=True, help_text='Heat Run checkbox value')


class CleaningEntrySerializer(serializers.Serializer):
    """Serializer for a single Cleaning entry"""
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')


class CleaningSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Cleaning data to completion table (multiple entries)"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    entries = CleaningEntrySerializer(many=True, required=True, help_text='List of entries with serial_number and usid')
    cleaning = serializers.BooleanField(required=True, help_text='Cleaning checkbox value')


class GlueingEntrySerializer(serializers.Serializer):
    """Serializer for a single Glueing entry"""
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')


class GlueingSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Glueing data to completion table (multiple entries)"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    entries = GlueingEntrySerializer(many=True, required=True, help_text='List of entries with serial_number and usid')
    glueing = serializers.BooleanField(required=True, help_text='Glueing checkbox value')


class SprayingEntrySerializer(serializers.Serializer):
    """Serializer for a single Spraying entry"""
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')


class SprayingSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Spraying data to completion table (multiple entries)"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    entries = SprayingEntrySerializer(many=True, required=True, help_text='List of entries with serial_number and usid')
    spraying = serializers.BooleanField(required=True, help_text='Spraying checkbox value')


class ProgrammingEntrySerializer(serializers.Serializer):
    """Serializer for a single Programming entry"""
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')


class ProgrammingSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Programming data to completion table (multiple entries)"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    entries = ProgrammingEntrySerializer(many=True, required=True, help_text='List of entries with serial_number and usid')
    programming = serializers.BooleanField(required=True, help_text='Programming checkbox value')


class DispatchEntrySerializer(serializers.Serializer):
    """Serializer for a single Dispatch entry"""
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')


class DispatchPartDataSerializer(serializers.Serializer):
    """Serializer for dispatch data for a single part"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    entries = DispatchEntrySerializer(many=True, required=True, help_text='List of entries with serial_number and usid')
    # Custom fields and checkboxes for this part
    custom_fields = serializers.DictField(
        required=False,
        allow_null=True,
        help_text='Dictionary of custom field values (field_name: value)'
    )
    custom_checkboxes = serializers.DictField(
        required=False,
        allow_null=True,
        help_text='Dictionary of custom checkbox values (checkbox_name: true/false)'
    )


class DispatchSubmitSerializer(serializers.Serializer):
    """Serializer for submitting Dispatch data - links entries to in_process table and updates completion table"""
    # Primary part data (has outgoing batch and serial number)
    primary_part = DispatchPartDataSerializer(required=True, help_text='Primary part dispatch data')
    outgoing_batch_no = serializers.CharField(required=True, help_text='Outgoing Batch Number (SO Number)')
    outgoing_serial_no = serializers.CharField(required=True, help_text='Outgoing Serial Number (common linking field)')
    dispatch_done_by = serializers.CharField(required=False, allow_blank=True, help_text='Person who did the Dispatch')
    # Additional parts data
    additional_parts = DispatchPartDataSerializer(many=True, required=False, default=list, help_text='Additional parts dispatch data')
    dispatch = serializers.BooleanField(required=True, help_text='Dispatch checkbox value')


class QCImagesSubmitSerializer(serializers.Serializer):
    """Serializer for submitting QC Images data to completion table"""
    part_no = serializers.CharField(required=True, help_text='Part number (e.g., EICS145)')
    serial_number = serializers.CharField(required=True, help_text='Serial Number (Tag No.)')
    usid = serializers.CharField(required=True, help_text='Unique Serial ID')
    qc_images_done_by = serializers.CharField(required=False, allow_blank=True, help_text='Person who did the QC Images')
    qc_images = serializers.BooleanField(required=True, help_text='QC Images checkbox value')
