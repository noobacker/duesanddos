from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        EXPENSE_ADDED = "expense_added", "New Expense"
        EXPENSE_UPDATED = "expense_updated", "Expense Updated"
        CHORE_ASSIGNED = "chore_assigned", "Chore Assigned"
        CHORE_DUE_SOON = "chore_due_soon", "Chore Due Soon"
        CHORE_OVERDUE = "chore_overdue", "Chore Overdue"
        REASSIGN_REQUEST = "reassign_request", "Reassignment Requested"
        REASSIGN_APPROVED = "reassign_approved", "Reassignment Approved"
        MEMBER_JOINED = "member_joined", "Member Joined"
        MEMBER_REMOVED = "member_removed", "Member Removed"
        GENERAL = "general", "General"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=25, choices=Type.choices, default=Type.GENERAL)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.type}] {self.title} → {self.user.email}"
