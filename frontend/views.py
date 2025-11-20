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

