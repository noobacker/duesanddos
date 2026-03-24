from rest_framework import serializers
from apps.chores.models import Chore, ChoreAssignment, ChoreLog
from apps.users.serializers import UserSerializer


class ChoreLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = ChoreLog
        fields = ["id", "user", "user_name", "action", "note", "created_at"]
        read_only_fields = ["id", "user", "action", "created_at"]


class ChoreAssignmentSerializer(serializers.ModelSerializer):
    assigned_user_name = serializers.CharField(source="assigned_user.display_name", read_only=True)
    logs = ChoreLogSerializer(many=True, read_only=True)

    class Meta:
        model = ChoreAssignment
        fields = [
            "id", "chore", "assigned_user", "assigned_user_name",
            "due_date", "is_done", "done_at", "note", "logs", "created_at",
        ]
        read_only_fields = ["id", "chore", "is_done", "done_at", "created_at"]


class ChoreSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(
        source="assigned_to.display_name", read_only=True, default=None
    )
    created_by_name = serializers.CharField(
        source="created_by.display_name", read_only=True
    )
    logs = ChoreLogSerializer(many=True, read_only=True)
    rotation_member_ids = serializers.PrimaryKeyRelatedField(
        source="rotation_members", many=True, read_only=True
    )
    rotation_member_names = serializers.SerializerMethodField()
    current_assignee_id = serializers.SerializerMethodField()
    current_assignee_name = serializers.SerializerMethodField()
    upcoming_assignments = serializers.SerializerMethodField()

    class Meta:
        model = Chore
        fields = [
            "id", "title", "description", "is_rotation",
            "assigned_to", "assigned_to_name",
            "rotation_member_ids", "rotation_member_names",
            "current_assignee_id", "current_assignee_name",
            "rotation_order",
            "status", "due_date", "recurrence",
            "created_by", "created_by_name",
            "logs", "upcoming_assignments",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "created_by", "created_at", "updated_at",
            "current_assignee_id", "current_assignee_name",
        ]

    def get_rotation_member_names(self, obj):
        return [u.display_name for u in obj.rotation_members.order_by("id")]

    def get_current_assignee_id(self, obj):
        u = obj.current_assignee()
        return u.id if u else None

    def get_current_assignee_name(self, obj):
        u = obj.current_assignee()
        return u.display_name if u else None

    def get_upcoming_assignments(self, obj):
        """Return the next 8 upcoming (undone) assignments."""
        qs = obj.assignments.filter(is_done=False).order_by("due_date")[:8]
        return ChoreAssignmentSerializer(qs, many=True).data


class ChoreCreateSerializer(serializers.ModelSerializer):
    rotation_member_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )

    class Meta:
        model = Chore
        fields = [
            "title", "description", "assigned_to", "due_date",
            "recurrence", "is_rotation", "rotation_member_ids",
        ]

    def create(self, validated_data):
        member_ids = validated_data.pop("rotation_member_ids", [])
        chore = Chore.objects.create(**validated_data)
        if member_ids:
            from apps.users.models import User
            chore.rotation_members.set(User.objects.filter(id__in=member_ids))
        return chore
