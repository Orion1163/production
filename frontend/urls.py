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
    path('logout/', views.logout, name='logout'),
    path('user/home/', views.user_home, name='user_home'),
    path('user/models/<str:model_no>/parts/', views.user_model_parts, name='user_model_parts'),
    path('user/parts/<str:part_no>/procedure/', views.user_part_procedure, name='user_part_procedure'),
    path('user/logout/', views.user_logout, name='user_logout'),
    path('', views.login, name='login'),
]


