"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { householdApi } from "@/lib/api";
import type { Household } from "@/types";
import {
  Plus,
  LogIn,
  Loader2,
  Lock,
  DollarSign,
  CheckSquare,
  Users,
  MessageCircle,
  Home,
  ArrowRight,
} from "lucide-react";

const LOCKED_FEATURES = [
  {
    icon: DollarSign,
    title: "Expense Splitting",
    body: "Log shared bills, split equally or custom. Running balances always visible.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: CheckSquare,
    title: "Chore Scheduling",
    body: "Assign chores, rotate fairly, mark done — no more forgetting who does what.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Users,
    title: "Household Members",
    body: "Invite roommates, manage roles, see everyone's contribution.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: MessageCircle,
    title: "Group Chat",
    body: "Quick in-app messaging for your household — no external apps needed.",
    color: "bg-green-50 text-green-600",
  },
];

export default function AppPage() {
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
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user) {
      householdApi
        .list()
        .then((res) => {
          const data: Household[] = res.data;
          setHouseholds(data);
          // Auto-redirect if member of at least one household
          if (data.length > 0) {
            router.replace(`/app/${data[0].id}/dashboard`);
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user, loading, router]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await householdApi.create({ name: name.trim() });
      router.push(`/app/${res.data.id}/dashboard`);
    } catch {
      setError("Failed to create household.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await householdApi.join(code.trim());
      router.push(`/app/${res.data.id}/dashboard`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { code?: string[] } } })?.response?.data
          ?.code?.[0] || "Invalid or expired invite code.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  // If households exist, we're redirecting — show nothing
  if (households.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  // No household — show locked dashboard preview
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-stone-100 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home size={18} className="text-brand-600" />
          <span className="font-display font-bold text-stone-900">Dues & Do's</span>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
          {user?.display_name}
        </span>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-900">
            {greeting}, {user?.display_name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-stone-400 text-sm">
            You're not part of a household yet. Create or join one to access all features.
          </p>
        </div>

        {/* Create / Join cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
            className="card flex items-center gap-4 p-5 text-left transition-all hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 flex-shrink-0">
              <Plus size={22} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Create Household</p>
              <p className="text-sm text-stone-400">Start a new group</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-stone-300" />
          </button>

          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
            className="card flex items-center gap-4 p-5 text-left transition-all hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
              <LogIn size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Join Household</p>
              <p className="text-sm text-stone-400">Use an invite code</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-stone-300" />
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card mb-6 p-6 animate-fade-up">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">Name your household</h2>
            <input
              className="input-field mb-4"
              placeholder="e.g. Apartment 4B, The Crew, Casa del Sol"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            {error && <p className="error-text mb-3">{error}</p>}
            <button className="btn-primary w-full" onClick={handleCreate} disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Household
            </button>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="card mb-6 p-6 animate-fade-up">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">Enter invite code</h2>
            <input
              className="input-field mb-4 uppercase tracking-widest text-center text-lg"
              placeholder="ABCD1234"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            />
            {error && <p className="error-text mb-3">{error}</p>}
            <button className="btn-primary w-full" onClick={handleJoin} disabled={submitting || !code.trim()}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              Join Household
            </button>
          </div>
        )}

        {/* Locked feature preview */}
        <div className="mt-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
            <Lock size={11} /> Features unlocked after joining
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {LOCKED_FEATURES.map((f) => (
              <div key={f.title} className="card relative overflow-hidden p-5 opacity-55 select-none">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Lock size={28} className="text-stone-200" />
                </div>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${f.color}`}>
                    <f.icon size={17} />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">{f.title}</p>
                    <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">{f.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
