from django.urls import path
from apps.platform_admin.views import (
    AdminOverviewView,
    AdminUserListView,
    AdminUserDetailView,
    AdminHouseholdListView,
    AdminHouseholdDetailView,
    AdminAuditListView,
)

urlpatterns = [
    path("overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("households/", AdminHouseholdListView.as_view(), name="admin-household-list"),
    path(
        "households/<int:household_id>/",
        AdminHouseholdDetailView.as_view(),
        name="admin-household-detail",
    ),
    path("audit/", AdminAuditListView.as_view(), name="admin-audit-list"),
]
