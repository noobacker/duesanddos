from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activity.models import ActivityLog
from apps.households.models import Household, HouseholdMembership, Invite
from apps.households.permissions import IsHouseholdAdmin, IsHouseholdMember
from apps.households.serializers import (
    HouseholdCreateSerializer,
    HouseholdSerializer,
    InviteSerializer,
    JoinHouseholdSerializer,
    MembershipSerializer,
)
from apps.notifications.models import Notification


class HouseholdListCreateView(generics.ListCreateAPIView):
    """List user's households or create a new one."""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return HouseholdCreateSerializer
        return HouseholdSerializer

    def get_queryset(self):
        return Household.objects.filter(
            memberships__user=self.request.user,
            memberships__status=HouseholdMembership.Status.ACTIVE,
        ).distinct()

    def perform_create(self, serializer):
        household = serializer.save(created_by=self.request.user)
        HouseholdMembership.objects.create(
            household=household,
            user=self.request.user,
            role=HouseholdMembership.Role.ADMIN,
        )
        ActivityLog.objects.create(
            household=household,
            user=self.request.user,
            action="household_created",
            entity_type="household",
            entity_id=household.id,
            description=f"{self.request.user.display_name} created the household.",
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        household = Household.objects.get(id=serializer.instance.id)
        return Response(
            HouseholdSerializer(household, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class HouseholdDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a household."""
    serializer_class = HouseholdSerializer
    lookup_url_kwarg = "household_id"

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "DELETE"):
            return [IsAuthenticated(), IsHouseholdAdmin()]
        return [IsAuthenticated(), IsHouseholdMember()]

    def get_queryset(self):
        return Household.objects.all()

    def perform_update(self, serializer):
        serializer.save()
        ActivityLog.objects.create(
            household=serializer.instance,
            user=self.request.user,
            action="household_updated",
            entity_type="household",
            entity_id=serializer.instance.id,
            description=f"{self.request.user.display_name} updated household settings.",
        )

    def perform_destroy(self, instance):
        ActivityLog.objects.create(
            household=instance,
            user=self.request.user,
            action="household_deleted",
            entity_type="household",
            entity_id=instance.id,
            description=f"{self.request.user.display_name} deleted the household.",
        )
        instance.delete()


class MemberListView(generics.ListAPIView):
    """List active members of a household."""
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_queryset(self):
        return HouseholdMembership.objects.filter(
            household_id=self.kwargs["household_id"],
            status=HouseholdMembership.Status.ACTIVE,
        ).select_related("user")


class MemberUpdateView(generics.UpdateAPIView):
    """Update a member's role or permissions (household admin only)."""
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, IsHouseholdAdmin]
    lookup_url_kwarg = "member_id"

    def get_queryset(self):
        return HouseholdMembership.objects.filter(
            household_id=self.kwargs["household_id"]
        )

    def perform_update(self, serializer):
        membership = serializer.instance
        old_role = membership.role
        serializer.save()
        if old_role != serializer.instance.role:
            ActivityLog.objects.create(
                household_id=self.kwargs["household_id"],
                user=self.request.user,
                action="member_role_changed",
                entity_type="membership",
                entity_id=membership.id,
                description=f"{membership.user.display_name}'s role changed from {old_role} to {serializer.instance.role}.",
            )


class MemberRemoveView(APIView):
    """Remove a member from a household (admin only) or leave."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def delete(self, request, household_id, member_id):
        try:
            membership = HouseholdMembership.objects.get(
                id=member_id, household_id=household_id
            )
        except HouseholdMembership.DoesNotExist:
            return Response(
                {"detail": "Member not found."}, status=status.HTTP_404_NOT_FOUND
            )

        is_self = membership.user == request.user
        is_admin = HouseholdMembership.objects.filter(
            household_id=household_id,
            user=request.user,
            role=HouseholdMembership.Role.ADMIN,
            status=HouseholdMembership.Status.ACTIVE,
        ).exists()

        if not is_self and not is_admin:
            return Response(
                {"detail": "Only admins can remove other members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership.status = (
            HouseholdMembership.Status.LEFT
            if is_self
            else HouseholdMembership.Status.REMOVED
        )
        membership.save()

        action = "member_left" if is_self else "member_removed"
        desc = (
            f"{membership.user.display_name} left the household."
            if is_self
            else f"{membership.user.display_name} was removed by {request.user.display_name}."
        )
        ActivityLog.objects.create(
            household_id=household_id,
            user=request.user,
            action=action,
            entity_type="membership",
            entity_id=membership.id,
            description=desc,
        )

        if not is_self:
            Notification.objects.create(
                user=membership.user,
                type=Notification.Type.MEMBER_REMOVED,
                title="Removed from household",
                message=f"You were removed from {membership.household.name}.",
                data={"household_id": household_id},
            )

        return Response({"message": "Member removed."}, status=status.HTTP_200_OK)


class CreateInviteView(APIView):
    """Create a new invite for a household."""
    permission_classes = [IsAuthenticated, IsHouseholdAdmin]

    def post(self, request, household_id):
        invite = Invite.objects.create(
            household_id=household_id,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        return Response(
            InviteSerializer(invite).data, status=status.HTTP_201_CREATED
        )


class JoinHouseholdView(APIView):
    """Join a household via invite code."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = JoinHouseholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data["code"].upper()
        invite = Invite.objects.get(code=code)

        existing = HouseholdMembership.objects.filter(
            household=invite.household, user=request.user
        ).first()
        if existing and existing.status == HouseholdMembership.Status.ACTIVE:
            return Response(
                {"detail": "You are already a member of this household."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if existing:
            existing.status = HouseholdMembership.Status.ACTIVE
            existing.role = HouseholdMembership.Role.MEMBER
            existing.save()
        else:
            HouseholdMembership.objects.create(
                household=invite.household,
                user=request.user,
                role=HouseholdMembership.Role.MEMBER,
            )

        invite.used_by = request.user
        invite.used_at = timezone.now()
        invite.save()

        ActivityLog.objects.create(
            household=invite.household,
            user=request.user,
            action="member_joined",
            entity_type="membership",
            entity_id=request.user.id,
            description=f"{request.user.display_name} joined the household.",
        )

        # Notify household admins
        admin_ids = HouseholdMembership.objects.filter(
            household=invite.household,
            role=HouseholdMembership.Role.ADMIN,
            status=HouseholdMembership.Status.ACTIVE,
        ).values_list("user_id", flat=True)
        for admin_id in admin_ids:
            Notification.objects.create(
                user_id=admin_id,
                type=Notification.Type.MEMBER_JOINED,
                title="New member joined",
                message=f"{request.user.display_name} joined {invite.household.name}.",
                data={"household_id": invite.household.id},
            )

        return Response(
            HouseholdSerializer(invite.household, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
