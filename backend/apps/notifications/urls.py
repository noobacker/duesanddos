from django.urls import path
from apps.notifications.views import (
    NotificationListView,
    NotificationReadView,
    NotificationReadAllView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("<int:notification_id>/read/", NotificationReadView.as_view(), name="notification-read"),
    path("read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
]
