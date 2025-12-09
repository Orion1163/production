from .models import User, Admin, ModelPart, PartProcedureDetail
from .serializers import (
    UserSerializer, AdminSerializer, ProductionProcedureSerializer, 
    ModelPartGroupSerializer, ProcedureDetailSerializer, PartProcedureDetailSerializer,
    DashboardStatsSerializer, DashboardChartDataSerializer, UserModelListSerializer,
    ModelPartSerializer, KitVerificationSerializer
)
from django.db.models import Max, Count, Q
from django.db import connection
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import JsonResponse
from collections import defaultdict
import json


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
        # Store admin role (Administrator = role 1) in session for role-based access control
        request.session['user_roles'] = [1]  # Administrator role
        
        # Return admin data
        serializer = AdminSerializer(admin)
        return Response(
            {
                'message': 'Login successful',
                'admin': serializer.data
            }, 
            status=status.HTTP_200_OK
        )


class UserLoginView(APIView):
    """
    Handle user login authentication for normal users.
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
        
        # Check if user exists and pin matches
        try:
            user = User.objects.get(emp_id=emp_id)
            if user.pin != pin:
                return Response(
                    {'error': 'Invalid credentials'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Store user info in session
        request.session['user_emp_id'] = user.emp_id
        request.session['user_logged_in'] = True
        # Store user roles in session for role-based access control
        request.session['user_roles'] = user.roles if user.roles else []
        
        # Return full user details
        serializer = UserSerializer(user)
        return Response(
            {
                'message': 'Login successful',
                'user': serializer.data
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


class UserProfileView(APIView):
    """
    Get current user's profile details.
    """
    
    def get(self, request):
        # Check if user is logged in
        if not request.session.get('user_logged_in', False):
            return Response(
                {'error': 'Not authenticated'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        emp_id = request.session.get('user_emp_id')
        if not emp_id:
            return Response(
                {'error': 'User ID not found in session'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            user = User.objects.get(emp_id=emp_id)
            serializer = UserSerializer(user)
            return Response({
                'user': serializer.data
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
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


class DashboardStatsView(APIView):
    """
    Get dashboard statistics overview.
    Returns counts of models, parts, users, procedures, and production entries.
    """
    
    def get(self, request):
        try:
            # Basic counts
            total_models = ModelPart.objects.values('model_no').distinct().count()
            total_parts = ModelPart.objects.count()
            total_users = User.objects.count()
            total_procedures = PartProcedureDetail.objects.count()
            
            # Count production entries from dynamic tables
            total_production_entries = 0
            try:
                from .dynamic_models import DynamicModelRegistry
                from .dynamic_model_utils import get_dynamic_part_model
                
                all_dynamic_models = DynamicModelRegistry.get_all()
                for part_name, models_dict in all_dynamic_models.items():
                    # models_dict is {'in_process': model, 'completion': model}
                    for table_type, model_class in models_dict.items():
                        if model_class is None:
                            continue
                        try:
                            count = model_class.objects.count()
                            total_production_entries += count
                        except Exception:
                            # Table might not exist yet
                            continue
                
                # Also check database directly for any dynamic tables
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' 
                        AND (name LIKE 'part_%' OR name LIKE '%eics%')
                        AND name NOT LIKE 'sqlite_%'
                    """)
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    for table_name in tables:
                        try:
                            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                            count = cursor.fetchone()[0]
                            total_production_entries += count
                        except Exception:
                            continue
            except Exception as e:
                # If dynamic model counting fails, continue with 0
                pass
            
            # Recent activity (last 7 days)
            seven_days_ago = timezone.now() - timedelta(days=7)
            recent_models_count = ModelPart.objects.filter(created_at__gte=seven_days_ago).values('model_no').distinct().count()
            recent_parts_count = ModelPart.objects.filter(created_at__gte=seven_days_ago).count()
            
            stats = {
                'total_models': total_models,
                'total_parts': total_parts,
                'total_users': total_users,
                'total_procedures': total_procedures,
                'total_production_entries': total_production_entries,
                'recent_models_count': recent_models_count,
                'recent_parts_count': recent_parts_count
            }
            
            serializer = DashboardStatsSerializer(stats)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardChartDataView(APIView):
    """
    Get dashboard chart data for visualizations.
    Returns data for models over time, parts by model, production by section, and recent activity.
    """
    
    def get(self, request):
        try:
            # 1. Models over time (last 30 days)
            thirty_days_ago = timezone.now() - timedelta(days=30)
            models_over_time = []
            
            # Group by date (SQLite compatible)
            model_parts = ModelPart.objects.filter(
                created_at__gte=thirty_days_ago
            ).order_by('created_at')
            
            # Group by date in Python
            date_counts = defaultdict(set)  # Use set to count distinct model_nos
            for part in model_parts:
                date_str = part.created_at.date().isoformat()
                date_counts[date_str].add(part.model_no)
            
            # Convert to list format
            for date_str in sorted(date_counts.keys()):
                models_over_time.append({
                    'date': date_str,
                    'count': len(date_counts[date_str])
                })
            
            # 2. Parts by model
            parts_by_model = []
            model_counts = ModelPart.objects.values('model_no').annotate(
                count=Count('id')
            ).order_by('-count')
            
            for item in model_counts:
                parts_by_model.append({
                    'model_no': item['model_no'],
                    'count': item['count']
                })
            
            # 3. Production by section (from procedure details)
            production_by_section = []
            section_names = {
                'kit': 'Kit Verification',
                'smd': 'SMD',
                'smd_qc': 'SMD QC',
                'pre_forming_qc': 'Pre-Forming QC',
                'accessories_packing': 'Accessories Packing',
                'leaded_qc': 'Leaded QC',
                'prod_qc': 'Production QC',
                'qc': 'QC',
                'testing': 'Testing',
                'heat_run': 'Heat Run',
                'glueing': 'Glueing',
                'cleaning': 'Cleaning',
                'spraying': 'Spraying',
                'dispatch': 'Dispatch'
            }
            
            section_counts = defaultdict(int)
            procedure_details = PartProcedureDetail.objects.all()
            
            for detail in procedure_details:
                enabled_sections = detail.get_enabled_sections()
                for section in enabled_sections:
                    section_counts[section] += 1
            
            for section, count in section_counts.items():
                production_by_section.append({
                    'section': section_names.get(section, section.title()),
                    'count': count
                })
            
            # 4. Recent activity
            recent_activity = []
            
            # Recent model parts
            recent_parts = ModelPart.objects.order_by('-created_at')[:10]
            for part in recent_parts:
                recent_activity.append({
                    'timestamp': part.created_at.isoformat(),
                    'type': 'part_created',
                    'description': f'New part {part.part_no} added to model {part.model_no}',
                    'icon': 'part'
                })
            
            # Recent procedures
            recent_procedures = PartProcedureDetail.objects.order_by('-created_at')[:5]
            for proc in recent_procedures:
                recent_activity.append({
                    'timestamp': proc.created_at.isoformat(),
                    'type': 'procedure_created',
                    'description': f'Procedure configured for {proc.model_part.part_no}',
                    'icon': 'procedure'
                })
            
            # Sort by timestamp and limit to 15 most recent
            recent_activity.sort(key=lambda x: x['timestamp'], reverse=True)
            recent_activity = recent_activity[:15]
            
            chart_data = {
                'models_over_time': models_over_time,
                'parts_by_model': parts_by_model,
                'production_by_section': production_by_section,
                'recent_activity': recent_activity
            }
            
            serializer = DashboardChartDataSerializer(chart_data)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserModelListView(APIView):
    """
    Get list of models for user home page.
    Returns model_no, image, and part numbers grouped by model_no.
    """
    
    def get(self, request):
        try:
            # Get all ModelParts
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
            
            # Serialize the data
            serializer = UserModelListSerializer(
                grouped_list,
                many=True,
                context={'request': request}
            )
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserModelPartsView(APIView):
    """
    Get all parts for a specific model_no.
    Returns list of ModelPart objects for the given model.
    """
    
    def get(self, request, model_no):
        try:
            # Get all ModelParts for this model_no
            model_parts = ModelPart.objects.filter(model_no=model_no).order_by('-created_at')
            
            if not model_parts.exists():
                return Response(
                    {'error': f'No parts found for model {model_no}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Serialize using ModelPartSerializer
            serializer = ModelPartSerializer(
                model_parts,
                many=True,
                context={'request': request}
            )
            
            return Response({
                'model_no': model_no,
                'parts': serializer.data,
                'count': len(serializer.data)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserPartSectionsView(APIView):
    """
    Get enabled sections for a specific part_no.
    Returns list of enabled sections with their display names, filtered by user roles.
    """
    
    def get(self, request, part_no):
        try:
            # Get user roles from session
            user_roles = request.session.get('user_roles', [])
            
            # Import role utilities
            from frontend.role_constants import has_role_access, SECTION_NAMES
            
            # Get ModelPart by part_no
            try:
                model_part = ModelPart.objects.get(part_no=part_no)
            except ModelPart.DoesNotExist:
                return Response(
                    {'error': f'Part {part_no} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get procedure detail if it exists
            try:
                procedure_detail = model_part.procedure_detail
                enabled_sections = procedure_detail.get_enabled_sections()
            except PartProcedureDetail.DoesNotExist:
                # No procedure detail exists, return empty list
                enabled_sections = []
            
            # Filter sections by user roles - only return sections user has access to
            accessible_sections = []
            for section_key in enabled_sections:
                if has_role_access(user_roles, section_key):
                    accessible_sections.append(section_key)
            
            # Format sections with display names
            sections_data = []
            for section_key in accessible_sections:
                sections_data.append({
                    'key': section_key,
                    'name': SECTION_NAMES.get(section_key, section_key.replace('_', ' ').title())
                })
            
            return Response({
                'part_no': part_no,
                'model_no': model_part.model_no,
                'sections': sections_data,
                'count': len(sections_data)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class KitVerificationView(APIView):
    """
    POST API endpoint for kit verification.
    Creates an entry in the in_process table for the specified part number.
    """
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    
    def post(self, request):
        """
        Create a kit verification entry in the in_process table.
        
        Expected data:
        - part_no: Part number (required)
        - kit_done_by: Person who did the kit verification (required)
        - kit_no: Kit number (required)
        - kit_quantity: Kit quantity (required)
        - kit_verification: Boolean value for kit verification status (required)
        - so_no: Sales Order Number (optional)
        """
        try:
            # Validate serializer
            serializer = KitVerificationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            validated_data = serializer.validated_data
            part_no = validated_data['part_no']
            
            # Verify that the part exists
            try:
                model_part = ModelPart.objects.get(part_no=part_no)
            except ModelPart.DoesNotExist:
                return Response(
                    {'error': f'Part {part_no} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get or create the dynamic in_process model for this part
            from .dynamic_model_utils import get_or_create_part_data_model
            
            in_process_model = get_or_create_part_data_model(
                part_no,
                table_type='in_process'
            )
            
            if in_process_model is None:
                return Response(
                    {'error': f'In-process model not found for part {part_no}. Please ensure the part has a procedure configuration.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get all field names from the model
            # Use _meta.fields for actual database fields
            direct_field_names = [f.name for f in in_process_model._meta.fields]
            
            # Also check get_fields() but filter for actual model fields (not relations)
            model_field_names = []
            for field in in_process_model._meta.get_fields():
                # Only include actual model fields, not relations
                if hasattr(field, 'name'):
                    # Check if it's a relation field
                    if hasattr(field, 'is_relation') and field.is_relation:
                        continue
                    # Check if it's a reverse relation
                    if hasattr(field, 'related_model'):
                        continue
                    model_field_names.append(field.name)
            
            # Combine both lists and remove duplicates
            all_field_names = list(set(model_field_names + direct_field_names))
            
            # Debug: Log available fields (can be removed in production)
            import sys
            print(f"Available fields for {part_no} in_process model: {sorted(all_field_names)}", file=sys.stderr)
            
            # Helper function to find field name (try exact match, then variations, then partial match)
            def find_field_name(possible_names):
                # First try exact match
                for name in possible_names:
                    if name in all_field_names:
                        print(f"Found field '{name}' in field list (exact match)", file=sys.stderr)
                        return name
                    # Also check using hasattr and get_field
                    try:
                        in_process_model._meta.get_field(name)
                        print(f"Found field '{name}' using get_field", file=sys.stderr)
                        return name
                    except:
                        pass
                
                # If no exact match, try partial matching (case-insensitive)
                for name in possible_names:
                    # Remove underscores and compare
                    name_normalized = name.lower().replace('_', '')
                    for field_name in all_field_names:
                        field_normalized = field_name.lower().replace('_', '')
                        if name_normalized == field_normalized:
                            print(f"Found field '{field_name}' (partial match for '{name}')", file=sys.stderr)
                            return field_name
                        # Also check if field contains the name
                        if name_normalized in field_normalized or field_normalized in name_normalized:
                            print(f"Found field '{field_name}' (contains match for '{name}')", file=sys.stderr)
                            return field_name
                
                print(f"Field not found. Tried: {possible_names}, Available: {sorted(all_field_names)}", file=sys.stderr)
                return None
            
            # Prepare data for the dynamic model
            # Fields are prefixed with section name (kit_)
            entry_data = {}
            
            # Map kit_done_by
            kit_done_by_field = find_field_name(['kit_done_by', 'kit_kit_done_by'])
            if kit_done_by_field:
                entry_data[kit_done_by_field] = validated_data['kit_done_by']
            
            # Map kit_no
            # Token "Kit No." -> "kit_no" (lowercase, spaces to underscores)
            # Note: The token has a period "Kit No." which might affect processing
            # In dynamic model: if "kit_no" doesn't start with "kit_", it becomes "kit_kit_no"
            # But "kit_no" starts with "kit" not "kit_", so check: "kit_no".startswith("kit_") = False
            # So it should become "kit_kit_no"
            # However, let's try all variations including potential period handling
            kit_no_field = find_field_name([
                'kit_kit_no',           # Most likely: "kit_no" -> "kit_kit_no"
                'kit_no',               # If it was stored without prefix somehow
                'kit_no_',              # With trailing underscore
                'kit_no.',              # With period (if period wasn't stripped)
                'kit_kit_no.',          # With period and prefix
                'kitno',                # No underscore
                'kit_no_number',        # Alternative naming
                'kit_number',           # Shorter alternative
            ])
            if kit_no_field:
                entry_data[kit_no_field] = validated_data['kit_no']
            else:
                # Last resort: check if any field contains "no" or "number" related to kit
                import sys
                kit_related_fields = [f for f in all_field_names if 'kit' in f.lower() and ('no' in f.lower() or 'number' in f.lower())]
                if kit_related_fields:
                    print(f"Found kit-related 'no' fields: {kit_related_fields}, using first one: {kit_related_fields[0]}", file=sys.stderr)
                    entry_data[kit_related_fields[0]] = validated_data['kit_no']
            
            # Map kit_quantity
            # Token "Kit Quantity" -> "kit_quantity" -> "kit_kit_quantity"
            kit_quantity_field = find_field_name([
                'kit_kit_quantity',    # Most likely
                'kit_quantity',        # Without double prefix
                'kit_quantity_',       # With trailing underscore
                'kitquantity',         # No underscore
            ])
            if kit_quantity_field:
                entry_data[kit_quantity_field] = str(validated_data['kit_quantity'])  # Convert to string as CharField
            
            # Add SO No
            # Token "SO No." -> "so_no" -> "kit_so_no" (because "so_no" doesn't start with "kit_")
            if validated_data.get('so_no'):
                so_no_field = find_field_name([
                    'kit_so_no',       # Most likely: "so_no" -> "kit_so_no"
                    'so_no',           # Without prefix
                    'kit_so_no_',      # With trailing underscore
                    'so_no_',          # With trailing underscore, no prefix
                    'sono',            # No underscore
                    'kit_so_number',   # Alternative naming
                ])
                if so_no_field:
                    entry_data[so_no_field] = validated_data['so_no']
            
            # Add kit verification boolean field
            # The checkbox field name might be kit_kit, kit_kit_verification, or kit_verification
            kit_verification_value = validated_data['kit_verification']
            kit_verification_field = find_field_name(['kit_kit', 'kit_kit_verification', 'kit_verification'])
            if kit_verification_field:
                entry_data[kit_verification_field] = kit_verification_value
            
            # Debug: Log what we're trying to insert
            import sys
            print(f"Attempting to create entry with data: {entry_data}", file=sys.stderr)
            print(f"Available model fields: {sorted(all_field_names)}", file=sys.stderr)
            
            # Also try to get field names from the database table directly
            try:
                from django.db import connection
                table_name = in_process_model._meta.db_table
                with connection.cursor() as cursor:
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    db_columns = [row[1] for row in cursor.fetchall()]
                    print(f"Database columns in table '{table_name}': {sorted(db_columns)}", file=sys.stderr)
            except Exception as e:
                print(f"Could not query database columns: {e}", file=sys.stderr)
            
            # Check if we found the critical fields (kit_no and so_no)
            missing_fields = []
            has_kit_no = any('kit_no' in k or 'kit_no' == k for k in entry_data.keys())
            has_so_no = any('so_no' in k or 'so_no' == k for k in entry_data.keys())
            
            if not has_kit_no:
                missing_fields.append('kit_no (or kit_kit_no)')
            if not has_so_no:
                missing_fields.append('so_no (or kit_so_no)')
            
            if missing_fields:
                # Try to get database columns directly
                db_columns = []
                try:
                    from django.db import connection
                    table_name = in_process_model._meta.db_table
                    with connection.cursor() as cursor:
                        if connection.vendor == 'sqlite':
                            safe_table_name = table_name.replace('"', '""')
                            cursor.execute(f'PRAGMA table_info("{safe_table_name}")')
                            db_columns = [row[1] for row in cursor.fetchall()]
                        else:
                            cursor.execute("""
                                SELECT column_name FROM information_schema.columns 
                                WHERE table_name = %s
                            """, [table_name])
                            db_columns = [row[0] for row in cursor.fetchall()]
                except Exception as e:
                    import sys
                    print(f"Could not query database columns: {e}", file=sys.stderr)
                
                return Response(
                    {
                        'error': f'Required fields not found in model: {", ".join(missing_fields)}',
                        'message': 'The dynamic table does not have the required kit verification fields. Please ensure the part has a proper procedure configuration with kit section enabled and the fields "SO No.", "Kit No.", and "Kit Quantity" are configured.',
                        'part_no': part_no,
                        'available_model_fields': sorted(all_field_names),
                        'available_database_columns': sorted(db_columns) if db_columns else 'Could not query',
                        'missing_fields': missing_fields,
                        'fields_found': list(entry_data.keys()),
                        'expected_fields': ['kit_done_by', 'kit_no or kit_kit_no', 'kit_quantity or kit_kit_quantity', 'kit_so_no or so_no', 'kit_verification'],
                        'table_name': in_process_model._meta.db_table
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate that we have at least some fields to insert
            if not entry_data:
                return Response(
                    {
                        'error': 'No valid fields found to create entry',
                        'message': 'The dynamic table does not have any kit verification fields. Please ensure the part has a proper procedure configuration with kit section enabled.',
                        'part_no': part_no,
                        'available_fields': sorted(all_field_names)
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate that we have the essential kit verification fields
            required_field_patterns = {
                'kit_no': ['kit_no', 'kit_kit_no'],
                'kit_quantity': ['kit_quantity', 'kit_kit_quantity'],
                'kit_done_by': ['kit_done_by', 'kit_kit_done_by']
            }
            
            missing_essential_fields = []
            for field_name, patterns in required_field_patterns.items():
                found = False
                for pattern in patterns:
                    if any(pattern in key for key in entry_data.keys()):
                        found = True
                        break
                if not found:
                    missing_essential_fields.append(field_name)
            
            if missing_essential_fields:
                import sys
                print(f"ERROR: Missing essential fields: {missing_essential_fields}", file=sys.stderr)
                print(f"Entry data keys: {list(entry_data.keys())}", file=sys.stderr)
                print(f"Available model fields: {sorted(all_field_names)}", file=sys.stderr)
                return Response(
                    {
                        'error': f'Missing essential kit verification fields: {", ".join(missing_essential_fields)}',
                        'message': 'Could not map essential kit verification fields to the database model. Please ensure the part has a proper procedure configuration with kit section enabled and all required fields configured.',
                        'part_no': part_no,
                        'missing_fields': missing_essential_fields,
                        'entry_data_keys': list(entry_data.keys()),
                        'available_fields': sorted(all_field_names),
                        'validated_data': validated_data
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Also add the next section's available_quantity field to the same entry
            # Find the next enabled section and add its available_quantity field to entry_data
            next_section_name = None
            try:
                # Get enabled sections for this part
                procedure_detail = model_part.procedure_detail
                enabled_sections = procedure_detail.get_enabled_sections()
                
                # Find the index of 'kit' in enabled sections
                kit_index = None
                for i, section in enumerate(enabled_sections):
                    if section == 'kit':
                        kit_index = i
                        break
                
                # Find the next enabled section after kit
                if kit_index is not None and kit_index + 1 < len(enabled_sections):
                    next_section_name = enabled_sections[kit_index + 1]
                    
                    # Find the available_quantity field for the next section in the SAME in_process model
                    # Since both kit and next section (if pre-QC) are in the same in_process table
                    pre_qc_sections = ['kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing', 'leaded_qc', 'prod_qc']
                    
                    if next_section_name in pre_qc_sections:
                        # Next section is also in in_process table, so we can add its field to the same entry
                        # Field name pattern: {section}_available_quantity (e.g., smd_available_quantity)
                        available_quantity_field = None
                        possible_field_names = [
                            f'{next_section_name}_available_quantity',
                            'available_quantity',
                            f'{next_section_name}_availablequantity',
                            'availablequantity',
                        ]
                        
                        # Try exact match first
                        for field_name in possible_field_names:
                            if field_name in all_field_names:
                                available_quantity_field = field_name
                                break
                        
                        # If not found, try partial match (case-insensitive)
                        if not available_quantity_field:
                            for field_name in all_field_names:
                                field_lower = field_name.lower()
                                if 'available' in field_lower and 'quantity' in field_lower and next_section_name.lower() in field_lower:
                                    available_quantity_field = field_name
                                    break
                        
                        if available_quantity_field:
                            # Add the available_quantity field to the same entry_data
                            entry_data[available_quantity_field] = str(validated_data['kit_quantity'])
                            import sys
                            print(f"Added {next_section_name} section's available_quantity field ({available_quantity_field}) to kit verification entry", file=sys.stderr)
                        else:
                            import sys
                            print(f"Warning: available_quantity field not found for {next_section_name} section in in_process model. Available fields: {sorted(all_field_names)}", file=sys.stderr)
                    else:
                        # Next section is in completion table, so we can't add it to the same entry
                        # In this case, we'll skip adding it since it's in a different table
                        import sys
                        print(f"Info: Next section {next_section_name} is in completion table, cannot add to same entry", file=sys.stderr)
                else:
                    import sys
                    print(f"Info: No next enabled section found after kit for part {part_no}", file=sys.stderr)
                    
            except Exception as next_section_error:
                # Log error but don't fail the main kit verification
                import sys
                import traceback
                print(f"Warning: Could not add next section available_quantity to entry: {str(next_section_error)}", file=sys.stderr)
                print(f"Traceback: {traceback.format_exc()}", file=sys.stderr)
            
            # Create the entry in the in_process table (with both kit verification data and next section's available_quantity)
            try:
                # Debug: Log entry data before creation
                import sys
                print(f"Creating kit verification entry with data: {entry_data}", file=sys.stderr)
                print(f"Number of fields in entry_data: {len(entry_data)}", file=sys.stderr)
                print(f"Entry data details: {json.dumps({k: str(v) for k, v in entry_data.items()}, indent=2)}", file=sys.stderr)
                
                entry = in_process_model.objects.create(**entry_data)
                
                # Debug: Log successful creation and verify data was saved
                print(f"Successfully created kit verification entry with ID: {entry.id}", file=sys.stderr)
                print(f"Entry fields populated: {list(entry_data.keys())}", file=sys.stderr)
                
                # Verify the entry was created with the correct data
                entry_values = {}
                for field_name in entry_data.keys():
                    try:
                        value = getattr(entry, field_name, None)
                        entry_values[field_name] = value
                        print(f"  {field_name} = {value}", file=sys.stderr)
                    except Exception as e:
                        print(f"  Could not read {field_name}: {e}", file=sys.stderr)
                
                # Check if critical fields have values
                critical_fields_empty = []
                for field_name, value in entry_values.items():
                    if value is None or (isinstance(value, str) and value.strip() == ''):
                        critical_fields_empty.append(field_name)
                
                if critical_fields_empty:
                    print(f"WARNING: Some fields are empty after creation: {critical_fields_empty}", file=sys.stderr)
                else:
                    print("All fields have values after creation", file=sys.stderr)
                
                # Prepare response data
                response_data = {
                    'message': f'Kit verification entry created successfully for part {part_no}',
                    'part_no': part_no,
                    'entry_id': entry.id,
                    'kit_done_by': validated_data['kit_done_by'],
                    'kit_no': validated_data['kit_no'],
                    'kit_quantity': validated_data['kit_quantity'],
                    'kit_verification': validated_data['kit_verification'],
                    'created_at': entry.created_at.isoformat() if hasattr(entry, 'created_at') else None,
                    'fields_used': list(entry_data.keys())  # Include which fields were actually set
                }
                
                if validated_data.get('so_no'):
                    response_data['so_no'] = validated_data['so_no']
                
                # Add info about next section's available_quantity if it was added to the same entry
                if next_section_name:
                    # Check if available_quantity field was added to entry_data
                    available_quantity_added = any('available' in k.lower() and 'quantity' in k.lower() and next_section_name.lower() in k.lower() for k in entry_data.keys())
                    if available_quantity_added:
                        response_data['next_section'] = {
                            'section': next_section_name,
                            'available_quantity': validated_data['kit_quantity'],
                            'note': 'Available quantity added to the same entry'
                        }
                
                return Response(
                    response_data,
                    status=status.HTTP_201_CREATED
                )
                
            except Exception as e:
                import traceback
                error_details = str(e)
                traceback_str = traceback.format_exc()
                
                # Log the error for debugging
                import sys
                print(f"ERROR creating entry: {error_details}", file=sys.stderr)
                print(f"Traceback: {traceback_str}", file=sys.stderr)
                print(f"Entry data attempted: {entry_data}", file=sys.stderr)
                print(f"Available fields: {sorted(all_field_names)}", file=sys.stderr)
                
                # Check if it's a field error
                if 'no such column' in error_details.lower() or 'field' in error_details.lower() or 'unknown column' in error_details.lower():
                    return Response(
                        {
                            'error': f'Field error: {error_details}',
                            'message': 'The dynamic table may not have all required fields. Please ensure the part has a proper procedure configuration with kit section enabled.',
                            'part_no': part_no,
                            'attempted_fields': list(entry_data.keys()),
                            'available_fields': sorted(all_field_names),
                            'suggestion': 'Check that the part has kit section enabled in its procedure configuration.'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                return Response(
                    {
                        'error': f'Failed to create entry: {error_details}',
                        'details': traceback_str,
                        'attempted_fields': list(entry_data.keys()),
                        'available_fields': sorted(all_field_names)
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except Exception as e:
            import traceback
            return Response(
                {
                    'error': str(e),
                    'details': traceback.format_exc()
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
