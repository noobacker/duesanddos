from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class AuthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=False)
        # Enable cookie persistence across requests
        self.client.handler.load_middleware()
        
        self.register_url = reverse("auth-register")
        self.login_url = reverse("auth-login")
        self.logout_url = reverse("auth-logout")
        self.forgot_url = reverse("auth-forgot-password")
        self.reset_url = reverse("auth-reset-password")
        self.google_url = reverse("auth-google")
        self.me_url = reverse("me")

        self.valid_payload = {
            "email": "test@example.com",
            "password": "SecurePass1",
            "full_name": "Test User",
        }

    def _authenticate(self):
        """Helper to register and login a user to set auth cookies."""
        self.client.post(self.register_url, self.valid_payload, format="json")
        # APIClient should now have the cookies from the response

    # ── Registration ──────────────────────────────────────────────────────────
    def test_register_success(self):
        res = self.client.post(self.register_url, self.valid_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("user", res.data)
        self.assertEqual(res.data["user"]["email"], "test@example.com")
        self.assertIn("access_token", res.cookies)
        self.assertIn("refresh_token", res.cookies)

    def test_register_duplicate_email(self):
        User.objects.create_user(email="test@example.com", password="SecurePass1")
        res = self.client.post(self.register_url, self.valid_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_weak_password(self):
        payload = {**self.valid_payload, "password": "weak"}
        res = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_no_uppercase(self):
        payload = {**self.valid_payload, "password": "lowercase1"}
        res = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_no_digit(self):
        payload = {**self.valid_payload, "password": "NoDigitPass"}
        res = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Login ─────────────────────────────────────────────────────────────────
    def test_password_is_hashed_on_creation(self):
        user = User.objects.create_user(email="hashtest@example.com", password="SecurePass1")
        # Ensure the raw password is NOT saved directly to the database
        self.assertNotEqual(user.password, "SecurePass1")
        # Ensure Django correctly prepends its hashing algorithm specifier to the DB string
        self.assertTrue(user.password.startswith("pbkdf2_") or user.password.startswith("argon2"))
        # Ensure the check_password method correctly validates against the hash
        self.assertTrue(user.check_password("SecurePass1"))

    def test_login_success(self):
        User.objects.create_user(email="test@example.com", password="SecurePass1")
        res = self.client.post(
            self.login_url,
            {"email": "test@example.com", "password": "SecurePass1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.cookies)

    def test_login_wrong_password(self):
        User.objects.create_user(email="test@example.com", password="SecurePass1")
        res = self.client.post(
            self.login_url,
            {"email": "test@example.com", "password": "WrongPass1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user(self):
        res = self.client.post(
            self.login_url,
            {"email": "nobody@example.com", "password": "SecurePass1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Google Login ──────────────────────────────────────────────────────────
    def test_google_login_saves_avatar(self):
        from unittest.mock import patch
        
        google_user_info = {
            "email": "google@example.com",
            "given_name": "Google",
            "family_name": "User",
            "picture": "https://lh3.googleusercontent.com/a/avatar_url",
            "email_verified": True,
        }
        
        with patch("google.oauth2.id_token.verify_oauth2_token", return_value=google_user_info):
            res = self.client.post(self.google_url, {"credential": "mock-token"}, format="json")
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            
            user = User.objects.get(email="google@example.com")
            self.assertEqual(user.social_avatar_url, google_user_info["picture"])
            self.assertEqual(res.data["user"]["avatar_url"], google_user_info["picture"])

    # ── Logout ────────────────────────────────────────────────────────────────
    def test_logout_requires_auth(self):
        res = self.client.post(self.logout_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_success(self):
        self._authenticate()
        res = self.client.post(self.logout_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Cookies should be cleared
        self.assertEqual(res.cookies.get("access_token", {}).get("max-age", 1), 0)

    # ── Forgot Password ───────────────────────────────────────────────────────
    def test_forgot_password_always_200(self):
        res = self.client.post(
            self.forgot_url,
            {"email": "notregistered@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_forgot_password_registered_user(self):
        User.objects.create_user(email="test@example.com", password="SecurePass1")
        res = self.client.post(
            self.forgot_url, {"email": "test@example.com"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # ── Reset Password ────────────────────────────────────────────────────────
    def test_reset_password_invalid_token(self):
        res = self.client.post(
            self.reset_url,
            {"uid": "invalid", "token": "invalid", "new_password": "NewPass1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_password_success(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        user = User.objects.create_user(email="test@example.com", password="OldPass1")
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        res = self.client.post(
            self.reset_url,
            {"uid": uid, "token": token, "new_password": "NewPass1"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewPass1"))

    # ── Me Endpoint ───────────────────────────────────────────────────────────
    def test_me_requires_auth(self):
        res = self.client.get(self.me_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_user(self):
        self._authenticate()
        res = self.client.get(self.me_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["email"], "test@example.com")
        self.assertEqual(res.data["full_name"], "Test User")

    def test_me_patch_full_name(self):
        self._authenticate()
        res = self.client.patch(self.me_url, {"full_name": "Updated Name"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["full_name"], "Updated Name")
