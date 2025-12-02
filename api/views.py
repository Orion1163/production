from .models import User, Admin, ModelPart, PartProcedureDetail
from .serializers import (
    UserSerializer, AdminSerializer, ProductionProcedureSerializer, 
    ModelPartGroupSerializer, ProcedureDetailSerializer, PartProcedureDetailSerializer
)
from django.db.models import Max
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import JsonResponse


class UserListCreateView(APIView):
    """
    Handle listing all users and creating a new user profile.
    """

    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    """
    Handle retrieving and updating a single user.
    """

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self.get_object(pk)
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        user = self.get_object(pk)
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserSerializer(user, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminLoginView(APIView):
    """
    Handle admin login authentication.
    """
    
    def post(self, request):
        emp_id = request.data.get('emp_id')
        pin = request.data.get('pin')
        
        # Validate required fields
        if not emp_id or not pin:
            return Response(
                {'error': 'emp_id and pin are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Convert pin to integer for comparison
            pin = int(pin)
            emp_id = int(emp_id)
        except (ValueError, TypeError):
            return Response(
                {'error': 'emp_id and pin must be valid numbers'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if admin exists and pin matches
        try:
            admin = Admin.objects.get(emp_id=emp_id)
            if admin.pin != pin:
                return Response(
                    {'error': 'Invalid credentials'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
        except Admin.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Store admin info in session
        request.session['admin_emp_id'] = admin.emp_id
        request.session['admin_logged_in'] = True
        
        # Return admin data
        serializer = AdminSerializer(admin)
        return Response(
            {
                'message': 'Login successful',
                'admin': serializer.data
            }, 
            status=status.HTTP_200_OK
        )


class AdminLogoutView(APIView):
    """
    Handle admin logout.
    """
    
    def post(self, request):
        # Clear session data
        if 'admin_emp_id' in request.session:
            del request.session['admin_emp_id']
        if 'admin_logged_in' in request.session:
            del request.session['admin_logged_in']
        
        # Flush the session
        request.session.flush()
        
        return Response(
            {'message': 'Logout successful'}, 
            status=status.HTTP_200_OK
        )


class AdminProfileView(APIView):
    """
    Get current admin's profile details.
    """
    
    def get(self, request):
        # Check if admin is logged in
        if not request.session.get('admin_logged_in', False):
            return Response(
                {'error': 'Not authenticated'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        emp_id = request.session.get('admin_emp_id')
        if not emp_id:
            return Response(
                {'error': 'Admin ID not found in session'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            admin = Admin.objects.get(emp_id=emp_id)
            serializer = AdminSerializer(admin)
            return Response({
                'admin': serializer.data
            }, status=status.HTTP_200_OK)
        except Admin.DoesNotExist:
            return Response(
                {'error': 'Admin not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class ProductionProcedureCreateView(APIView):
    """
    Handle production procedure form submission.
    Creates ModelPart and PartProcedureDetail records.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def post(self, request):
        # Check if admin is logged in
        if not request.session.get('admin_logged_in', False):
            return Response(
                {'error': 'Not authenticated'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Parse the form data
            data = {
                'model_no': request.data.get('model_no'),
                'form_image': request.FILES.get('form_image'),
                'qc_video': request.FILES.get('qc_video'),
                'testing_video': request.FILES.get('testing_video'),
                'parts': self._extract_parts_data(request)
            }
            
            serializer = ProductionProcedureSerializer(data=data)
            if serializer.is_valid():
                result = serializer.save()
                
                # Create database tables for dynamic models
                import sys
                print("=" * 80, file=sys.stderr)
                print("CREATING DYNAMIC TABLES", file=sys.stderr)
                print("=" * 80, file=sys.stderr)
                
                from api.dynamic_model_utils import ensure_all_dynamic_tables_exist
                try:
                    table_result = ensure_all_dynamic_tables_exist()
                    print("Table creation result: %s" % table_result, file=sys.stderr)
                    # Add table creation info to response
                    result['tables_created'] = len(table_result.get('created', []))
                    result['tables_failed'] = len(table_result.get('failed', []))
                    if table_result.get('failed'):
                        result['table_errors'] = table_result.get('failed', [])
                    print("Tables created: %d, Failed: %d" % (result['tables_created'], result['tables_failed']), file=sys.stderr)
                except Exception as e:
                    print("ERROR creating dynamic tables: %s" % str(e), file=sys.stderr)
                    import traceback
                    traceback.print_exception(*sys.exc_info(), file=sys.stderr)
                
                print("=" * 80, file=sys.stderr)
                
                return Response(result, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _extract_parts_data(self, request):
        """
        Extract parts data from request.
        Handles both form data and JSON formats.
        """
        parts = []
        
        # Try to get parts from JSON data (sent as string in FormData)
        parts_json = request.data.get('parts')
        if parts_json:
            try:
                import json
                if isinstance(parts_json, str):
                    parts_data = json.loads(parts_json)
                else:
                    parts_data = parts_json
                
                # Map part images from FormData
                part_image_keys = [key for key in request.FILES.keys() if key.startswith('part_image_')]
                
                for i, part_data in enumerate(parts_data):
                    # Check if there's a corresponding part image
                    part_image_index = part_data.get('part_image_index')
                    if part_image_index is not None:
                        image_key = f'part_image_{part_image_index}'
                        if image_key in request.FILES:
                            part_data['part_image'] = request.FILES[image_key]
                    
                    # Remove the index reference
                    if 'part_image_index' in part_data:
                        del part_data['part_image_index']
                
                return parts_data
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                # Fall back to form data extraction
                pass
        
        # Extract from form data (parts are sent as arrays)
        part_nos = request.data.getlist('part_no[]')
        part_images = request.FILES.getlist('part_image[]')
        procedure_configs = request.data.getlist('procedure_config[]')
        
        for i, part_no in enumerate(part_nos):
            if not part_no:
                continue
            
            part_data = {
                'part_no': part_no,
                'part_image': part_images[i] if i < len(part_images) else None,
            }
            
            # Parse procedure_config if provided
            if i < len(procedure_configs) and procedure_configs[i]:
                try:
                    import json
                    part_data['procedure_config'] = json.loads(procedure_configs[i])
                except (json.JSONDecodeError, TypeError):
                    part_data['procedure_config'] = {}
            else:
                part_data['procedure_config'] = {}
            
            parts.append(part_data)
        
        return parts


class ModelPartListView(APIView):
    """
    List all ModelParts grouped by model_no.
    Returns data grouped by model with all parts for each model.
    """
    
    def get(self, request):
        # Group ModelParts by model_no
        model_parts = ModelPart.objects.all().order_by('-created_at')
        
        # Group by model_no
        grouped_data = {}
        for model_part in model_parts:
            model_no = model_part.model_no
            if model_no not in grouped_data:
                grouped_data[model_no] = {
                    'model_no': model_no,
                    'parts': [],
                    'created_at': model_part.created_at
                }
            grouped_data[model_no]['parts'].append(model_part)
        
        # Convert to list and sort by most recent created_at
        grouped_list = list(grouped_data.values())
        grouped_list.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Serialize the grouped data
        serializer = ModelPartGroupSerializer(
            grouped_list, 
            many=True,
            context={'request': request}
        )
        
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProcedureDetailView(APIView):
    """
    Get detailed procedure configuration for a specific model.
    Returns all parts with their procedure_config for the given model_no.
    """
    
    def get(self, request, model_no):
        try:
            # Get all ModelParts for this model
            model_parts = ModelPart.objects.filter(model_no=model_no)
            
            if not model_parts.exists():
                return Response(
                    {'error': f'No parts found for model {model_no}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get procedure details for each part
            parts_data = []
            for model_part in model_parts:
                try:
                    procedure_detail = PartProcedureDetail.objects.get(model_part=model_part)
                    parts_data.append(procedure_detail)
                except PartProcedureDetail.DoesNotExist:
                    # Part exists but no procedure detail yet
                    continue
            
            if not parts_data:
                return Response(
                    {'error': f'No procedure details found for model {model_no}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Serialize the data
            serializer = PartProcedureDetailSerializer(
                parts_data,
                many=True,
                context={'request': request}
            )
            
            return Response({
                'model_no': model_no,
                'parts': serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
