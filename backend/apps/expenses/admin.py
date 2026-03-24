from django.contrib import admin
from apps.expenses.models import Expense, ExpenseSplit


class ExpenseSplitInline(admin.TabularInline):
    model = ExpenseSplit
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("description", "amount", "category", "household", "payer", "date")
    list_filter = ("category", "split_method")
    search_fields = ("description",)
    inlines = [ExpenseSplitInline]
