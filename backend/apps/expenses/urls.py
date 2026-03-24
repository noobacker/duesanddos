from django.urls import path
from apps.expenses.views import (
    ExpenseListCreateView,
    ExpenseDetailView,
    MarkSplitPaidView,
    ConfirmSplitPaymentView,
    BalanceView,
    MyActivityView,
    SettleUpView,
)

urlpatterns = [
    path("", ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("<int:expense_id>/", ExpenseDetailView.as_view(), name="expense-detail"),
    path(
        "<int:expense_id>/splits/<int:split_id>/mark-paid/",
        MarkSplitPaidView.as_view(),
        name="split-mark-paid",
    ),
    path(
        "<int:expense_id>/splits/<int:split_id>/confirm/",
        ConfirmSplitPaymentView.as_view(),
        name="split-confirm",
    ),
    path("balances/", BalanceView.as_view(), name="balance-view"),
    path("settle/", SettleUpView.as_view(), name="settle-up"),
    path("activity/", MyActivityView.as_view(), name="my-activity"),
]

