from django.urls import path

from . import views

urlpatterns = [
    path(
        'production-procedure/',
        views.design_procedure,
        name='design_procedure',
    ),
    path(
        'production-procedure/add/',
        views.design_procedure_create,
        name='design_procedure_create',
    ),
    path(
        'add-user/',
        views.add_user,
        name='add_user',
    ),
    path(
        'profile/',
        views.profile,
        name='profile',
    ),
    path(
        'home/',
        views.home,
        name='home',
    ),
    path('create-new-user/', views.create_new_user, name='create_new_user'),
]


