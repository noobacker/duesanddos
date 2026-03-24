import hashlib
from rest_framework import serializers
from apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "full_name", "display_name", "avatar_url", "date_joined",
            "phone", "timezone", "language", "notifications_enabled",
            "default_currency", "date_format", "auth_provider", "email_verified",
            "is_platform_admin",
        ]
        read_only_fields = ["id", "email", "date_joined", "auth_provider", "email_verified", "is_platform_admin"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        
        if obj.social_avatar_url:
            return obj.social_avatar_url
            
        if obj.email:
            email_hash = hashlib.md5(obj.email.lower().encode('utf-8')).hexdigest()
            return f"https://www.gravatar.com/avatar/{email_hash}?d=identicon"
        return None


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "username", "full_name", "avatar", "phone", "timezone", "language",
            "notifications_enabled", "default_currency", "date_format"
        ]

    def validate_username(self, value):
        if not value:
            return value
        qs = User.objects.filter(username=value)
        # Exclude the current user
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        if not value.replace("_", "").replace(".", "").replace("-", "").isalnum():
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, underscores, hyphens, and dots."
            )
        return value.lower()

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
