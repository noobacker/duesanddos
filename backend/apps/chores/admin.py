from django.contrib import admin
from apps.chores.models import Chore, ChoreLog


@admin.register(Chore)
class ChoreAdmin(admin.ModelAdmin):
    list_display = ("title", "household", "assigned_to", "status", "due_date")
    list_filter = ("status", "recurrence")
    search_fields = ("title",)


@admin.register(ChoreLog)
class ChoreLogAdmin(admin.ModelAdmin):
    list_display = ("chore", "user", "action", "created_at")
    list_filter = ("action",)
