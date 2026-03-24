"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { householdApi } from "@/lib/api";
import type { Household } from "@/types";
import {
  Home,
  Plus,
  LogIn,
  ArrowRight,
  Loader2,
  Lock,
  DollarSign,
  CheckSquare,
  Users,
  MessageCircle,
} from "lucide-react";

const LOCKED_FEATURES = [
  { icon: DollarSign, title: "Expense Splitting", color: "bg-blue-50 text-blue-600" },
  { icon: CheckSquare, title: "Chore Scheduling", color: "bg-amber-50 text-amber-600" },
  { icon: Users, title: "Household Members", color: "bg-purple-50 text-purple-600" },
  { icon: MessageCircle, title: "Group Chat", color: "bg-green-50 text-green-600" },
];

export default function HouseholdsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) { router.replace("/login"); return; }
    if (user) {
      householdApi.list()
        .then((res) => setHouseholds(res.data))
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user, loading, router]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true); setError("");
    try {
      const res = await householdApi.create({ name: name.trim() });
      router.push(`/app/${res.data.id}/dashboard`);
    } catch { setError("Failed to create household."); }
    finally { setSubmitting(false); }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setSubmitting(true); setError("");
    try {
      const res = await householdApi.join(code.trim());
      router.push(`/app/${res.data.id}/dashboard`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { code?: string[] } } })?.response?.data?.code?.[0] || "Invalid or expired invite code.";
      setError(msg);
    } finally { setSubmitting(false); }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-100 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home size={18} className="text-brand-600" />
          <span className="font-display font-bold text-stone-900">Dues & Do's</span>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
          {user?.display_name}
        </span>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-900">Your Households</h1>
          <p className="mt-1 text-sm text-stone-400">Select a household or create / join a new one.</p>
        </div>

        {/* Existing households */}
        {households.length > 0 && (
          <div className="mb-6 space-y-2">
            {households.map((h) => (
              <button
                key={h.id}
                onClick={() => router.push(`/app/${h.id}/dashboard`)}
                className="card flex w-full items-center gap-4 p-4 text-left hover:shadow-md hover:border-brand-200 transition-all"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100">
                  <Home size={20} className="text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{h.name}</p>
                  <p className="text-xs text-stone-400">
                    {h.member_count} member{h.member_count !== 1 ? "s" : ""} · {h.my_role === "admin" ? "Admin" : "Member"}
                  </p>
                </div>
                <ArrowRight size={16} className="text-stone-300" />
              </button>
            ))}
          </div>
        )}

        {/* Create / Join cards */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
            className="card flex items-center gap-4 p-4 text-left hover:shadow-md hover:border-brand-200 transition-all hover:-translate-y-0.5"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <Plus size={20} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Create Household</p>
              <p className="text-xs text-stone-400">Start a new group</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-stone-300" />
          </button>

          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
            className="card flex items-center gap-4 p-4 text-left hover:shadow-md hover:border-blue-200 transition-all hover:-translate-y-0.5"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <LogIn size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Join Household</p>
              <p className="text-xs text-stone-400">Use an invite code</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-stone-300" />
          </button>
        </div>

        {showCreate && (
          <div className="card mb-5 p-5 animate-fade-up">
            <h2 className="mb-3 text-base font-semibold text-stone-900">Name your household</h2>
            <input
              className="input-field mb-3"
              placeholder="e.g. Apartment 4B, The Crew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            {error && <p className="error-text mb-2">{error}</p>}
            <button className="btn-primary w-full" onClick={handleCreate} disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Create Household
            </button>
          </div>
        )}

        {showJoin && (
          <div className="card mb-5 p-5 animate-fade-up">
            <h2 className="mb-3 text-base font-semibold text-stone-900">Enter invite code</h2>
            <input
              className="input-field mb-3 uppercase tracking-widest text-center text-lg"
              placeholder="ABCD1234"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            />
            {error && <p className="error-text mb-2">{error}</p>}
            <button className="btn-primary w-full" onClick={handleJoin} disabled={submitting || !code.trim()}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
              Join Household
            </button>
          </div>
        )}

        {/* Locked feature preview for new users */}
        {households.length === 0 && (
          <div className="mt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
              <Lock size={11} /> Features unlocked after joining
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LOCKED_FEATURES.map((f) => (
                <div key={f.title} className="card relative overflow-hidden p-4 opacity-50 select-none">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${f.color}`}>
                      <f.icon size={16} />
                    </div>
                    <p className="font-medium text-stone-700 text-sm">{f.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
