from django.shortcuts import render, redirect
from functools import wraps


def admin_login_required(view_func):
    """
    Decorator to check if admin is logged in.
    Redirects to login page if not authenticated.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.session.get('admin_logged_in', False):
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper


def user_login_required(view_func):
    """
    Decorator to check if user is logged in.
    Redirects to login page if not authenticated.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.session.get('user_logged_in', False):
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper


@admin_login_required
def design_procedure(request):
    """
    Render the procedure listing table.
    """
    return render(request, 'admin/designProcedure.html')


@admin_login_required
def design_procedure_create(request):
    """
    Render the standalone form for creating/editing a procedure.
    """
    return render(request, 'admin/designProcedure_form.html')

@admin_login_required
def add_user(request):
    """
    Render the add user page.
    """
    return render(request, 'admin/add_user.html')

@admin_login_required
def profile(request):
    """
    Render the profile page.
    """
    emp_id = request.session.get('admin_emp_id', None)
    context = {
        'emp_id': emp_id
    }
    return render(request, 'admin/profile.html', context)

@admin_login_required
def home(request):
    """
    Render the home page.
    """
    return render(request, 'admin/home.html')

@admin_login_required
def create_new_user(request):
    """
    Render the create new user page.
    """
    return render(request, 'admin/add_user_form.html')

def login(request):
    """
    Render the login page.
    If admin or user is already logged in, redirect to respective home.
    """
    if request.session.get('admin_logged_in', False):
        return redirect('home')
    if request.session.get('user_logged_in', False):
        return redirect('user_home')
    return render(request, 'login/index.html')


@user_login_required
def user_home(request):
    """
    Render the user home page.
    """
    emp_id = request.session.get('user_emp_id', None)
    context = {
        'emp_id': emp_id
    }
    return render(request, 'user/home.html', context)


@user_login_required
def user_model_parts(request, model_no):
    """
    Render the parts page for a specific model.
    """
    emp_id = request.session.get('user_emp_id', None)
    context = {
        'emp_id': emp_id,
        'model_no': model_no
    }
    return render(request, 'user/parts.html', context)


@user_login_required
def user_part_procedure(request, part_no):
    """
    Render the part procedure page with dynamic sidebar.
    """
    emp_id = request.session.get('user_emp_id', None)
    context = {
        'emp_id': emp_id,
        'part_no': part_no
    }
    return render(request, 'user/part_procedure.html', context)


def logout(request):
    """
    Handle admin logout.
    """
    # Clear session data
    if 'admin_emp_id' in request.session:
        del request.session['admin_emp_id']
    if 'admin_logged_in' in request.session:
        del request.session['admin_logged_in']
    
    # Flush the session
    request.session.flush()
    
    return redirect('login')


def user_logout(request):
    """
    Handle user logout.
    """
    # Clear session data
    if 'user_emp_id' in request.session:
        del request.session['user_emp_id']
    if 'user_logged_in' in request.session:
        del request.session['user_logged_in']
    
    # Flush the session
    request.session.flush()
    
    return redirect('login')