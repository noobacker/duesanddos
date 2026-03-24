from rest_framework import serializers
from apps.expenses.models import Expense, ExpenseEditHistory, ExpenseSplit


class ExpenseEditHistorySerializer(serializers.ModelSerializer):
    edited_by_name = serializers.CharField(source="edited_by.display_name", read_only=True)

    class Meta:
        model = ExpenseEditHistory
        fields = ["id", "edited_by", "edited_by_name", "edited_at", "changes"]
        read_only_fields = ["id", "edited_at"]


class ExpenseSplitSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.display_name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = [
            "id", "user", "user_name", "user_email",
            "amount", "percentage", "proportion",
            "is_paid", "paid_at", "is_confirmed", "confirmed_at",
        ]
        read_only_fields = ["id", "paid_at", "confirmed_at"]


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    edit_history = ExpenseEditHistorySerializer(many=True, read_only=True)
    payer_name = serializers.CharField(source="payer.display_name", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.display_name", read_only=True
    )
    last_edited_by_name = serializers.SerializerMethodField()
    display_category = serializers.ReadOnlyField()

    def get_last_edited_by_name(self, obj):
        return obj.last_edited_by.display_name if obj.last_edited_by else None

    class Meta:
        model = Expense
        fields = [
            "id", "description", "note", "amount", "category", "custom_category",
            "display_category", "date",
            "payer", "payer_name", "split_method",
            "splits", "created_by", "created_by_name",
            "last_edited_by", "last_edited_by_name", "last_edited_at",
            "edit_history",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at",
                            "last_edited_by", "last_edited_at", "edit_history"]


class SplitInputSerializer(serializers.Serializer):
    user = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    proportion = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)


class ExpenseCreateSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=255)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    category = serializers.ChoiceField(
        choices=Expense.Category.choices, default="other", required=False
    )
    custom_category = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    date = serializers.DateField()
    payer = serializers.IntegerField()
    split_method = serializers.ChoiceField(
        choices=Expense.SplitMethod.choices, default="equal"
    )
    # member_ids: who participates in the split (optional — defaults to all active members)
    member_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )
    splits = serializers.ListField(child=SplitInputSerializer(), required=False)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate(self, data):
        method = data.get("split_method", "equal")
        splits = data.get("splits", [])

        if method in ("custom", "percentage", "proportion") and not splits:
            # Allow empty: will fall back to equal among member_ids
            pass

        if method == "percentage" and splits:
            total = sum(float(s.get("percentage", 0)) for s in splits)
            if abs(total - 100.0) > 0.5:
                raise serializers.ValidationError(
                    {"splits": f"Percentages must sum to 100% (got {total:.1f}%)."}
                )

        return data


class BalanceSerializer(serializers.Serializer):
    from_user = serializers.IntegerField()
    from_user_name = serializers.CharField()
    to_user = serializers.IntegerField()
    to_user_name = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
