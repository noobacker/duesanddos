from collections import defaultdict
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activity.models import ActivityLog
from apps.expenses.models import Expense, ExpenseEditHistory, ExpenseSplit
from apps.expenses.serializers import (
    BalanceSerializer,
    ExpenseCreateSerializer,
    ExpenseSerializer,
)
from apps.households.models import HouseholdMembership
from apps.households.permissions import IsHouseholdMember
from apps.notifications.models import Notification


class ExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get(self, request, household_id):
        # Only show expenses from after this user joined the household
        try:
            membership = HouseholdMembership.objects.get(
                household_id=household_id,
                user=request.user,
                status=HouseholdMembership.Status.ACTIVE,
            )
            joined_at = membership.joined_at
        except HouseholdMembership.DoesNotExist:
            return Response({"results": [], "count": 0, "has_more": False})

        queryset = Expense.objects.filter(
            household_id=household_id,
            created_at__gte=joined_at,
        ).select_related(
            "payer", "created_by", "last_edited_by"
        ).prefetch_related("splits__user")

        category = request.query_params.get("category")
        member_id = request.query_params.get("member")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 15))

        if category:
            queryset = queryset.filter(category=category)
        if member_id:
            queryset = queryset.filter(splits__user_id=member_id)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        paginated = queryset[start:end]

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "has_more": end < total,
            "results": ExpenseSerializer(paginated, many=True).data,
        })

    def post(self, request, household_id):
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        expense = Expense.objects.create(
            household_id=household_id,
            description=data["description"],
            note=data.get("note", ""),
            amount=data["amount"],
            category=data["category"],
            custom_category=data.get("custom_category", ""),
            date=data["date"],
            payer_id=data["payer"],
            split_method=data["split_method"],
            created_by=request.user,
        )

        splits_data = data.get("splits", [])
        member_ids = data.get("member_ids", [])
        method = data["split_method"]
        total = Decimal(str(data["amount"]))

        # Determine the participant set
        if member_ids:
            participants = member_ids
        elif splits_data:
            participants = [s["user"] for s in splits_data]
        else:
            # Default: all active members
            participants = list(
                HouseholdMembership.objects.filter(
                    household_id=household_id,
                    status=HouseholdMembership.Status.ACTIVE,
                ).values_list("user_id", flat=True)
            )

        payer_id = data["payer"]

        if method == "equal" or (method in ("custom", "proportion", "percentage") and not splits_data):
            # Equal among participants
            share = total / len(participants)
            now = timezone.now()
            for uid in participants:
                is_payer_split = (uid == payer_id)
                ExpenseSplit.objects.create(
                    expense=expense,
                    user_id=uid,
                    amount=round(share, 2),
                    is_paid=is_payer_split,
                    paid_at=now if is_payer_split else None,
                    is_confirmed=is_payer_split,
                    confirmed_at=now if is_payer_split else None,
                )

        elif method == "custom":
            now = timezone.now()
            for split in splits_data:
                amt = Decimal(str(split.get("amount", 0)))
                is_payer_split = (split["user"] == payer_id)
                ExpenseSplit.objects.create(
                    expense=expense,
                    user_id=split["user"],
                    amount=amt,
                    is_paid=is_payer_split,
                    paid_at=now if is_payer_split else None,
                    is_confirmed=is_payer_split,
                    confirmed_at=now if is_payer_split else None,
                )

        elif method == "percentage":
            now = timezone.now()
            for split in splits_data:
                pct = Decimal(str(split.get("percentage", 0)))
                amt = (total * pct / Decimal("100")).quantize(Decimal("0.01"))
                is_payer_split = (split["user"] == payer_id)
                ExpenseSplit.objects.create(
                    expense=expense,
                    user_id=split["user"],
                    amount=amt,
                    percentage=pct,
                    is_paid=is_payer_split,
                    paid_at=now if is_payer_split else None,
                    is_confirmed=is_payer_split,
                    confirmed_at=now if is_payer_split else None,
                )

        elif method == "proportion":
            total_parts = sum(
                Decimal(str(s.get("proportion", 1))) for s in splits_data
            ) or Decimal("1")
            now = timezone.now()
            for split in splits_data:
                parts = Decimal(str(split.get("proportion", 1)))
                amt = (total * parts / total_parts).quantize(Decimal("0.01"))
                is_payer_split = (split["user"] == payer_id)
                ExpenseSplit.objects.create(
                    expense=expense,
                    user_id=split["user"],
                    amount=amt,
                    proportion=parts,
                    is_paid=is_payer_split,
                    paid_at=now if is_payer_split else None,
                    is_confirmed=is_payer_split,
                    confirmed_at=now if is_payer_split else None,
                )

        ActivityLog.objects.create(
            household_id=household_id,
            user=request.user,
            action="expense_created",
            entity_type="expense",
            entity_id=expense.id,
            description=f"{request.user.display_name} added \"{expense.description}\" (${expense.amount}).",
        )

        for split in expense.splits.exclude(user=request.user):
            Notification.objects.create(
                user=split.user,
                type=Notification.Type.EXPENSE_ADDED,
                title="New expense added",
                message=f"{request.user.display_name} added \"{expense.description}\" — you owe ${split.amount}.",
                data={"household_id": household_id, "expense_id": expense.id},
            )

        return Response(
            ExpenseSerializer(
                Expense.objects.prefetch_related("splits__user").get(id=expense.id)
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsHouseholdMember]
    lookup_url_kwarg = "expense_id"

    def get_queryset(self):
        return Expense.objects.filter(
            household_id=self.kwargs["household_id"]
        ).select_related("payer", "created_by", "last_edited_by").prefetch_related(
            "splits__user", "edit_history__edited_by"
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        # Compute field-level diff BEFORE saving
        tracked = ["description", "note", "amount", "category", "custom_category", "date"]
        changes = {}
        for f in tracked:
            old_val = str(getattr(instance, f, "") or "")
            new_val = str(serializer.validated_data.get(f, getattr(instance, f, "")) or "")
            if old_val.strip() != new_val.strip():
                changes[f] = {"old": old_val, "new": new_val}

        serializer.save(
            last_edited_by=self.request.user,
            last_edited_at=timezone.now(),
        )

        if changes:
            ExpenseEditHistory.objects.create(
                expense=serializer.instance,
                edited_by=self.request.user,
                changes=changes,
            )

        ActivityLog.objects.create(
            household_id=self.kwargs["household_id"],
            user=self.request.user,
            action="expense_updated",
            entity_type="expense",
            entity_id=serializer.instance.id,
            description=f"{self.request.user.display_name} edited \"{serializer.instance.description}\".",
        )

    def perform_destroy(self, instance):
        ActivityLog.objects.create(
            household_id=self.kwargs["household_id"],
            user=self.request.user,
            action="expense_deleted",
            entity_type="expense",
            entity_id=instance.id,
            description=f"{self.request.user.display_name} deleted \"{instance.description}\".",
        )
        instance.delete()


class MarkSplitPaidView(APIView):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def post(self, request, household_id, expense_id, split_id):
        try:
            split = ExpenseSplit.objects.select_related(
                "expense__payer", "user"
            ).get(
                id=split_id, expense_id=expense_id, expense__household_id=household_id
            )
        except ExpenseSplit.DoesNotExist:
            return Response({"detail": "Split not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if payer requires confirmation
        payer = split.expense.payer
        payer_membership = HouseholdMembership.objects.filter(
            household_id=household_id, user=payer, status=HouseholdMembership.Status.ACTIVE
        ).first()
        requires_confirmation = payer_membership and payer_membership.require_payment_confirmation

        split.is_paid = True
        split.paid_at = timezone.now()
        if not requires_confirmation:
            split.is_confirmed = True
            split.confirmed_at = timezone.now()
        split.save()

        ActivityLog.objects.create(
            household_id=household_id,
            user=request.user,
            action="split_marked_paid",
            entity_type="expense_split",
            entity_id=split.id,
            description=f"{split.user.display_name} marked ${split.amount} as paid for \"{split.expense.description}\".",
        )
        return Response({
            "message": "Marked as paid.",
            "requires_confirmation": requires_confirmation,
        })


class ConfirmSplitPaymentView(APIView):
    """Payer confirms they received the payment (when require_payment_confirmation is on)."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def post(self, request, household_id, expense_id, split_id):
        try:
            split = ExpenseSplit.objects.select_related(
                "expense__payer", "user"
            ).get(
                id=split_id, expense_id=expense_id, expense__household_id=household_id
            )
        except ExpenseSplit.DoesNotExist:
            return Response({"detail": "Split not found."}, status=status.HTTP_404_NOT_FOUND)

        if split.expense.payer != request.user:
            return Response(
                {"detail": "Only the payer can confirm receipt of payment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not split.is_paid:
            return Response(
                {"detail": "Split has not been marked as paid yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        split.is_confirmed = True
        split.confirmed_at = timezone.now()
        split.save()

        ActivityLog.objects.create(
            household_id=household_id,
            user=request.user,
            action="payment_confirmed",
            entity_type="expense_split",
            entity_id=split.id,
            description=f"{request.user.display_name} confirmed payment from {split.user.display_name} for \"{split.expense.description}\".",
        )
        Notification.objects.create(
            user=split.user,
            type=Notification.Type.EXPENSE_ADDED,
            title="Payment confirmed",
            message=f"{request.user.display_name} confirmed your payment for \"{split.expense.description}\".",
            data={"household_id": household_id, "expense_id": expense_id},
        )
        return Response({"message": "Payment confirmed."})


class BalanceView(APIView):
    """Compute who owes whom — with bidirectional net compression."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get(self, request, household_id):
        expenses = Expense.objects.filter(household_id=household_id).prefetch_related(
            "splits__user", "payer"
        )

        net = defaultdict(Decimal)
        user_names = {}

        for expense in expenses:
            user_names[expense.payer_id] = expense.payer.display_name
            for split in expense.splits.all():
                user_names[split.user_id] = split.user.display_name
                if not split.is_paid and split.user_id != expense.payer_id:
                    net[expense.payer_id] += split.amount
                    net[split.user_id] -= split.amount

        creditors = sorted(
            [(uid, amt) for uid, amt in net.items() if amt > 0],
            key=lambda x: -x[1],
        )
        debtors = sorted(
            [(uid, -amt) for uid, amt in net.items() if amt < 0],
            key=lambda x: -x[1],
        )

        settlements = []
        i, j = 0, 0
        while i < len(creditors) and j < len(debtors):
            c_id, c_amt = creditors[i]
            d_id, d_amt = debtors[j]
            transfer = min(c_amt, d_amt)
            if transfer > Decimal("0.01"):
                settlements.append({
                    "from_user": d_id,
                    "from_user_name": user_names.get(d_id, ""),
                    "to_user": c_id,
                    "to_user_name": user_names.get(c_id, ""),
                    "amount": transfer,
                })
            creditors[i] = (c_id, c_amt - transfer)
            debtors[j] = (d_id, d_amt - transfer)
            if creditors[i][1] < Decimal("0.01"):
                i += 1
            if debtors[j][1] < Decimal("0.01"):
                j += 1

        return Response(BalanceSerializer(settlements, many=True).data)


class MyActivityView(APIView):
    """Returns current user's full history: expenses (as payer or split) + chore assignments."""
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def get(self, request, household_id):
        user = request.user

        # All expenses where the user is the payer OR has a split
        expenses = (
            Expense.objects.filter(household_id=household_id)
            .filter(
                Q(payer=user) | Q(splits__user=user)
            )
            .distinct()
            .select_related("payer", "created_by")
            .prefetch_related("splits__user")
            .order_by("-date", "-created_at")
        )

        expense_items = []
        for e in expenses:
            my_split = next((s for s in e.splits.all() if s.user_id == user.id), None)
            others = [s for s in e.splits.all() if s.user_id != user.id]
            expense_items.append({
                "id": e.id,
                "type": "expense",
                "date": str(e.date),
                "description": e.description,
                "display_category": e.display_category,
                "total_amount": str(e.amount),
                "is_payer": e.payer_id == user.id,
                "payer_name": e.payer.display_name,
                "my_share": str(my_split.amount) if my_split else "0.00",
                "my_share_paid": my_split.is_paid if my_split else True,
                "my_share_confirmed": my_split.is_confirmed if my_split else True,
                "participants": [
                    {"user_id": s.user_id, "name": s.user.display_name, "amount": str(s.amount),
                     "is_paid": s.is_paid, "is_confirmed": s.is_confirmed}
                    for s in e.splits.all()
                ],
                "split_method": e.split_method,
                "note": e.note,
                "created_at": e.created_at.isoformat(),
            })

        # Chore assignments
        from apps.chores.models import ChoreAssignment
        assignments = (
            ChoreAssignment.objects.filter(
                chore__household_id=household_id,
                assigned_user=user,
            )
            .select_related("chore")
            .order_by("-due_date")
        )

        chore_items = []
        for a in assignments:
            chore_items.append({
                "id": a.id,
                "type": "chore",
                "date": str(a.due_date),
                "chore_id": a.chore_id,
                "title": a.chore.title,
                "description": a.chore.description,
                "recurrence": a.chore.recurrence,
                "is_done": a.is_done,
                "done_at": a.done_at.isoformat() if a.done_at else None,
                "note": a.note,
                "is_rotation": a.chore.is_rotation,
            })

        return Response({
            "expenses": expense_items,
            "chores": chore_items,
        })


class SettleUpView(APIView):
    permission_classes = [IsAuthenticated, IsHouseholdMember]

    def post(self, request, household_id):
        with_user = request.data.get("with_user")
        if not with_user:
            return Response({"error": "with_user ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with_user_id = int(with_user)
        except ValueError:
            return Response({"error": "Invalid user ID"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        
        # 1. request.user owes with_user
        # (request.user is the split user, with_user is the expense payer)
        splits_we_owe = ExpenseSplit.objects.filter(
            expense__household_id=household_id,
            expense__payer_id=with_user_id,
            user=request.user,
            is_confirmed=False
        )
        splits_we_owe.update(is_paid=True, paid_at=now, is_confirmed=True, confirmed_at=now)

        # 2. with_user owes request.user
        # (with_user is the split user, request.user is the expense payer)
        splits_they_owe = ExpenseSplit.objects.filter(
            expense__household_id=household_id,
            expense__payer=request.user,
            user_id=with_user_id,
            is_confirmed=False
        )
        splits_they_owe.update(is_paid=True, paid_at=now, is_confirmed=True, confirmed_at=now)

        return Response({"status": "settled"})

