from django.shortcuts import render


def design_procedure(request):
    """
    Render the procedure listing table.
    """
    return render(request, 'admin/designProcedure.html')


def design_procedure_create(request):
    """
    Render the standalone form for creating/editing a procedure.
    """
    return render(request, 'admin/designProcedure_form.html')

def add_user(request):
    """
    Render the add user page.
    """
    return render(request, 'admin/add_user.html')

def profile(request):
    """
    Render the profile page.
    """
    return render(request, 'admin/profile.html')

def home(request):
    """
    Render the home page.
    """
    return render(request, 'admin/home.html')

def create_new_user(request):
    """
    Render the create new user page.
    """
    return render(request, 'admin/add_user_form.html')