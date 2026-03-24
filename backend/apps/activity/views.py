from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.activity.models import ActivityLog
from apps.activity.serializers import ActivityLogSerializer
from apps.households.models import HouseholdMembership
from apps.households.permissions import IsHouseholdMember


class ActivityListView(generics.ListAPIView):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_queryset(self):
        household_id = self.kwargs["household_id"]
        # Only show activity that happened after this user joined the household
        try:
            membership = HouseholdMembership.objects.get(
                household_id=household_id,
                user=self.request.user,
                status=HouseholdMembership.Status.ACTIVE,
            )
            joined_at = membership.joined_at
        except HouseholdMembership.DoesNotExist:
            return ActivityLog.objects.none()

        return ActivityLog.objects.filter(
            household_id=household_id,
            created_at__gte=joined_at,
        ).select_related("user").order_by("-created_at")[:50]
