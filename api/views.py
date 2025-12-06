from .models import User, Admin, ModelPart, PartProcedureDetail
from .serializers import (
    UserSerializer, AdminSerializer, ProductionProcedureSerializer, 
    ModelPartGroupSerializer, ProcedureDetailSerializer, PartProcedureDetailSerializer,
    DashboardStatsSerializer, DashboardChartDataSerializer, UserModelListSerializer
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
