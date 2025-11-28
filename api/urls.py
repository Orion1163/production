from django.urls import path
from .views import UserDetailView, UserListCreateView, AdminLoginView, AdminLogoutView, AdminProfileView

urlpatterns = [
    path('users/', UserListCreateView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('admin/logout/', AdminLogoutView.as_view(), name='admin-logout'),
    path('admin/profile/', AdminProfileView.as_view(), name='admin-profile'),
]