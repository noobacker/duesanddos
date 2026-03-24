from django.contrib import admin
from apps.activity.models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("household", "user", "action", "entity_type", "created_at")
    list_filter = ("action", "entity_type")
