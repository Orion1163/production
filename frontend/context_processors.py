"""
Context processors for making admin role information available in templates.
"""

def admin_role(request):
    """
    Make admin role information available in all templates.
    Returns admin_role (1 = Super Admin, 2 = Admin) if admin is logged in, None otherwise.
    """
    if request.session.get('admin_logged_in', False):
        return {
            'admin_role': request.session.get('admin_role', None),
            'is_superadmin': request.session.get('admin_role') == 1,
        }
    return {
        'admin_role': None,
        'is_superadmin': False,
    }
