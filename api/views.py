from .models import User, Admin
from .serializers import UserSerializer, AdminSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


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