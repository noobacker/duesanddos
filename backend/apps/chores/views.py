from decimal import Decimal
from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activity.models import ActivityLog
from apps.chores.models import Chore, ChoreAssignment, ChoreLog
from apps.chores.serializers import (
    ChoreCreateSerializer,
    ChoreSerializer,
    ChoreAssignmentSerializer,
)
from apps.households.models import HouseholdMembership
from apps.households.permissions import IsHouseholdAdmin, IsHouseholdMember
from apps.notifications.models import Notification


def _notify_admins(household_id, notif_type, title, message, data):
    admin_ids = HouseholdMembership.objects.filter(
        household_id=household_id,
        role=HouseholdMembership.Role.ADMIN,
        status=HouseholdMembership.Status.ACTIVE,
    ).values_list("user_id", flat=True)
    for admin_id in admin_ids:
        Notification.objects.create(
            user_id=admin_id, type=notif_type, title=title,
            message=message, data=data,
        )


class ChoreListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ChoreCreateSerializer
        return ChoreSerializer

    def get(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if isinstance(qs, Response):  # get_queryset handled pagination and returned a Response
            return qs
        return Response(ChoreSerializer(qs, many=True).data)

    def get_queryset(self):
        household_id = self.kwargs["household_id"]

        # Only show chores created after this user joined
        try:
            membership = HouseholdMembership.objects.get(
                household_id=household_id,
                user=self.request.user,
                status=HouseholdMembership.Status.ACTIVE,
            )
            joined_at = membership.joined_at
        except HouseholdMembership.DoesNotExist:
            return Chore.objects.none()

        qs = Chore.objects.filter(
            household_id=household_id,
            created_at__gte=joined_at,
        ).select_related("assigned_to", "created_by").prefetch_related(
            "logs__user", "rotation_members", "assignments"
        )

        status_filter = self.request.query_params.get("status")
        assignee = self.request.query_params.get("assignee")
        mine = self.request.query_params.get("mine")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if assignee:
            qs = qs.filter(assigned_to_id=assignee)
        if mine == "true":
            user = self.request.user
            qs = qs.filter(
                assignments__assigned_user=user,
                assignments__is_done=False,
            ).distinct()
        
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        # Apply pagination if page/page_size provided
        page = self.request.query_params.get("page")
        if page:
            page = int(page)
            page_size = int(self.request.query_params.get("page_size", 15))
            total = qs.count()
            start = (page - 1) * page_size
            end = start + page_size
            paginated = list(qs[start:end])
            
            return Response({
                "count": total,
                "page": page,
                "page_size": page_size,
                "has_more": end < total,
                "results": ChoreSerializer(paginated, many=True).data,
            })

        # Fallback to returning all if no pagination requested
        return Response(ChoreSerializer(qs, many=True).data)

    def perform_create(self, serializer):
        chore = serializer.save(
            household_id=self.kwargs["household_id"],
            created_by=self.request.user,
        )
        ChoreLog.objects.create(
            chore=chore, user=self.request.user, action=ChoreLog.Action.CREATED
        )
        ActivityLog.objects.create(
            household_id=self.kwargs["household_id"],
            user=self.request.user,
            action="chore_created",
            entity_type="chore",
            entity_id=chore.id,
            description=f"{self.request.user.display_name} created chore \"{chore.title}\".",
        )

        # If rotation, create first round of assignments
        if chore.is_rotation and chore.recurrence != "none":
            _generate_rotation_assignments(chore)
        elif chore.assigned_to and chore.assigned_to != self.request.user:
            Notification.objects.create(
                user=chore.assigned_to,
                type=Notification.Type.CHORE_ASSIGNED,
                title="New chore assigned",
                message=f"You've been assigned \"{chore.title}\".",
                data={"household_id": self.kwargs["household_id"], "chore_id": chore.id},
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        chore = Chore.objects.prefetch_related(
            "logs__user", "rotation_members", "assignments"
        ).get(id=serializer.instance.id)
        return Response(
            ChoreSerializer(chore).data, status=status.HTTP_201_CREATED
        )


def _generate_rotation_assignments(chore):
    """Create upcoming assignment instances for a rotation chore."""
    members = list(chore.rotation_members.order_by("id"))
    if not members:
        return

    recurrence_days = {"weekly": 7, "biweekly": 14, "monthly": 30}
    interval = recurrence_days.get(chore.recurrence, 7)
    start_date = chore.due_date or timezone.now().date()
    num_occurrences = 8  # generate 8 upcoming slots

    for i in range(num_occurrences):
        assignee = members[(chore.rotation_order + i) % len(members)]
        occurrence_date = start_date + timedelta(days=interval * i)
        ChoreAssignment.objects.get_or_create(
            chore=chore,
            assigned_user=assignee,
            due_date=occurrence_date,
            defaults={"note": ""},
        )


class ChoreDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChoreSerializer
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    lookup_url_kwarg = "chore_id"

    def get_queryset(self):
        return Chore.objects.filter(
            household_id=self.kwargs["household_id"]
        ).select_related("assigned_to", "created_by").prefetch_related(
            "logs__user", "rotation_members", "assignments"
        )

    def perform_update(self, serializer):
        serializer.save()
        ActivityLog.objects.create(
            household_id=self.kwargs["household_id"],
            user=self.request.user,
            action="chore_updated",
            entity_type="chore",
            entity_id=serializer.instance.id,
            description=f"{self.request.user.display_name} updated \"{serializer.instance.title}\".",
        )

    def perform_destroy(self, instance):
        # Only admins can delete chores
        is_admin = HouseholdMembership.objects.filter(
            household_id=self.kwargs["household_id"],
            user=self.request.user,
            role=HouseholdMembership.Role.ADMIN,
            status=HouseholdMembership.Status.ACTIVE,
        ).exists()
        if not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only household admins can delete chores.")

        ActivityLog.objects.create(
            household_id=self.kwargs["household_id"],
            user=self.request.user,
            action="chore_deleted",
            entity_type="chore",
            entity_id=instance.id,
            description=f"{self.request.user.display_name} deleted \"{instance.title}\".",
        )
        instance.delete()


class ChoreCompleteView(APIView):
    """Mark a chore assignment as done."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def post(self, request, household_id, chore_id):
        try:
            chore = Chore.objects.get(id=chore_id, household_id=household_id)
        except Chore.DoesNotExist:
            return Response({"detail": "Chore not found."}, status=status.HTTP_404_NOT_FOUND)

        assignment_id = request.data.get("assignment_id")

        if assignment_id:
            # Complete a specific assignment (rotation)
            try:
                assignment = ChoreAssignment.objects.get(
                    id=assignment_id, chore=chore
                )
            except ChoreAssignment.DoesNotExist:
                return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

            assignment.is_done = True
            assignment.done_at = timezone.now()
            assignment.done_by = request.user
            assignment.save()

            ChoreLog.objects.create(
                chore=chore,
                assignment=assignment,
                user=request.user,
                action=ChoreLog.Action.COMPLETED,
                note=request.data.get("note", ""),
            )

            # If rotation, advance and generate next assignment
            if chore.is_rotation and chore.recurrence != "none":
                chore.advance_rotation()
                members = list(chore.rotation_members.order_by("id"))
                if members:
                    recurrence_days = {"weekly": 7, "biweekly": 14, "monthly": 30}
                    interval = recurrence_days.get(chore.recurrence, 7)
                    next_date = assignment.due_date + timedelta(days=interval * len(members))
                    next_assignee = members[chore.rotation_order % len(members)]
                    ChoreAssignment.objects.get_or_create(
                        chore=chore,
                        assigned_user=next_assignee,
                        due_date=next_date,
                        defaults={"note": ""},
                    )
                    # Notify next person
                    Notification.objects.create(
                        user=next_assignee,
                        type=Notification.Type.CHORE_ASSIGNED,
                        title="It's your turn",
                        message=f"You're up next for \"{chore.title}\" on {next_date}.",
                        data={"household_id": household_id, "chore_id": chore.id},
                    )

            ActivityLog.objects.create(
                household_id=household_id,
                user=request.user,
                action="chore_completed",
                entity_type="chore_assignment",
                entity_id=assignment.id,
                description=f"{request.user.display_name} completed \"{chore.title}\" (due {assignment.due_date}).",
            )
            return Response(ChoreAssignmentSerializer(assignment).data)

        else:
            # One-time chore — just mark chore done
            chore.status = Chore.Status.DONE
            chore.save()
            ChoreLog.objects.create(
                chore=chore, user=request.user, action=ChoreLog.Action.COMPLETED,
                note=request.data.get("note", ""),
            )
            ActivityLog.objects.create(
                household_id=household_id,
                user=request.user,
                action="chore_completed",
                entity_type="chore",
                entity_id=chore.id,
                description=f"{request.user.display_name} completed \"{chore.title}\".",
            )
            return Response(ChoreSerializer(chore).data)


class ChoreRequestSwapView(APIView):
    """Request to swap an assignment with another member."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def post(self, request, household_id, chore_id):
        try:
            chore = Chore.objects.get(id=chore_id, household_id=household_id)
        except Chore.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        assignment_id = request.data.get("assignment_id")
        reason = request.data.get("reason", "")

        log = ChoreLog.objects.create(
            chore=chore,
            assignment_id=assignment_id,
            user=request.user,
            action=ChoreLog.Action.SWAP_REQUESTED,
            note=reason,
        )

        _notify_admins(
            household_id,
            Notification.Type.REASSIGN_REQUEST,
            "Swap requested",
            f"{request.user.display_name} requested a swap for \"{chore.title}\".",
            {"household_id": household_id, "chore_id": chore.id},
        )
        return Response({"message": "Swap request submitted."})


class ChoreReassignAssignmentView(APIView):
    """Admin: reassign a specific assignment to a different user."""
    permission_classes = [IsAuthenticated, IsHouseholdAdmin]

    def post(self, request, household_id, chore_id):
        try:
            chore = Chore.objects.get(id=chore_id, household_id=household_id)
        except Chore.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        assignment_id = request.data.get("assignment_id")
        new_user_id = request.data.get("assigned_to")

        if not new_user_id:
            return Response({"detail": "assigned_to required."}, status=status.HTTP_400_BAD_REQUEST)

        if assignment_id:
            try:
                assignment = ChoreAssignment.objects.get(id=assignment_id, chore=chore)
            except ChoreAssignment.DoesNotExist:
                return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)

            old_user = assignment.assigned_user
            assignment.assigned_user_id = new_user_id
            assignment.save()

            ChoreLog.objects.create(
                chore=chore,
                assignment=assignment,
                user=request.user,
                action=ChoreLog.Action.SWAP_APPROVED,
                note=f"Reassigned from {old_user.display_name if old_user else '?'} to user #{new_user_id}.",
            )
        else:
            # Non-rotation: update the chore's assigned_to
            chore.assigned_to_id = new_user_id
            chore.save()
            ChoreLog.objects.create(
                chore=chore, user=request.user, action=ChoreLog.Action.REASSIGNED,
                note=f"Reassigned to user #{new_user_id}.",
            )

        Notification.objects.create(
            user_id=new_user_id,
            type=Notification.Type.REASSIGN_APPROVED,
            title="Chore assigned to you",
            message=f"You've been assigned to \"{chore.title}\".",
            data={"household_id": household_id, "chore_id": chore.id},
        )
        ActivityLog.objects.create(
            household_id=household_id,
            user=request.user,
            action="chore_reassigned",
            entity_type="chore",
            entity_id=chore.id,
            description=f"\"{chore.title}\" was reassigned by {request.user.display_name}.",
        )
        return Response({"message": "Reassigned."})


class ChoreEditNoteView(APIView):
    """Edit the note on a ChoreLog entry (corrections for mistouches)."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def patch(self, request, household_id, chore_id, log_id):
        try:
            log = ChoreLog.objects.get(
                id=log_id, chore_id=chore_id, chore__household_id=household_id
            )
        except ChoreLog.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if log.user != request.user and not HouseholdMembership.objects.filter(
            household_id=household_id, user=request.user,
            role=HouseholdMembership.Role.ADMIN,
        ).exists():
            return Response({"detail": "Not permitted."}, status=status.HTTP_403_FORBIDDEN)

        log.note = request.data.get("note", log.note)
        log.save()
        return Response({"id": log.id, "note": log.note})


class MyScheduleView(APIView):
    """Return all upcoming undone assignments for this user across all household chores."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get(self, request, household_id):
        assignments = ChoreAssignment.objects.filter(
            chore__household_id=household_id,
            assigned_user=request.user,
            is_done=False,
        ).select_related("chore", "assigned_user").order_by("due_date")
        return Response(ChoreAssignmentSerializer(assignments, many=True).data)
