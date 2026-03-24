import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create the initial platform admin user from environment variables"

    def handle(self, *args, **options):
        email = os.environ.get("INITIAL_ADMIN_EMAIL")
        password = os.environ.get("INITIAL_ADMIN_PASSWORD")
        name = os.environ.get("INITIAL_ADMIN_NAME", "Platform Admin")

        if not email or not password:
            self.stderr.write(
                self.style.ERROR(
                    "INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD env vars are required."
                )
            )
            return

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": name,
                "is_platform_admin": True,
                "is_staff": True,
                "is_superuser": True,
                "email_verified": True,
            },
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f"Platform admin created: {email}")
            )
        else:
            if not user.is_platform_admin:
                user.is_platform_admin = True
                user.is_staff = True
                user.is_superuser = True
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(f"Existing user promoted to platform admin: {email}")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f"Platform admin already exists: {email}")
                )
