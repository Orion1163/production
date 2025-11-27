from rest_framework import serializers
from .models import User, Admin


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = '__all__'


class AdminLoginSerializer(serializers.Serializer):
    emp_id = serializers.IntegerField()
    pin = serializers.IntegerField()