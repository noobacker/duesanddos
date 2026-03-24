"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAnimations } from "@/hooks/useAnimations";
import { authApi, householdApi } from "@/lib/api";
import type { Household } from "@/types";
import {
  User as UserIcon,
  Home,
  Mail,
  AtSign,
  Lock,
  Check,
  Loader2,
  Shield,
  Edit2,
  Globe,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";

const TIMEZONES = [
  { label: "Eastern (New York)", value: "America/New_York" },
  { label: "Central (Chicago)", value: "America/Chicago" },
  { label: "Mountain (Denver)", value: "America/Denver" },
  { label: "Pacific (Los Angeles)", value: "America/Los_Angeles" },
  { label: "Alaska", value: "America/Anchorage" },
  { label: "Hawaii", value: "Pacific/Honolulu" },
  { label: "Atlantic (Halifax)", value: "America/Halifax" },
  { label: "London/UTC", value: "Europe/London" },
  { label: "Central Europe (Paris/Berlin)", value: "Europe/Paris" },
  { label: "Eastern Europe (Helsinki)", value: "Europe/Helsinki" },
  { label: "Moscow", value: "Europe/Moscow" },
  { label: "Dubai (UAE)", value: "Asia/Dubai" },
  { label: "India (Mumbai)", value: "Asia/Kolkata" },
  { label: "Bangladesh (Dhaka)", value: "Asia/Dhaka" },
  { label: "Southeast Asia (Bangkok)", value: "Asia/Bangkok" },
  { label: "China/Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Japan/Korea (JST)", value: "Asia/Tokyo" },
  { label: "Australia East (Sydney)", value: "Australia/Sydney" },
  { label: "Australia Central (Adelaide)", value: "Australia/Adelaide" },
  { label: "New Zealand (Auckland)", value: "Pacific/Auckland" },
  { label: "Brazil (São Paulo)", value: "America/Sao_Paulo" },
  { label: "Argentina (Buenos Aires)", value: "America/Argentina/Buenos_Aires" },
  { label: "Mexico City", value: "America/Mexico_City" },
  { label: "Canada East (Toronto)", value: "America/Toronto" },
  { label: "Canada West (Vancouver)", value: "America/Vancouver" },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { householdId } = useParams();
  const router = useRouter();
  const { enabled: animationsEnabled, toggle: toggleAnimations } = useAnimations();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [tzSearch, setTzSearch] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const [households, setHouseholds] = useState<Household[]>([]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setUsername(user.username || "");
      setTimezone(user.timezone || "America/New_York");
    }
    householdApi.list().then((r) => setHouseholds(r.data)).catch(() => {});
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg("");
    setSaveError("");
    try {
      await authApi.updateMe({ full_name: fullName, username, timezone });
      setSaveMsg("Profile updated successfully.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const msgs = Object.values(e?.response?.data || {}).flat();
      setSaveError(msgs.join(" ") || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPass || !newPass) return;
    setPassLoading(true);
    setPassMsg("");
    setPassError("");
    try {
      await authApi.updateMe({ old_password: oldPass, new_password: newPass } as Record<string, string>);
      setPassMsg("Password changed. Please log in again.");
      setOldPass("");
      setNewPass("");
      setTimeout(() => logout(), 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const msgs = Object.values(e?.response?.data || {}).flat();
      setPassError(msgs.join(" ") || "Failed to change password.");
    } finally {
      setPassLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">My Profile</h1>
        <p className="text-sm text-stone-400">Manage your account details</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">

        {/* LEFT COLUMN — Profile Info */}
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-4">
            <Avatar user={user} size="h-16 w-16 text-2xl" className="font-bold text-brand-700 bg-brand-100" />
            <div>
              <p className="text-lg font-semibold text-stone-900">{user.display_name}</p>
              <p className="text-sm text-stone-400">{user.email}</p>
              {user.is_platform_admin && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Shield size={10} /> Platform Admin
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center gap-1">
                <UserIcon size={12} /> Full Name
              </label>
              <input
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                <AtSign size={12} /> Username
              </label>
              <input
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
              />
              <p className="mt-1 text-xs text-stone-400">
                Letters, numbers, underscores, hyphens, and dots only. Min 3 chars.
              </p>
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                <Mail size={12} /> Email
              </label>
              <input
                className="input-field bg-stone-50 cursor-not-allowed"
                value={user.email}
                disabled
              />
              <p className="mt-1 text-xs text-stone-400">Email cannot be changed.</p>
            </div>

            {/* Timezone */}
            <div>
              <label className="form-label flex items-center gap-1">
                <Globe size={12} /> Timezone
              </label>
              <div className="relative">
                <input
                  className="input-field"
                  placeholder="Search timezone (city or region)..."
                  value={tzSearch !== undefined ? tzSearch : (TIMEZONES.find(t => t.value === timezone)?.label || timezone)}
                  onChange={e => setTzSearch(e.target.value)}
                  onFocus={() => setTzSearch("")}
                  onBlur={() => setTimeout(() => setTzSearch(undefined), 150)}
                />
                {tzSearch !== undefined && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-100 bg-white shadow-lg max-h-52 overflow-y-auto">
                    {TIMEZONES.filter(t =>
                      t.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
                      t.value.toLowerCase().includes(tzSearch.toLowerCase())
                    ).map(tz => (
                      <button
                        key={tz.value}
                        type="button"
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors ${timezone === tz.value ? "bg-brand-50 text-brand-700 font-medium" : "text-stone-700"}`}
                        onMouseDown={() => { setTimezone(tz.value); setTzSearch(undefined); }}
                      >
                        <span>{tz.label}</span>
                        <span className="text-xs text-stone-400">{tz.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-stone-400">Used for displaying chore due times and timestamps in your local timezone.</p>
            </div>

            {saveMsg && (
              <p className="flex items-center gap-1 text-sm text-green-600">
                <Check size={14} /> {saveMsg}
              </p>
            )}
            {saveError && <p className="error-text">{saveError}</p>}

            <button
              className="btn-primary"
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
              Save Changes
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Change Password */}
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900">
              <Lock size={16} /> Change Password
            </h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Current Password</label>
                <input
                  className="input-field"
                  type="password"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">New Password</label>
                <input
                  className="input-field"
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>
              {passMsg && <p className="text-sm text-green-600">{passMsg}</p>}
              {passError && <p className="error-text">{passError}</p>}
              <button
                className="btn-primary"
                onClick={handleChangePassword}
                disabled={passLoading || !oldPass || !newPass}
              >
                {passLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Change Password
              </button>
            </div>
          </div>

          {/* Household Memberships */}
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900">
              <Home size={16} /> My Households
            </h2>
            {households.length === 0 ? (
              <p className="text-sm text-stone-400">No households joined yet.</p>
            ) : (
              <div className="space-y-2">
                {households.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => router.push(`/app/${h.id}/dashboard`)}
                    className="flex w-full items-center justify-between rounded-xl bg-stone-50 px-4 py-3 hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                        <Home size={14} className="text-brand-600" />
                      </div>
                      <span className="text-sm font-medium text-stone-700">{h.name}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      h.my_role === "admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-stone-200 text-stone-600"
                    }`}>
                      {h.my_role === "admin" ? "Admin" : "Member"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900">
              <Sparkles size={16} /> Preferences
            </h2>
            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-700">Animations</p>
                <p className="text-xs text-stone-400">Enable smooth transitions and micro-animations throughout the app.</p>
              </div>
              <button
                role="switch"
                aria-checked={animationsEnabled}
                onClick={() => toggleAnimations(!animationsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  animationsEnabled ? "bg-brand-600" : "bg-stone-300"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  animationsEnabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
