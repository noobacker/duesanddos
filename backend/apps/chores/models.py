from django.conf import settings
from django.db import models


class Chore(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        DONE = "done", "Done"

    class Recurrence(models.TextChoices):
        NONE = "none", "None (one-time)"
        WEEKLY = "weekly", "Weekly"
        BIWEEKLY = "biweekly", "Biweekly"
        MONTHLY = "monthly", "Monthly"
        UNTIL_CLOSED = "until_closed", "Until closed by admin"

    household = models.ForeignKey(
        "households.Household", on_delete=models.CASCADE, related_name="chores"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    # Single assignee (for non-rotation chores)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_chores",
    )

    # Rotation: pool of users who take turns
    is_rotation = models.BooleanField(default=False)
    rotation_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rotation_chores",
        blank=True,
    )
    rotation_order = models.PositiveSmallIntegerField(
        default=0,
        help_text="Index of who is currently 'up' in the rotation list",
    )

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.TODO
    )
    due_date = models.DateField(null=True, blank=True)
    recurrence = models.CharField(
        max_length=15, choices=Recurrence.choices, default=Recurrence.NONE
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="chores_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "-created_at"]

    def __str__(self):
        return self.title

    def current_assignee(self):
        """Return the user whose turn it currently is in the rotation."""
        if not self.is_rotation:
            return self.assigned_to
        members = list(self.rotation_members.order_by("id"))
        if not members:
            return None
        idx = self.rotation_order % len(members)
        return members[idx]

    def advance_rotation(self):
        """Move to the next person in the rotation."""
        count = self.rotation_members.count()
        if count > 0:
            self.rotation_order = (self.rotation_order + 1) % count
            self.save(update_fields=["rotation_order"])


class ChoreAssignment(models.Model):
    """A single occurrence of a chore assigned to a user for a given period."""

    chore = models.ForeignKey(
        Chore, on_delete=models.CASCADE, related_name="assignments"
    )
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="chore_assignments",
    )
    due_date = models.DateField()
    is_done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)
    done_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chore_completions",
    )
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return f"{self.chore.title} — {self.assigned_user} on {self.due_date}"


class ChoreLog(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Created"
        ASSIGNED = "assigned", "Assigned"
        COMPLETED = "completed", "Completed"
        REASSIGNED = "reassigned", "Reassigned"
        REASSIGN_REQUESTED = "reassign_requested", "Reassign Requested"
        SWAP_REQUESTED = "swap_requested", "Swap Requested"
        SWAP_APPROVED = "swap_approved", "Swap Approved"
        NOTE_EDITED = "note_edited", "Note Edited"

    chore = models.ForeignKey(
        Chore, on_delete=models.CASCADE, related_name="logs"
    )
    assignment = models.ForeignKey(
        ChoreAssignment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="chore_logs",
    )
    action = models.CharField(max_length=25, choices=Action.choices)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} on {self.chore.title}"
