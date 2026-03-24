from rest_framework import serializers
from django.utils import timezone
from apps.households.models import Household, HouseholdMembership, Invite
from apps.users.serializers import UserSerializer


class HouseholdSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Household
        fields = ["id", "name", "created_at", "updated_at", "member_count", "my_role"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_member_count(self, obj):
        return obj.memberships.filter(
            status=HouseholdMembership.Status.ACTIVE
        ).count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(
                user=request.user, status=HouseholdMembership.Status.ACTIVE
            ).first()
            return membership.role if membership else None
        return None


class HouseholdCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Household
        fields = ["name"]


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = HouseholdMembership
        fields = ["id", "user", "role", "status", "can_edit", "require_payment_confirmation", "joined_at"]
        read_only_fields = ["id", "user", "joined_at"]


class InviteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.display_name", read_only=True
    )
    household_name = serializers.CharField(
        source="household.name", read_only=True
    )

    class Meta:
        model = Invite
        fields = [
            "id", "code", "household", "household_name",
            "created_by_name", "expires_at", "is_expired", "is_used", "created_at",
        ]
        read_only_fields = ["id", "code", "created_by_name", "is_expired", "is_used", "created_at"]


class JoinHouseholdSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)

    def validate_code(self, value):
        try:
            invite = Invite.objects.get(code=value.upper())
        except Invite.DoesNotExist:
            raise serializers.ValidationError("Invalid invite code.")
        if invite.is_expired:
            raise serializers.ValidationError("This invite has expired.")
        if invite.is_used:
            raise serializers.ValidationError("This invite has already been used.")
        return value
