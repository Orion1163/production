from django.contrib import admin
from .models import User
from .serializers import UserSerializer

admin.site.register(User)
