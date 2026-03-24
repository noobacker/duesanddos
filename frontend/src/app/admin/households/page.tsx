"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";
import type { Household } from "@/types";
import { Search, Loader2, Home, Users, DollarSign, CheckSquare } from "lucide-react";

interface HouseholdDetail {
  id: number;
  name: string;
  created_at: string;
  members: { id: number; email: string; display_name: string; role: string; status: string }[];
  insights: {
    total_expenses: number;
    total_amount: number;
    unpaid_splits: number;
    total_chores: number;
    overdue_chores: number;
    total_messages: number;
    last_activity: string | null;
  };
}

export default function AdminHouseholdsPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<HouseholdDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHouseholds = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await adminApi.listHouseholds(params);
      setHouseholds(res.data);
    } catch {}
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchHouseholds, 300);
    return () => clearTimeout(timer);
  }, [fetchHouseholds]);

  const viewDetail = async (hid: number) => {
    setDetailLoading(true);
    try {
      const res = await adminApi.getHousehold(hid);
      setSelected(res.data);
    } catch {}
    setDetailLoading(false);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Household Explorer</h1>
        <p className="text-sm text-slate-400">Browse and inspect all households</p>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
            placeholder="Search households..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Household List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
            </div>
          ) : households.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No households found.</p>
          ) : (
            households.map((h) => (
              <button
                key={h.id}
                onClick={() => viewDetail(h.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                  selected?.id === h.id
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
                    <Home size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{h.name}</p>
                    <p className="text-xs text-slate-500">
                      {h.member_count} members · Created {new Date(h.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 h-fit">
            {detailLoading ? (
              <Loader2 size={24} className="animate-spin text-emerald-400 mx-auto" />
            ) : (
              <>
                <h2 className="text-lg font-bold text-white mb-4">{selected.name}</h2>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="rounded-xl bg-slate-800 p-3 text-center">
                    <DollarSign size={16} className="mx-auto mb-1 text-amber-400" />
                    <p className="text-lg font-bold text-white">{selected.insights.total_expenses}</p>
                    <p className="text-xs text-slate-500">Expenses</p>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-3 text-center">
                    <CheckSquare size={16} className="mx-auto mb-1 text-blue-400" />
                    <p className="text-lg font-bold text-white">{selected.insights.total_chores}</p>
                    <p className="text-xs text-slate-500">Chores</p>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-3 text-center">
                    <Users size={16} className="mx-auto mb-1 text-emerald-400" />
                    <p className="text-lg font-bold text-white">{selected.members.length}</p>
                    <p className="text-xs text-slate-500">Members</p>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Members</h3>
                <div className="space-y-2">
                  {selected.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-white">{m.display_name}</p>
                        <p className="text-xs text-slate-500">{m.email}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        m.role === "admin"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-500">
                    Total spend: <span className="text-white font-medium">${selected.insights.total_amount?.toLocaleString() || "0"}</span>
                    {" · "}
                    Unpaid: <span className="text-amber-400">{selected.insights.unpaid_splits}</span>
                    {" · "}
                    Overdue chores: <span className="text-red-400">{selected.insights.overdue_chores}</span>
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
