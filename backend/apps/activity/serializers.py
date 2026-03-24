from rest_framework import serializers
from apps.activity.models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id", "user", "user_name", "action", "entity_type",
            "entity_id", "description", "metadata", "created_at",
        ]
