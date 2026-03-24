"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { expenseApi, choreApi, activityApi } from "@/lib/api";
import type { Balance, Chore, ActivityLog } from "@/types";
import {
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const { householdId } = useParams();
  const hid = Number(householdId);

  const [balances, setBalances] = useState<Balance[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [settlingId, setSettlingId] = useState<number | null>(null);

  const fetchBalances = () => {
    if (!hid) return;
    expenseApi.getBalances(hid).then((r) => setBalances(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchBalances();
    if (!hid) return;
    choreApi.list(hid).then((r) => setChores(r.data)).catch(() => {});
    activityApi.list(hid).then((r) => setActivity(r.data)).catch(() => {});
  }, [hid]);

  const handleSettleUp = async (withUserId: number) => {
    setSettlingId(withUserId);
    try {
      await expenseApi.settleUp(hid, withUserId);
      fetchBalances();
    } catch {}
    setSettlingId(null);
  };

  if (!user) return null;

  const iOwe = balances.filter((b) => b.from_user === user.id);
  const owedToMe = balances.filter((b) => b.to_user === user.id);
  const myChores = chores.filter(
    (c) => c.assigned_to === user.id && c.status !== "done"
  );
  const overdueChores = chores.filter(
    (c) =>
      c.due_date &&
      new Date(c.due_date) < new Date() &&
      c.status !== "done"
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          {greeting}, {user.display_name.split(" ")[0]}
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <TrendingDown size={20} className="text-red-500" />
          </div>
          <p className="text-sm text-stone-500">You Owe</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            ${iOwe.reduce((s, b) => s + parseFloat(b.amount), 0).toFixed(2)}
          </p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <TrendingUp size={20} className="text-green-500" />
          </div>
          <p className="text-sm text-stone-500">Owed to You</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            ${owedToMe.reduce((s, b) => s + parseFloat(b.amount), 0).toFixed(2)}
          </p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <CheckSquare size={20} className="text-blue-500" />
          </div>
          <p className="text-sm text-stone-500">My Chores</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{myChores.length}</p>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Clock size={20} className="text-amber-500" />
          </div>
          <p className="text-sm text-stone-500">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{overdueChores.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Balances */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Settlement Summary</h2>
            <Link
              href={`/app/${hid}/expenses`}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              View expenses <ArrowRight size={12} />
            </Link>
          </div>
          {iOwe.length === 0 && owedToMe.length === 0 ? (
            <p className="text-sm text-stone-400">No outstanding balances — all settled!</p>
          ) : (
            <div className="space-y-3">
              {owedToMe.map((b, i) => (
                <div key={`owe-${i}`} className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
                  <div className="text-sm">
                    <span className="font-medium text-stone-700">{b.from_user_name}</span>
                    <span className="text-stone-400"> owes </span>
                    <span className="font-medium text-stone-700">you</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-700">+${parseFloat(b.amount).toFixed(2)}</span>
                    <button
                      onClick={() => handleSettleUp(b.from_user)}
                      disabled={settlingId === b.from_user}
                      className="rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                    >
                      {settlingId === b.from_user ? "..." : "Settle"}
                    </button>
                  </div>
                </div>
              ))}
              {iOwe.map((b, i) => (
                <div key={`iowe-${i}`} className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
                  <div className="text-sm">
                    <span className="font-medium text-stone-700">You</span>
                    <span className="text-stone-400"> owe </span>
                    <span className="font-medium text-stone-700">{b.to_user_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-red-600">-${parseFloat(b.amount).toFixed(2)}</span>
                    <button
                      onClick={() => handleSettleUp(b.to_user)}
                      disabled={settlingId === b.to_user}
                      className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                    >
                      {settlingId === b.to_user ? "..." : "Settle"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Chores */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Upcoming Chores</h2>
            <Link
              href={`/app/${hid}/chores`}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {myChores.length === 0 ? (
            <p className="text-sm text-stone-400">No chores assigned — you&apos;re all caught up!</p>
          ) : (
            <div className="space-y-3">
              {myChores.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3">
                  <div className={`h-2 w-2 rounded-full ${
                    c.due_date && new Date(c.due_date) < new Date()
                      ? "bg-red-500"
                      : "bg-brand-500"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-700 truncate">{c.title}</p>
                    {c.due_date && (
                      <p className="text-xs text-stone-400">
                        Due {new Date(c.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "todo"
                      ? "bg-stone-100 text-stone-600"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {c.status === "todo" ? "To Do" : "In Progress"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-6 card p-5">
        <h2 className="mb-4 font-semibold text-stone-900">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-stone-400">No activity yet. Start by adding an expense or chore!</p>
        ) : (
          <div className="space-y-3">
            {activity.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2">
                <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-700">{a.description}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
