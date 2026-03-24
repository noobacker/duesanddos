from django.urls import path
from apps.chat.views import MessageListCreateView

urlpatterns = [
    path("", MessageListCreateView.as_view(), name="message-list-create"),
]
