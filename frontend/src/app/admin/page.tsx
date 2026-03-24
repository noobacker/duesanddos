"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import type { PlatformStats } from "@/types";
import {
  Users,
  Home,
  DollarSign,
  CheckSquare,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .overview()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-slate-400">Global metrics across all households</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.total_users}
          sub={`${stats.active_users} active · ${stats.new_users_7d} new (7d)`}
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={Home}
          label="Households"
          value={stats.total_households}
          sub={`${stats.new_households_7d} new (7d) · ${stats.new_households_30d} new (30d)`}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={DollarSign}
          label="Total Expenses"
          value={stats.total_expenses}
          sub={`$${parseFloat(stats.total_expense_amount).toLocaleString()} total`}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={CheckSquare}
          label="Total Chores"
          value={stats.total_chores}
          sub={`${stats.overdue_chores} overdue`}
          color="bg-purple-500/10 text-purple-400"
        />
        <StatCard
          icon={MessageCircle}
          label="Messages"
          value={stats.total_messages}
          color="bg-cyan-500/10 text-cyan-400"
        />
        <StatCard
          icon={TrendingUp}
          label="New Users (30d)"
          value={stats.new_users_30d}
          color="bg-green-500/10 text-green-400"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue Chores"
          value={stats.overdue_chores}
          color="bg-red-500/10 text-red-400"
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={stats.active_users}
          sub={`of ${stats.total_users} total`}
          color="bg-indigo-500/10 text-indigo-400"
        />
      </div>
    </>
  );
}
