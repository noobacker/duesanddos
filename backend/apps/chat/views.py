from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.chat.models import Message
from apps.chat.serializers import MessageSerializer
from apps.households.permissions import IsHouseholdMember


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_queryset(self):
        qs = Message.objects.filter(
            household_id=self.kwargs["household_id"]
        ).select_related("sender")

        after = self.request.query_params.get("after")
        if after:
            qs = qs.filter(id__gt=after)
        return qs.order_by("-created_at")[:100]

    def perform_create(self, serializer):
        serializer.save(
            household_id=self.kwargs["household_id"],
            sender=self.request.user,
        )
