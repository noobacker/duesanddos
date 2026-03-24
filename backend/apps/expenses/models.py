from django.conf import settings
from django.db import models


class Expense(models.Model):
    class SplitMethod(models.TextChoices):
        EQUAL = "equal", "Equal Split"
        CUSTOM = "custom", "Custom Amounts"
        PERCENTAGE = "percentage", "Percentage"
        PROPORTION = "proportion", "Proportion (e.g. 2:1:1)"

    class Category(models.TextChoices):
        RENT = "rent", "Rent"
        UTILITIES = "utilities", "Utilities"
        GROCERIES = "groceries", "Groceries"
        DINING = "dining", "Dining Out"
        TRANSPORT = "transport", "Transportation"
        ENTERTAINMENT = "entertainment", "Entertainment"
        HOUSEHOLD = "household", "Household Supplies"
        SUBSCRIPTIONS = "subscriptions", "Subscriptions"
        OTHER = "other", "Other"

    household = models.ForeignKey(
        "households.Household", on_delete=models.CASCADE, related_name="expenses"
    )
    description = models.CharField(max_length=255)
    note = models.TextField(blank=True, default="")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.OTHER
    )
    custom_category = models.CharField(max_length=100, blank=True, default="")
    date = models.DateField()
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses_paid",
    )
    split_method = models.CharField(
        max_length=15, choices=SplitMethod.choices, default=SplitMethod.EQUAL
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="expenses_created",
    )
    last_edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses_edited",
    )
    last_edited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.description} — ${self.amount}"

    @property
    def display_category(self):
        if self.custom_category:
            return self.custom_category
        return self.get_category_display()


class ExpenseSplit(models.Model):
    expense = models.ForeignKey(
        Expense, on_delete=models.CASCADE, related_name="splits"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_splits",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    proportion = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Relative weight for proportion-based splits"
    )
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    is_confirmed = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("expense", "user")

    def __str__(self):
        return f"{self.user.email} owes ${self.amount} for {self.expense.description}"


class ExpenseEditHistory(models.Model):
    """Tracks field-level changes each time an expense is edited."""
    expense = models.ForeignKey(
        Expense, on_delete=models.CASCADE, related_name="edit_history"
    )
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="expense_edits",
    )
    edited_at = models.DateTimeField(auto_now_add=True)
    # {"description": {"old": "...", "new": "..."}, "amount": {"old": "50.00", "new": "30.00"}}
    changes = models.JSONField(default=dict)

    class Meta:
        ordering = ["-edited_at"]

    def __str__(self):
        return f"Edit of {self.expense.description} at {self.edited_at}"

