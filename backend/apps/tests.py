from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.households.models import Household, HouseholdMembership, Invite
from apps.expenses.models import Expense, ExpenseSplit
from apps.chores.models import Chore

User = get_user_model()


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register(self):
        res = self.client.post(
            "/api/auth/register/",
            {"email": "test@example.com", "password": "Testpass123!", "username": "testuser", "full_name": "Test User"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("user", res.data)
        self.assertEqual(res.data["user"]["email"], "test@example.com")

    def test_login(self):
        User.objects.create_user(email="login@example.com", password="pass123")
        res = self.client.post(
            "/api/auth/login/",
            {"username_or_email": "login@example.com", "password": "pass123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", res.cookies)

    def test_login_wrong_password(self):
        User.objects.create_user(email="fail@example.com", password="pass123")
        res = self.client.post(
            "/api/auth/login/",
            {"username_or_email": "fail@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class HouseholdTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@example.com", password="pass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_create_household(self):
        res = self.client.post(
            "/api/households/", {"name": "Test House"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Test House")
        self.assertEqual(res.data["my_role"], "admin")

    def test_list_households(self):
        h = Household.objects.create(name="My House", created_by=self.user)
        HouseholdMembership.objects.create(
            household=h, user=self.user, role="admin"
        )
        res = self.client.get("/api/households/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_join_household(self):
        other = User.objects.create_user(email="other@example.com", password="pass123")
        h = Household.objects.create(name="Other House", created_by=other)
        HouseholdMembership.objects.create(
            household=h, user=other, role="admin"
        )
        from django.utils import timezone
        from datetime import timedelta

        invite = Invite.objects.create(
            household=h, created_by=other,
            expires_at=timezone.now() + timedelta(days=7),
        )
        res = self.client.post(
            "/api/households/join/", {"code": invite.code}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class ExpenseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@example.com", password="pass123"
        )
        self.other = User.objects.create_user(
            email="other@example.com", password="pass123"
        )
        self.household = Household.objects.create(
            name="Test House", created_by=self.user
        )
        HouseholdMembership.objects.create(
            household=self.household, user=self.user, role="admin"
        )
        HouseholdMembership.objects.create(
            household=self.household, user=self.other, role="member"
        )
        self.client.force_authenticate(user=self.user)

    def test_create_expense_equal_split(self):
        res = self.client.post(
            f"/api/households/{self.household.id}/expenses/",
            {
                "description": "Groceries",
                "amount": "100.00",
                "category": "groceries",
                "date": "2026-03-01",
                "payer": self.user.id,
                "split_method": "equal",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data["splits"]), 2)
        self.assertEqual(float(res.data["splits"][0]["amount"]), 50.0)

    def test_balances(self):
        self.client.post(
            f"/api/households/{self.household.id}/expenses/",
            {
                "description": "Rent",
                "amount": "200.00",
                "category": "rent",
                "date": "2026-03-01",
                "payer": self.user.id,
                "split_method": "equal",
            },
            format="json",
        )
        res = self.client.get(
            f"/api/households/{self.household.id}/expenses/balances/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res.data) > 0)


class ChoreTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@example.com", password="pass123"
        )
        self.household = Household.objects.create(
            name="Test House", created_by=self.user
        )
        HouseholdMembership.objects.create(
            household=self.household, user=self.user, role="admin"
        )
        self.client.force_authenticate(user=self.user)

    def test_create_chore(self):
        res = self.client.post(
            f"/api/households/{self.household.id}/chores/",
            {
                "title": "Clean Kitchen",
                "assigned_to": self.user.id,
                "due_date": "2026-03-10",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], "Clean Kitchen")

    def test_complete_chore(self):
        chore = Chore.objects.create(
            household=self.household,
            title="Do Dishes",
            assigned_to=self.user,
            created_by=self.user,
        )
        res = self.client.post(
            f"/api/households/{self.household.id}/chores/{chore.id}/complete/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "done")


class AdminTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@example.com", password="admin123"
        )
        self.admin.is_platform_admin = True
        self.admin.save()
        self.regular = User.objects.create_user(
            email="regular@example.com", password="pass123"
        )

    def test_admin_overview(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/admin/overview/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_users", res.data)

    def test_regular_user_blocked(self):
        self.client.force_authenticate(user=self.regular)
        res = self.client.get("/api/admin/overview/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_list(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/admin/users/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res.data) >= 2)
