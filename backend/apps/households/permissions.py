from rest_framework.permissions import BasePermission

from apps.households.models import HouseholdMembership


class IsHouseholdMember(BasePermission):
    """Allow access only to active members of the household."""

    def has_permission(self, request, view):
        household_id = view.kwargs.get("household_id")
        if not household_id:
            return False
        return HouseholdMembership.objects.filter(
            household_id=household_id,
            user=request.user,
            status=HouseholdMembership.Status.ACTIVE,
        ).exists()


class IsHouseholdAdmin(BasePermission):
    """Allow access only to admins of the household."""

    def has_permission(self, request, view):
        household_id = view.kwargs.get("household_id")
        if not household_id:
            return False
        return HouseholdMembership.objects.filter(
            household_id=household_id,
            user=request.user,
            role=HouseholdMembership.Role.ADMIN,
            status=HouseholdMembership.Status.ACTIVE,
        ).exists()


class IsPlatformAdmin(BasePermission):
    """Allow access only to platform admins."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_platform_admin
        )
