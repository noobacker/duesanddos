from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activity.models import ActivityLog
from apps.chat.models import Message
from apps.chores.models import Chore
from apps.expenses.models import Expense
from apps.households.models import Household, HouseholdMembership
from apps.households.permissions import IsPlatformAdmin
from apps.households.serializers import HouseholdSerializer
from apps.notifications.models import Notification
from apps.platform_admin.models import AdminAuditLog
from apps.platform_admin.serializers import (
    AdminAuditLogSerializer,
    AdminUserSerializer,
    PlatformStatsSerializer,
)

User = get_user_model()


class AdminOverviewView(APIView):
    """Global platform statistics."""
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        now = timezone.now()
        d7 = now - timedelta(days=7)
        d30 = now - timedelta(days=30)

        total_expense_amount = Expense.objects.aggregate(
            total=Sum("amount")
        )["total"] or 0

        today = now.date()

        data = {
            "total_users": User.objects.count(),
            "active_users": User.objects.filter(is_active=True).count(),
            "new_users_7d": User.objects.filter(date_joined__gte=d7).count(),
            "new_users_30d": User.objects.filter(date_joined__gte=d30).count(),
            "total_households": Household.objects.count(),
            "new_households_7d": Household.objects.filter(created_at__gte=d7).count(),
            "new_households_30d": Household.objects.filter(created_at__gte=d30).count(),
            "total_expenses": Expense.objects.count(),
            "total_expense_amount": total_expense_amount,
            "total_chores": Chore.objects.count(),
            "overdue_chores": Chore.objects.filter(
                due_date__lt=today, status__in=["todo", "in_progress"]
            ).count(),
            "total_messages": Message.objects.count(),
        }
        return Response(PlatformStatsSerializer(data).data)


class AdminUserListView(generics.ListAPIView):
    """List and search all platform users."""
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get_queryset(self):
        qs = User.objects.all().order_by("-date_joined")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(full_name__icontains=search)
                | Q(username__icontains=search)
            )
        role = self.request.query_params.get("role")
        if role == "admin":
            qs = qs.filter(is_platform_admin=True)
        active = self.request.query_params.get("active")
        if active == "true":
            qs = qs.filter(is_active=True)
        elif active == "false":
            qs = qs.filter(is_active=False)
        return qs


class AdminUserDetailView(APIView):
    """View or update a user (role, status)."""
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        user_data = AdminUserSerializer(user).data
        households = HouseholdMembership.objects.filter(user=user).select_related("household")
        user_data["households"] = [
            {
                "id": m.household.id,
                "name": m.household.name,
                "role": m.role,
                "status": m.status,
                "joined_at": m.joined_at,
            }
            for m in households
        ]
        return Response(user_data)

    def patch(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        before = {
            "is_platform_admin": user.is_platform_admin,
            "is_active": user.is_active,
        }

        if "is_platform_admin" in request.data:
            user.is_platform_admin = request.data["is_platform_admin"]
            user.is_staff = request.data["is_platform_admin"]
        if "is_active" in request.data:
            user.is_active = request.data["is_active"]
            if not request.data["is_active"]:
                user.deactivated_at = timezone.now()
            else:
                user.deactivated_at = None
        user.save()

        after = {
            "is_platform_admin": user.is_platform_admin,
            "is_active": user.is_active,
        }

        AdminAuditLog.objects.create(
            admin=request.user,
            action="user_updated",
            target_type="user",
            target_id=user.id,
            before_state=before,
            after_state=after,
        )

        return Response(AdminUserSerializer(user).data)


class AdminHouseholdListView(generics.ListAPIView):
    """List and search all households."""
    serializer_class = HouseholdSerializer
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get_queryset(self):
        qs = Household.objects.all().order_by("-created_at")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class AdminHouseholdDetailView(APIView):
    """View household details with insights."""
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request, household_id):
        try:
            household = Household.objects.get(id=household_id)
        except Household.DoesNotExist:
            return Response({"detail": "Household not found."}, status=status.HTTP_404_NOT_FOUND)

        members = HouseholdMembership.objects.filter(
            household=household
        ).select_related("user")

        total_expenses = Expense.objects.filter(household=household)
        total_amount = total_expenses.aggregate(total=Sum("amount"))["total"] or 0

        today = timezone.now().date()
        data = {
            "id": household.id,
            "name": household.name,
            "created_at": household.created_at,
            "members": [
                {
                    "id": m.user.id,
                    "email": m.user.email,
                    "display_name": m.user.display_name,
                    "role": m.role,
                    "status": m.status,
                    "joined_at": m.joined_at,
                }
                for m in members
            ],
            "insights": {
                "total_expenses": total_expenses.count(),
                "total_amount": total_amount,
                "unpaid_splits": total_expenses.filter(splits__is_paid=False).distinct().count(),
                "total_chores": Chore.objects.filter(household=household).count(),
                "overdue_chores": Chore.objects.filter(
                    household=household,
                    due_date__lt=today,
                    status__in=["todo", "in_progress"],
                ).count(),
                "total_messages": Message.objects.filter(household=household).count(),
                "last_activity": ActivityLog.objects.filter(
                    household=household
                ).values_list("created_at", flat=True).first(),
            },
        }
        return Response(data)


class AdminAuditListView(generics.ListAPIView):
    """List admin audit logs."""
    serializer_class = AdminAuditLogSerializer
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get_queryset(self):
        return AdminAuditLog.objects.all().select_related("admin")[:100]
