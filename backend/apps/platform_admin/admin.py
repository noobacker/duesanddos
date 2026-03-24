from django.contrib import admin
from apps.platform_admin.models import AdminAuditLog


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = ("admin", "action", "target_type", "target_id", "created_at")
    list_filter = ("action", "target_type")
