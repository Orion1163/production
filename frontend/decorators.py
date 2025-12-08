"""
Custom decorators for role-based access control.
"""
from functools import wraps
from django.shortcuts import redirect
from django.http import JsonResponse
from .role_constants import has_role_access, is_admin, get_role_name


def role_required(*allowed_roles):
    """
    Decorator to check if user has one of the required roles.
    
    Usage:
        @role_required(1)  # Only Administrator
        @role_required(1, 2)  # Administrator or Quality Control
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user_roles = request.session.get('user_roles', [])
            
            # Check if user has at least one of the required roles
            if not any(role in allowed_roles for role in user_roles):
                # If it's an AJAX request, return JSON error
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return JsonResponse({
                        'error': 'Access denied',
                        'message': 'You do not have permission to access this resource.'
                    }, status=403)
                
                # Otherwise redirect with error message
                request.session['access_denied_message'] = 'You do not have permission to access this page.'
                return redirect('user_home')
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def admin_role_required(view_func):
    """
    Decorator to check if user is an administrator (role 1).
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user_roles = request.session.get('user_roles', [])
        
        if not is_admin(user_roles):
            # If it's an AJAX request, return JSON error
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'error': 'Access denied',
                    'message': 'Administrator access required.'
                }, status=403)
            
            # Otherwise redirect with error message
            request.session['access_denied_message'] = 'Administrator access required.'
            return redirect('user_home')
        
        return view_func(request, *args, **kwargs)
    return wrapper


def section_required(view_func):
    """
    Decorator to check if user has access to a specific section.
    The section key is extracted from the view's kwargs.
    
    Usage:
        @section_required
        def user_section_page(request, part_no, section):
            ...
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Extract section from kwargs
        section_key = kwargs.get('section')
        
        if not section_key:
            # If no section in kwargs, allow access (for views that don't use sections)
            return view_func(request, *args, **kwargs)
        
        user_roles = request.session.get('user_roles', [])
        
        # Check if user has access to this section
        if not has_role_access(user_roles, section_key):
            # If it's an AJAX request, return JSON error
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'error': 'Access denied',
                    'message': f'You do not have permission to access the {section_key} section.'
                }, status=403)
            
            # Otherwise redirect with error message
            request.session['access_denied_message'] = f'You do not have permission to access the {section_key} section.'
            return redirect('user_home')
        
        return view_func(request, *args, **kwargs)
    return wrapper

