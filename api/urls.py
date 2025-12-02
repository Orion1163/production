from django.urls import path
from .views import (
    UserDetailView, UserListCreateView, AdminLoginView, AdminLogoutView, 
    AdminProfileView, ProductionProcedureCreateView, ModelPartListView,
    ProcedureDetailView
)

urlpatterns = [
    path('users/', UserListCreateView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('admin/logout/', AdminLogoutView.as_view(), name='admin-logout'),
    path('admin/profile/', AdminProfileView.as_view(), name='admin-profile'),
    path('production-procedure/', ProductionProcedureCreateView.as_view(), name='production-procedure-create'),
    path('model-parts/', ModelPartListView.as_view(), name='model-part-list'),
    path('procedure-detail/<str:model_no>/', ProcedureDetailView.as_view(), name='procedure-detail'),
]