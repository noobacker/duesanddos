from django.contrib import admin
from apps.households.models import Household, HouseholdMembership, Invite


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "created_at")
    search_fields = ("name",)


@admin.register(HouseholdMembership)
class HouseholdMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "household", "role", "status", "joined_at")
    list_filter = ("role", "status")


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ("code", "household", "created_by", "expires_at", "used_by")
    search_fields = ("code",)
