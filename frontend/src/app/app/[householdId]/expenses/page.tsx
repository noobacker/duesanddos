"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { expenseApi, householdApi } from "@/lib/api";
import type { Expense, HouseholdMembership, Balance } from "@/types";
import {
  Plus, X, Loader2, DollarSign, ChevronDown, ChevronUp,
  Check, Filter, ArrowRight, Pencil, AlertCircle, TrendingDown, TrendingUp,
} from "lucide-react";
import { CategoryCombo } from "@/components/CategoryCombo";
import { ConfirmModal, PromptModal, Modal } from "@/components/Modal";

const PRESET_CATEGORIES = [
  "Rent", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Entertainment", "Household Supplies", "Subscriptions", "Other",
];

type SplitMethod = "equal" | "custom" | "percentage";

interface SplitEntry { userId: number; value: string; }

interface ExpenseFormState {
  desc: string; note: string; amount: string; category: string;
  date: string; payer: number; splitMethod: SplitMethod;
  selectedMembers: number[]; splits: SplitEntry[]; error: string;
}

const defaultForm = (userId: number, allMemberIds: number[]): ExpenseFormState => ({
  desc: "", note: "", amount: "", category: "",
  date: new Date().toISOString().split("T")[0],
  payer: userId, splitMethod: "equal",
  selectedMembers: allMemberIds, splits: [], error: "",
});

export default function ExpensesPage() {
  const { user } = useAuth();
  const { householdId } = useParams();
  const hid = Number(householdId);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<HouseholdMembership[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [myMembership, setMyMembership] = useState<HouseholdMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showBalances, setShowBalances] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Create / Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>({ ...defaultForm(0, []) });

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [markPaidTarget, setMarkPaidTarget] = useState<{ eid: number; sid: number; requiresConfirm: boolean } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ eid: number; sid: number; name: string } | null>(null);
  const [editHistoryTarget, setEditHistoryTarget] = useState<{ id: number; desc: string; history: import("@/types").ExpenseEditHistoryEntry[] } | null>(null);

  // Filter
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUser, setFilterUser] = useState<number | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchData = useCallback(async (p = 1, append = false) => {
    try {
      const params: Record<string, string | number> = { page: p, page_size: 15 };
      if (filterCategory) params.category = filterCategory.toLowerCase();
      if (filterUser) params.member_id = filterUser;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      const [expRes, memRes, balRes] = await Promise.all([
        expenseApi.list(hid, params),
        householdApi.getMembers(hid),
        expenseApi.getBalances(hid),
      ]);
      const data = expRes.data;
      setExpenses(prev => append ? [...prev, ...data.results] : data.results);
      setHasMore(data.has_more);
      setTotalCount(data.count);
      setPage(p);
      const allMembers: HouseholdMembership[] = memRes.data;
      setMembers(allMembers);
      setBalances(balRes.data);
      const me = allMembers.find(m => m.user.id === user?.id) || null;
      setMyMembership(me);
      if (!form.payer && user) {
        setForm(f => ({ ...f, payer: user.id, selectedMembers: allMembers.map(m => m.user.id) }));
      }
    } catch {}
    setLoading(false);
  }, [hid, filterCategory, filterUser, filterDateFrom, filterDateTo, user]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // Sync splits when method/members change
  const syncSplits = (method: SplitMethod, selectedMembers: number[], prevSplits: SplitEntry[]) => {
    if (method === "equal") return [];
    const defaultVal = method === "percentage"
      ? String(Math.floor(100 / (selectedMembers.length || 1)))
      : "1";
    return selectedMembers.map(uid => ({
      userId: uid,
      value: prevSplits.find(s => s.userId === uid)?.value || defaultVal,
    }));
  };

  const setFormField = <K extends keyof ExpenseFormState>(key: K, value: ExpenseFormState[K]) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === "splitMethod" || key === "selectedMembers") {
        next.splits = syncSplits(
          key === "splitMethod" ? value as SplitMethod : f.splitMethod,
          key === "selectedMembers" ? value as number[] : f.selectedMembers,
          f.splits,
        );
      }
      return next;
    });
  };

  const totalAmount = useMemo(() => parseFloat(form.amount) || 0, [form.amount]);

  const splitPreview = useMemo(() => {
    if (!totalAmount || !form.selectedMembers.length) return {} as Record<number, number>;
    const result: Record<number, number> = {};
    if (form.splitMethod === "equal") {
      const share = totalAmount / form.selectedMembers.length;
      form.selectedMembers.forEach(uid => { result[uid] = share; });
    } else if (form.splitMethod === "custom") {
      form.splits.forEach(s => { result[s.userId] = parseFloat(s.value) || 0; });
    } else if (form.splitMethod === "percentage") {
      form.splits.forEach(s => { result[s.userId] = (totalAmount * (parseFloat(s.value) || 0)) / 100; });
    }
    return result;
  }, [form.splitMethod, form.splits, totalAmount, form.selectedMembers]);

  const pctTotal = useMemo(() =>
    form.splitMethod === "percentage" ? form.splits.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0) : 0,
  [form.splits, form.splitMethod]);

  const customTotal = useMemo(() =>
    form.splitMethod === "custom" ? form.splits.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0) : 0,
  [form.splits, form.splitMethod]);

  const openCreate = () => {
    setEditingExpense(null);
    setForm(defaultForm(user?.id || 0, members.map(m => m.user.id)));
    setShowForm(true);
  };

  const openEdit = (e: Expense, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setEditingExpense(e);
    setForm({
      desc: e.description, note: e.note || "", amount: e.amount,
      category: e.display_category || e.category, date: e.date, payer: e.payer,
      splitMethod: e.split_method === "proportion" ? "equal" : e.split_method as SplitMethod,
      selectedMembers: e.splits.map(s => s.user),
      splits: e.splits.map(s => ({
        userId: s.user,
        value: e.split_method === "percentage" ? (s.percentage || "0") : s.amount,
      })),
      error: "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.desc.trim() || !form.amount || !form.payer || !form.selectedMembers.length) {
      setFormField("error", "Fill in description, amount, payer, and select at least one person.");
      return;
    }
    if (form.splitMethod === "percentage" && Math.abs(pctTotal - 100) > 0.5) {
      setFormField("error", `Percentages must sum to 100% (currently ${pctTotal.toFixed(1)}%).`);
      return;
    }
    if (form.splitMethod === "custom" && Math.abs(customTotal - totalAmount) > 0.01) {
      setFormField("error", `Custom amounts sum to $${customTotal.toFixed(2)}, but expense is $${totalAmount.toFixed(2)}.`);
      return;
    }
    setSubmitting(true);
    try {
      const isPreset = PRESET_CATEGORIES.map(c => c.toLowerCase()).includes(form.category.toLowerCase());
      const payload: Record<string, unknown> = {
        description: form.desc.trim(), note: form.note,
        amount: parseFloat(form.amount),
        category: isPreset ? form.category.toLowerCase().replace(/ /g, "_") : "other",
        custom_category: isPreset ? "" : form.category,
        date: form.date, payer: form.payer,
        split_method: form.splitMethod,
        member_ids: form.selectedMembers,
      };
      if (form.splitMethod !== "equal") {
        payload.splits = form.splits.map(s => ({
          user: s.userId,
          ...(form.splitMethod === "custom" ? { amount: parseFloat(s.value) || 0 } : {}),
          ...(form.splitMethod === "percentage" ? { percentage: parseFloat(s.value) || 0 } : {}),
        }));
      }
      if (editingExpense) {
        await expenseApi.update(hid, editingExpense.id, payload);
      } else {
        await expenseApi.create(hid, payload);
      }
      setShowForm(false);
      setEditingExpense(null);
      fetchData(1);
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const msgs = Object.values(e?.response?.data || {}).flat();
      setFormField("error", msgs.join(" ") || "Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await expenseApi.delete(hid, deleteTarget);
    setDeleteTarget(null);
    fetchData(1);
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    await expenseApi.markPaid(hid, markPaidTarget.eid, markPaidTarget.sid);
    setMarkPaidTarget(null);
    fetchData(page);
  };

  // Item 1: self-pay — skip the confirm modal and mark directly
  const handleSelfMarkPaid = async (eid: number, sid: number) => {
    await expenseApi.markPaid(hid, eid, sid);
    fetchData(page);
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    await expenseApi.confirmPayment(hid, confirmTarget.eid, confirmTarget.sid);
    setConfirmTarget(null);
    fetchData(page);
  };

  const myOwed = balances.filter(b => b.from_user === user?.id);
  const myReceive = balances.filter(b => b.to_user === user?.id);
  const totalOwed = myOwed.reduce((s, b) => s + parseFloat(String(b.amount)), 0);
  const totalReceive = myReceive.reduce((s, b) => s + parseFloat(String(b.amount)), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={24} className="animate-spin text-brand-600" />
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Expenses</h1>
          <p className="text-sm text-stone-400 mt-0.5">{totalCount} total</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Balance Banner — always visible */}
      {(myOwed.length > 0 || myReceive.length > 0) && (
        <div className="mb-5 rounded-2xl border border-stone-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center divide-x divide-stone-100">
            {myOwed.length > 0 && (
              <div className="flex flex-1 items-center gap-2.5 px-5 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
                  <TrendingDown size={15} className="text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">You owe</p>
                  <p className="text-lg font-bold text-red-600">${totalOwed.toFixed(2)}</p>
                </div>
              </div>
            )}
            {myReceive.length > 0 && (
              <div className="flex flex-1 items-center gap-2.5 px-5 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50">
                  <TrendingUp size={15} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">You're owed</p>
                  <p className="text-lg font-bold text-green-600">${totalReceive.toFixed(2)}</p>
                </div>
              </div>
            )}
            <button
              className="flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors shrink-0"
              onClick={() => setShowBalances(o => !o)}
            >
              {showBalances ? "Hide" : "View all"}
              <ArrowRight size={13} className={`transition-transform ${showBalances ? "rotate-90" : ""}`} />
            </button>
          </div>

          {/* Expanded settlement detail */}
          {showBalances && (
            <div className="border-t border-stone-100 px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Net settlements (compressed)</p>
              {balances.length === 0
                ? <p className="text-sm text-stone-400">All settled up!</p>
                : (
                  <div className="space-y-2">
                    {balances.map((b, i) => {
                      const isMe = b.from_user === user?.id || b.to_user === user?.id;
                      return (
                        <div key={i} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${isMe ? "bg-stone-50" : ""}`}>
                          <span className={`text-sm font-medium ${b.from_user === user?.id ? "text-red-600" : "text-stone-700"}`}>
                            {b.from_user === user?.id ? "You" : b.from_user_name}
                          </span>
                          <ArrowRight size={12} className="text-stone-300" />
                          <span className={`text-sm font-medium ${b.to_user === user?.id ? "text-green-600" : "text-stone-700"}`}>
                            {b.to_user === user?.id ? "You" : b.to_user_name}
                          </span>
                          <span className="ml-auto font-bold text-stone-900">${parseFloat(String(b.amount)).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Expense Form */}
      {showForm && (
        <div className="card mb-6 p-6 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-900">
              {editingExpense ? "Edit Expense" : "New Expense"}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingExpense(null); }} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100">
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label">What was this for?</label>
              <input className="input-field" placeholder="e.g. Netflix, Costco run, July Rent"
                value={form.desc} onChange={e => setFormField("desc", e.target.value)} autoFocus />
            </div>

            <div>
              <label className="form-label">Total Amount ($)</label>
              <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00"
                value={form.amount} onChange={e => setFormField("amount", e.target.value)} />
            </div>

            <div>
              <label className="form-label">Date</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setFormField("date", e.target.value)} />
            </div>

            <div>
              <label className="form-label">Category</label>
              <CategoryCombo value={form.category} onChange={v => setFormField("category", v)} presets={PRESET_CATEGORIES} />
            </div>

            <div>
              <label className="form-label">Paid by</label>
              <select className="input-field" value={form.payer} onChange={e => setFormField("payer", Number(e.target.value))}>
                {members.map(m => <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Note <span className="text-stone-400">(optional)</span></label>
              <input className="input-field" placeholder="Extra context..."
                value={form.note} onChange={e => setFormField("note", e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Split Method</label>
              <div className="flex flex-wrap gap-2">
                {(["equal", "custom", "percentage"] as SplitMethod[]).map(m => (
                  <button key={m} type="button" onClick={() => setFormField("splitMethod", m)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                      form.splitMethod === m ? "bg-brand-600 text-white border-brand-600" : "border-stone-200 text-stone-600 hover:border-brand-300"
                    }`}>
                    {{ equal: "Equal", custom: "Custom ($)", percentage: "Percentage (%)" }[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Split with</label>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <button key={m.user.id} type="button"
                    onClick={() => setFormField("selectedMembers",
                      form.selectedMembers.includes(m.user.id)
                        ? form.selectedMembers.filter(id => id !== m.user.id)
                        : [...form.selectedMembers, m.user.id])}
                    className={`rounded-lg px-3 py-1.5 text-sm border transition-colors flex items-center gap-1 ${
                      form.selectedMembers.includes(m.user.id)
                        ? "bg-brand-600 text-white border-brand-600"
                        : "border-stone-200 text-stone-500"
                    }`}>
                    {m.user.display_name}
                    {form.selectedMembers.includes(m.user.id) && <Check size={11} />}
                  </button>
                ))}
              </div>
            </div>

            {form.splitMethod !== "equal" && form.selectedMembers.length > 0 && (
              <div className="sm:col-span-2 space-y-2">
                {form.splits.map(s => {
                  const m = members.find(mb => mb.user.id === s.userId);
                  const preview = splitPreview[s.userId];
                  return (
                    <div key={s.userId} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2">
                      <span className="min-w-[100px] text-sm font-medium text-stone-700">{m?.user.display_name}</span>
                      <input className="w-24 rounded-lg border border-stone-200 px-2 py-1 text-sm" type="number"
                        step="0.01" min="0" value={s.value}
                        placeholder={form.splitMethod === "percentage" ? "%" : "$"}
                        onChange={e => setForm(f => ({ ...f, splits: f.splits.map(sp => sp.userId === s.userId ? { ...sp, value: e.target.value } : sp) }))} />
                      <span className="ml-auto text-sm font-semibold text-stone-800">${(preview || 0).toFixed(2)}</span>
                    </div>
                  );
                })}
                {form.splitMethod === "percentage" && (
                  <p className={`text-xs ${Math.abs(pctTotal - 100) < 0.5 ? "text-green-600" : "text-amber-600"}`}>
                    Total: {pctTotal.toFixed(1)}% {Math.abs(pctTotal - 100) < 0.5 ? "✓" : "(must equal 100%)"}
                  </p>
                )}
                {form.splitMethod === "custom" && (
                  <p className={`text-xs ${Math.abs(customTotal - totalAmount) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                    Total: ${customTotal.toFixed(2)} / ${totalAmount.toFixed(2)} {Math.abs(customTotal - totalAmount) < 0.01 ? "✓" : "— adjust to match"}
                  </p>
                )}
              </div>
            )}

            {form.splitMethod === "equal" && totalAmount > 0 && form.selectedMembers.length > 0 && (
              <div className="sm:col-span-2 rounded-xl bg-stone-50 px-4 py-3">
                <p className="text-sm text-stone-500">
                  ${(totalAmount / form.selectedMembers.length).toFixed(2)} each among {form.selectedMembers.length} people
                </p>
              </div>
            )}
          </div>

          {form.error && <p className="mt-3 text-sm text-red-500">{form.error}</p>}

          <button className="btn-primary mt-5" onClick={handleSubmit}
            disabled={submitting || !form.desc.trim() || !form.amount || !form.selectedMembers.length}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : (editingExpense ? <Pencil size={16} /> : <Plus size={16} />)}
            {editingExpense ? "Save Changes" : "Add Expense"}
          </button>
        </div>
      )}

      {/* Filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 p-3">
        <div className="flex items-center gap-1.5 text-stone-500 mr-2">
          <Filter size={14} />
          <span className="text-xs font-semibold tracking-wide uppercase">Filters</span>
        </div>
        
        <CategoryCombo
          value={filterCategory}
          onChange={v => { setFilterCategory(v); setPage(1); }}
          presets={PRESET_CATEGORIES}
        />
        
        <select
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
        >
          <option value="">Any member</option>
          {members.map(m => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.display_name} {m.user.id === user?.id ? "(You)" : ""}
            </option>
          ))}
        </select>
        
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none w-32 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
          />
          <span className="text-stone-400 text-sm">to</span>
          <input
            type="date"
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none w-32 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
          />
        </div>

        {(filterCategory || filterUser || filterDateFrom || filterDateTo) && (
          <button 
            onClick={() => { setFilterCategory(""); setFilterUser(""); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }} 
            className="rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition-colors ml-auto"
          >
            <X size={12} className="inline mr-0.5" /> Clear All
          </button>
        )}
      </div>

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <div className="card p-12 text-center">
          <DollarSign size={40} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-500">No expenses found. Add your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map(e => {
            const expanded = expandedId === e.id;
            const mySplit = e.splits.find(s => s.user === user?.id);
            const canEdit = e.payer === user?.id || e.created_by === user?.id;

            return (
              <div key={e.id} className="card overflow-hidden">
                <div className="flex cursor-pointer items-start gap-4 p-5"
                  onClick={() => setExpandedId(expanded ? null : e.id)}>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <DollarSign size={18} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900">{e.description}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" · "}{e.display_category || e.category}
                          {" · "}Paid by{" "}
                          {e.payer === user?.id ? (
                            <span className="font-semibold text-brand-600 bg-brand-50 rounded px-1">You</span>
                          ) : (
                            <span className="text-stone-600 font-medium">{e.payer_name}</span>
                          )}
                        </p>
                        {e.note && <p className="mt-0.5 text-xs text-stone-400 italic">"{e.note}"</p>}
                        {e.last_edited_by_name && e.edit_history?.length > 0 && (
                          <div className="mt-1">
                            {e.edit_history.slice(0, 1).map(h => {
                              const fieldLabels: Record<string, string> = {
                                description: "Title", amount: "Amount",
                                note: "Note", category: "Category",
                                custom_category: "Category", date: "Date",
                              };
                              const diffs = Object.entries(h.changes).filter(([k]) => fieldLabels[k]);
                              return (
                                <div key={h.id} className="flex items-start gap-1.5">
                                  <p className="text-xs text-stone-300">
                                    Edited by {h.edited_by_name} · {new Date(h.edited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    {diffs.slice(0, 2).map(([field, { old: oldVal, new: newVal }]) => (
                                      <span key={field}> · {fieldLabels[field]}: <span className="line-through">{oldVal || "—"}</span>→<span className="text-green-600">{newVal || "—"}</span></span>
                                    ))}
                                  </p>
                                  {e.edit_history.length > 0 && (
                                    <button
                                      onClick={ev => { ev.stopPropagation(); setEditHistoryTarget({ id: e.id, desc: e.description, history: e.edit_history }); }}
                                      className="text-[10px] text-brand-500 hover:underline flex-shrink-0"
                                    >
                                      {e.edit_history.length > 1 ? `+${e.edit_history.length - 1} more` : "History"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-lg font-bold text-stone-900">${parseFloat(e.amount).toFixed(2)}</p>
                          {mySplit && (
                            <p className={`text-xs ${mySplit.is_confirmed ? "text-green-600" : mySplit.is_paid ? "text-amber-500" : "text-red-500"}`}>
                              you: ${parseFloat(String(mySplit.amount)).toFixed(2)}{" "}
                              {mySplit.is_confirmed ? "✓" : mySplit.is_paid ? "awaiting confirm" : "unpaid"}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <button onClick={ev => openEdit(e, ev)}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-brand-50 hover:text-brand-600">
                            <Pencil size={13} />
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={ev => { ev.stopPropagation(); setDeleteTarget(e.id); }}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500">
                            <X size={13} />
                          </button>
                        )}
                        {expanded ? <ChevronUp size={15} className="text-stone-400" /> : <ChevronDown size={15} className="text-stone-400" />}
                      </div>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-stone-100 px-5 pb-5 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Split ({e.split_method}) — {e.splits.length} people
                    </p>
                    <div className="space-y-2">
                      {e.splits.map(s => {
                        const isPayer = e.payer === user?.id;
                        const isPayerOwnSplit = s.user === e.payer;
                        const isMyRow = s.user === user?.id;
                        const awaitingConfirm = s.is_paid && !s.is_confirmed && !isPayerOwnSplit;
                        return (
                          <div key={s.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                            isPayerOwnSplit ? "bg-brand-50/60" : "bg-stone-50"
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${
                                isPayerOwnSplit ? "bg-brand-400" :
                                s.is_confirmed ? "bg-green-400" :
                                s.is_paid ? "bg-amber-400" : "bg-red-400"
                              }`} />
                              <span className={`text-sm font-medium ${
                                isMyRow ? "text-stone-900" : "text-stone-600"
                              }`}>
                                {isMyRow ? "You" : s.user_name}
                                {isPayerOwnSplit && <span className="ml-1 text-[10px] text-brand-500">(paid)</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-stone-800">${parseFloat(String(s.amount)).toFixed(2)}</p>
                                {s.percentage && <p className="text-xs text-stone-400">{s.percentage}%</p>}
                              </div>
                              {/* ── Status chip / action ── */}
                              {isPayerOwnSplit ? (
                                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">Your expense ✓</span>
                              ) : s.is_confirmed ? (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Settled ✓</span>
                              ) : awaitingConfirm ? (
                                <>
                                  {/* Shown to the payer — they need to confirm receipt */}
                                  {isPayer ? (
                                    <button
                                      onClick={() => setConfirmTarget({ eid: e.id, sid: s.id, name: s.user_name })}
                                      className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                                    >
                                      <Check size={10} /> Confirm receipt
                                    </button>
                                  ) : isMyRow ? (
                                    /* Shown to the person who said they paid — waiting */
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
                                      ⏳ Waiting for {e.payer_name}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Recorded</span>
                                  )}
                                </>
                              ) : isMyRow && !s.is_paid ? (
                                /* I owe money — show clear CTA */
                                <button
                                  onClick={() => setMarkPaidTarget({
                                    eid: e.id, sid: s.id,
                                    requiresConfirm: !!members.find(m => m.user.id === e.payer)?.require_payment_confirmation,
                                  })}
                                  className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                                >
                                  💸 I've paid • ${parseFloat(String(s.amount)).toFixed(2)}
                                </button>
                              ) : !isMyRow && !s.is_paid ? (
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-400">Unpaid</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-stone-400">
                      <span>Added by {e.created_by_name}</span>
                      <span>
                        Settled: ${e.splits.filter(s => s.is_confirmed).reduce((sum, s) => sum + parseFloat(String(s.amount)), 0).toFixed(2)}
                        {" · "}Pending: ${e.splits.filter(s => !s.is_confirmed).reduce((sum, s) => sum + parseFloat(String(s.amount)), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                className="btn-secondary"
                onClick={() => fetchData(page + 1, true)}
              >
                Load more <span className="text-stone-400 text-xs">({expenses.length} of {totalCount})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        description={
          <span>
            Are you sure you want to delete this expense?{" "}
            <strong>All split data will be removed.</strong> This cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        confirmClass="btn-danger"
      />

      {/* Mark Paid Confirmation Modal */}
      <ConfirmModal
        isOpen={markPaidTarget !== null}
        onClose={() => setMarkPaidTarget(null)}
        onConfirm={handleMarkPaid}
        title="Mark as Paid"
        description={
          markPaidTarget?.requiresConfirm
            ? "This will mark your share as paid. The payer will need to confirm receipt before it's fully settled."
            : "Confirm that you've paid your share of this expense. This will mark it as settled."
        }
        confirmLabel="Yes, mark paid"
        confirmClass="btn-primary"
      />

      {/* Payer Confirm Modal */}
      <ConfirmModal
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        title="Confirm Payment Received"
        description={`Confirm that you received the payment from ${confirmTarget?.name}? This will mark their share as fully settled.`}
        confirmLabel="Confirm received"
        confirmClass="btn-primary"
      />

      {/* Edit History Modal */}
      <Modal
        isOpen={editHistoryTarget !== null}
        onClose={() => setEditHistoryTarget(null)}
        title={`Edit History · ${editHistoryTarget?.desc}`}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {editHistoryTarget?.history.length === 0 && (
            <p className="text-center text-sm text-stone-400 py-6">No edit history available.</p>
          )}
          {editHistoryTarget?.history.map((h, idx) => {
            const fieldLabels: Record<string, string> = {
              description: "Title", amount: "Amount",
              note: "Note", category: "Category",
              custom_category: "Category", date: "Date",
            };
            const diffs = Object.entries(h.changes).filter(([k]) => fieldLabels[k]);
            return (
              <div key={h.id} className={`rounded-xl border border-stone-100 p-3 ${idx === 0 ? "bg-brand-50/30" : "bg-stone-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-stone-700">{h.edited_by_name}</span>
                  <span className="text-xs text-stone-400">
                    {new Date(h.edited_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" at "}
                    {new Date(h.edited_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                {diffs.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">Minor edit (no trackable field changes)</p>
                ) : (
                  <div className="space-y-1">
                    {diffs.map(([field, { old: oldVal, new: newVal }]) => (
                      <div key={field} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-stone-500 w-14 flex-shrink-0">{fieldLabels[field]}</span>
                        <span className="line-through text-red-400">{oldVal || "—"}</span>
                        <span className="text-stone-400">→</span>
                        <span className="text-green-600 font-medium">{newVal || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
