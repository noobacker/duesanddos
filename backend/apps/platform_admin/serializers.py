from rest_framework import serializers
from apps.platform_admin.models import AdminAuditLog
from apps.users.serializers import UserSerializer


class AdminAuditLogSerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source="admin.display_name", read_only=True)

    class Meta:
        model = AdminAuditLog
        fields = [
            "id", "admin", "admin_name", "action", "target_type",
            "target_id", "before_state", "after_state", "created_at",
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    from apps.users.models import User

    display_name = serializers.ReadOnlyField()
    household_count = serializers.SerializerMethodField()

    class Meta:
        from apps.users.models import User
        model = User
        fields = [
            "id", "email", "full_name", "display_name", "username",
            "is_active", "is_platform_admin", "date_joined",
            "auth_provider", "deactivated_at", "household_count",
        ]

    def get_household_count(self, obj):
        return obj.household_memberships.filter(status="active").count()


class PlatformStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    active_users = serializers.IntegerField()
    new_users_7d = serializers.IntegerField()
    new_users_30d = serializers.IntegerField()
    total_households = serializers.IntegerField()
    new_households_7d = serializers.IntegerField()
    new_households_30d = serializers.IntegerField()
    total_expenses = serializers.IntegerField()
    total_expense_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_chores = serializers.IntegerField()
    overdue_chores = serializers.IntegerField()
    total_messages = serializers.IntegerField()
