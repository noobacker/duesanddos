from django.contrib import admin
from apps.chat.models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("sender", "household", "content", "created_at")
    search_fields = ("content",)
