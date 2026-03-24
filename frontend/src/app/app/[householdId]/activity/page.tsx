"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { expenseApi } from "@/lib/api";
import type { ActivityExpenseItem, ActivityChoreItem } from "@/types";
import {
  DollarSign,
  CheckSquare,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  BookOpen,
} from "lucide-react";

// ── Ledger helpers ──────────────────────────────────────────────────────────

interface LedgerEntry {
  userId: number;
  name: string;
  /** positive = they owe you, negative = you owe them */
  netAmount: number;
  totalLent: number; // you paid, they owed
  totalBorrowed: number; // they paid, you owed
  totalSettled: number;
  transactions: ActivityExpenseItem[];
}

function buildLedger(expenses: ActivityExpenseItem[], myId: number): LedgerEntry[] {
  const map: Record<number, LedgerEntry> = {};

  for (const e of expenses) {
    for (const p of e.participants) {
      // Skip my own entry
      if (p.user_id === myId) continue;

      if (!map[p.user_id]) {
        map[p.user_id] = {
          userId: p.user_id,
          name: p.name,
          netAmount: 0,
          totalLent: 0,
          totalBorrowed: 0,
          totalSettled: 0,
          transactions: [],
        };
      }
      const entry = map[p.user_id];

      if (e.is_payer) {
        // I paid — this person owes me their share
        const amt = parseFloat(p.amount);
        entry.totalLent += amt;
        if (p.is_confirmed) entry.totalSettled += amt;
        else entry.netAmount += amt;
        if (!entry.transactions.includes(e)) entry.transactions.push(e);
      } else if (e.participants.some(pp => pp.user_id === p.user_id) && !e.is_payer) {
        // They paid — I owe them
        const myShare = parseFloat(e.my_share);
        entry.totalBorrowed += myShare;
        if (e.my_share_confirmed) entry.totalSettled += myShare;
        else entry.netAmount -= myShare;
        if (!entry.transactions.includes(e)) entry.transactions.push(e);
      }
    }
  }

  return Object.values(map).sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount));
}

export default function MyActivityPage() {
  const { user } = useAuth();
  const { householdId } = useParams();
  const router = useRouter();
  const hid = Number(householdId);

  const [expenses, setExpenses] = useState<ActivityExpenseItem[]>([]);
  const [chores, setChores] = useState<ActivityChoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"expenses" | "chores" | "ledger">("expenses");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await expenseApi.getActivity(hid);
      setExpenses(res.data.expenses || []);
      setChores(res.data.chores || []);
    } catch {}
    setLoading(false);
  }, [hid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ledger = useMemo(
    () => buildLedger(expenses, user?.id || 0),
    [expenses, user?.id]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  const toggleExpand = (key: string) =>
    setExpandedId((prev) => (prev === key ? null : key));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <Activity size={22} className="text-brand-600" /> My Activity
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          Full history of your expenses, chores, and a ledger of balances with each member.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-4 border-b border-stone-100">
        {(["expenses", "chores", "ledger"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-0.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            {tab === "expenses" ? `Expenses (${expenses.length})` : tab === "chores" ? `Chores (${chores.length})` : `Ledger`}
          </button>
        ))}
      </div>

      {/* ── EXPENSES ─────────────────────────────── */}
      {activeTab === "expenses" && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="card p-12 text-center">
              <DollarSign size={40} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-400">No expense activity yet.</p>
            </div>
          ) : (
            expenses.map((e) => {
              const key = `exp-${e.id}`;
              const expanded = expandedId === key;
              const others = e.participants.filter((p) => p.user_id !== user?.id);
              return (
                <div
                  key={e.id}
                  className="card overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-start justify-between p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${
                          e.is_payer ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {e.is_payer ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900 text-sm">{e.description}</p>
                        <p className="mt-0.5 text-xs text-stone-400">
                          {e.display_category} ·{" "}
                          {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {e.is_payer ? (
                            <>
                              You paid <span className="font-semibold text-stone-700">${e.total_amount}</span>
                              {others.length > 0 && (
                                <> · Lent to {others.map((p) => `${p.name} ($${p.amount}${p.is_paid ? " paid" : " pending"})`).join(", ")}</>
                              )}
                            </>
                          ) : (
                            <>
                              Paid by <span className="font-medium">{e.payer_name}</span>
                              {" · "}Your share: <span className="font-semibold text-stone-700">${e.my_share}</span>{" "}
                              {e.my_share_paid ? (
                                <span className="text-green-600">{e.my_share_confirmed ? "✓ Settled" : "✓ Paid"}</span>
                              ) : (
                                <span className="text-amber-600">⏳ Pending</span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <span className={`text-sm font-bold ${e.is_payer ? "text-green-700" : "text-amber-700"}`}>
                        {e.is_payer ? "+" : "-"}${e.is_payer ? e.total_amount : e.my_share}
                      </span>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); router.push(`/app/${hid}/expenses`); }}
                        className="rounded-lg p-1.5 text-stone-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Open in Expenses"
                      >
                        <ArrowUpRight size={14} />
                      </button>
                      {expanded ? <ChevronUp size={14} className="text-stone-300" /> : <ChevronDown size={14} className="text-stone-300" />}
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-stone-100 px-5 pb-5 pt-3 space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                          Split ({e.split_method})
                        </p>
                        <div className="space-y-1.5">
                          {e.participants.map((p) => (
                            <div key={p.user_id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
                              <span className={`text-sm ${p.user_id === user?.id ? "font-semibold text-stone-900" : "text-stone-600"}`}>
                                {p.user_id === user?.id ? "You" : p.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-stone-700">${p.amount}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  p.is_confirmed ? "bg-green-100 text-green-700" : p.is_paid ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
                                }`}>
                                  {p.is_confirmed ? "Settled" : p.is_paid ? "Paid" : "Pending"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {e.note && <p className="text-xs text-stone-400 italic">"{e.note}"</p>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── CHORES ───────────────────────────────── */}
      {activeTab === "chores" && (
        <div className="space-y-3">
          {chores.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckSquare size={40} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-400">No chore history yet.</p>
            </div>
          ) : (
            chores.map((c) => {
              const key = `chore-${c.id}`;
              const isOverdue = !c.is_done && c.date < new Date().toISOString().split("T")[0];
              return (
                <div
                  key={c.id}
                  className={`card cursor-pointer p-5 hover:shadow-sm transition-shadow ${isOverdue ? "border-red-200 bg-red-50/20" : ""}`}
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${
                          c.is_done ? "bg-green-50 text-green-600" : isOverdue ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {c.is_done ? <Check size={17} /> : <Clock size={17} />}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900 text-sm">{c.title}</p>
                        <p className="mt-0.5 text-xs text-stone-400 flex items-center gap-1.5">
                          {c.is_rotation && (
                            <span className="flex items-center gap-0.5"><RotateCcw size={10} /> Rotation · </span>
                          )}
                          <Clock size={10} />{" "}
                          {isOverdue ? "Overdue: " : c.is_done ? "Done: " : "Due: "}
                          {new Date(c.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {c.done_at && ` · Completed ${new Date(c.done_at).toLocaleDateString()}`}
                        </p>
                        {c.note && <p className="mt-1 text-xs italic text-stone-400">"{c.note}"</p>}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.is_done ? "bg-green-100 text-green-700" : isOverdue ? "bg-red-100 text-red-600" : "bg-stone-100 text-stone-500"
                    }`}>
                      {c.is_done ? "Done" : isOverdue ? "Overdue" : "Upcoming"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── LEDGER ───────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          {ledger.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen size={40} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-400">No transactions with other members yet.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-stone-400">Showing all-time transactions between you and each household member.</p>
              {ledger.map((entry) => {
                const key = `ledger-${entry.userId}`;
                const expanded = expandedId === key;
                const net = entry.netAmount;
                const youOwe = net < 0;
                const settled = Math.abs(net) < 0.01;
                return (
                  <div key={entry.userId} className="card overflow-hidden">
                    <div
                      className="flex items-center justify-between p-5 cursor-pointer hover:bg-stone-50/50"
                      onClick={() => toggleExpand(key)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                          settled ? "bg-stone-400" : youOwe ? "bg-amber-500" : "bg-green-600"
                        }`}>
                          {entry.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900 text-sm">{entry.name}</p>
                          <p className="text-xs text-stone-400">
                            {entry.transactions.length} shared expense{entry.transactions.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {settled ? (
                            <p className="text-sm font-semibold text-stone-400">All settled ✓</p>
                          ) : (
                            <>
                              <p className={`text-base font-bold ${youOwe ? "text-amber-600" : "text-green-600"}`}>
                                ${Math.abs(net).toFixed(2)}
                              </p>
                              <p className={`text-xs ${youOwe ? "text-amber-500" : "text-green-500"}`}>
                                {youOwe ? "you owe" : "they owe you"}
                              </p>
                            </>
                          )}
                        </div>
                        {expanded ? <ChevronUp size={15} className="text-stone-300" /> : <ChevronDown size={15} className="text-stone-300" />}
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-stone-100 px-5 pb-5 pt-3">
                        <div className="mb-3 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-stone-50 p-3 text-center">
                            <p className="text-xs text-stone-400">You lent</p>
                            <p className="text-sm font-bold text-stone-700">${entry.totalLent.toFixed(2)}</p>
                          </div>
                          <div className="rounded-xl bg-stone-50 p-3 text-center">
                            <p className="text-xs text-stone-400">You borrowed</p>
                            <p className="text-sm font-bold text-stone-700">${entry.totalBorrowed.toFixed(2)}</p>
                          </div>
                          <div className="rounded-xl bg-green-50 p-3 text-center">
                            <p className="text-xs text-stone-400">Settled</p>
                            <p className="text-sm font-bold text-green-700">${entry.totalSettled.toFixed(2)}</p>
                          </div>
                        </div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Shared Expenses</p>
                        <div className="space-y-1.5">
                          {entry.transactions.map((t) => {
                            const myParticipant = t.participants.find(p => p.user_id === user?.id);
                            const theirParticipant = t.participants.find(p => p.user_id === entry.userId);
                            return (
                              <div key={t.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
                                <div>
                                  <p className="text-xs font-medium text-stone-700">{t.description}</p>
                                  <p className="text-[10px] text-stone-400">
                                    {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    {" · "}{t.is_payer ? "You paid" : `${t.payer_name} paid`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-semibold text-stone-700">
                                    {t.is_payer
                                      ? `+$${theirParticipant?.amount || "0"}`
                                      : `-$${myParticipant?.amount || t.my_share}`}
                                  </p>
                                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                                    (t.is_payer ? theirParticipant?.is_confirmed : t.my_share_confirmed)
                                      ? "bg-green-100 text-green-600"
                                      : "bg-amber-100 text-amber-600"
                                  }`}>
                                    {(t.is_payer ? theirParticipant?.is_confirmed : t.my_share_confirmed) ? "settled" : "pending"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </>
  );
}
