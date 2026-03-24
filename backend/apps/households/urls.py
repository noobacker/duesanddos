from django.urls import path
from apps.households.views import (
    HouseholdListCreateView,
    HouseholdDetailView,
    MemberListView,
    MemberUpdateView,
    MemberRemoveView,
    CreateInviteView,
    JoinHouseholdView,
)

urlpatterns = [
    path("", HouseholdListCreateView.as_view(), name="household-list-create"),
    path("<int:household_id>/", HouseholdDetailView.as_view(), name="household-detail"),
    path("<int:household_id>/members/", MemberListView.as_view(), name="member-list"),
    path(
        "<int:household_id>/members/<int:member_id>/",
        MemberUpdateView.as_view(),
        name="member-update",
    ),
    path(
        "<int:household_id>/members/<int:member_id>/remove/",
        MemberRemoveView.as_view(),
        name="member-remove",
    ),
    path(
        "<int:household_id>/invites/",
        CreateInviteView.as_view(),
        name="invite-create",
    ),
    path("join/", JoinHouseholdView.as_view(), name="household-join"),
]
