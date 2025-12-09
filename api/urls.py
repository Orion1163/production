from django.urls import path
from .views import (
    UserDetailView, UserListCreateView, UserLoginView, AdminLoginView, AdminLogoutView, 
    AdminProfileView, UserProfileView, ProductionProcedureCreateView, ModelPartListView,
    ProcedureDetailView, DashboardStatsView, DashboardChartDataView, UserModelListView,
    UserModelPartsView, UserPartSectionsView, KitVerificationView
)

urlpatterns = [
    path('users/', UserListCreateView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('user/login/', UserLoginView.as_view(), name='user-login'),
    path('user/models/', UserModelListView.as_view(), name='user-models'),
    path('user/models/<str:model_no>/parts/', UserModelPartsView.as_view(), name='user-model-parts'),
    path('user/parts/<str:part_no>/sections/', UserPartSectionsView.as_view(), name='user-part-sections'),
    path('admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('admin/logout/', AdminLogoutView.as_view(), name='admin-logout'),
    path('admin/profile/', AdminProfileView.as_view(), name='admin-profile'),
    path('user/profile/', UserProfileView.as_view(), name='user-profile'),
    path('production-procedure/', ProductionProcedureCreateView.as_view(), name='production-procedure-create'),
    path('model-parts/', ModelPartListView.as_view(), name='model-part-list'),
    path('procedure-detail/<str:model_no>/', ProcedureDetailView.as_view(), name='procedure-detail'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/charts/', DashboardChartDataView.as_view(), name='dashboard-charts'),
    path('kit-verification/', KitVerificationView.as_view(), name='kit-verification'),
]