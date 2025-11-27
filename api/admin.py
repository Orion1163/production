from django.contrib import admin
from .models import User, Admin


admin.site.register(Admin)

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('name', 'emp_id', 'roles',)
    search_fields = ('name', 'emp_id')
    list_filter = ('roles',)
