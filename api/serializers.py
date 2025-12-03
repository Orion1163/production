from rest_framework import serializers
from .models import User, Admin, ModelPart, PartProcedureDetail


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = '__all__'


class AdminLoginSerializer(serializers.Serializer):
    emp_id = serializers.IntegerField()
    pin = serializers.IntegerField()


class ModelPartSerializer(serializers.ModelSerializer):
    """Serializer for individual ModelPart"""
    form_image_url = serializers.SerializerMethodField()
    part_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ModelPart
        fields = '__all__'
    
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
