from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/", include("apps.users.urls")),
    path("api/households/", include("apps.households.urls")),
    path("api/households/<int:household_id>/expenses/", include("apps.expenses.urls")),
    path("api/households/<int:household_id>/chores/", include("apps.chores.urls")),
    path("api/households/<int:household_id>/messages/", include("apps.chat.urls")),
    path("api/households/<int:household_id>/activity/", include("apps.activity.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/admin/", include("apps.platform_admin.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
