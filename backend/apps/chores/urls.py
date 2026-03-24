from django.urls import path
from apps.chores.views import (
    ChoreListCreateView,
    ChoreDetailView,
    ChoreCompleteView,
    ChoreRequestSwapView,
    ChoreReassignAssignmentView,
    ChoreEditNoteView,
    MyScheduleView,
)

urlpatterns = [
    path("", ChoreListCreateView.as_view(), name="chore-list-create"),
    path("schedule/", MyScheduleView.as_view(), name="chore-my-schedule"),
    path("<int:chore_id>/", ChoreDetailView.as_view(), name="chore-detail"),
    path("<int:chore_id>/complete/", ChoreCompleteView.as_view(), name="chore-complete"),
    path("<int:chore_id>/swap/", ChoreRequestSwapView.as_view(), name="chore-swap"),
    path("<int:chore_id>/reassign/", ChoreReassignAssignmentView.as_view(), name="chore-reassign"),
    path("<int:chore_id>/logs/<int:log_id>/note/", ChoreEditNoteView.as_view(), name="chore-log-note"),
]
