"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Home,
  ScrollText,
  ArrowLeft,
  Shield,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const adminNav = [
  { icon: BarChart3, label: "Overview", href: "/admin" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: Home, label: "Households", href: "/admin/households" },
  { icon: ScrollText, label: "Audit Log", href: "/admin/activity" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !user.is_platform_admin)) {
      router.replace("/app");
    }
  }, [user, loading, router]);

  if (loading || !user || !user.is_platform_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 size={24} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900 lg:flex">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-emerald-400" />
            <span className="text-base font-semibold text-white">
              Admin Portal
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <item.icon size={18} />
                <span className={`text-sm ${isActive ? "font-medium" : ""}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <ArrowLeft size={16} />
            Back to App
          </Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-6 py-4">
          <Link href="/app" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <Shield size={18} className="text-emerald-400 lg:hidden" />
          <span className="text-sm font-medium text-slate-300 lg:hidden">Admin Portal</span>
          <div className="flex-1" />
          <span className="text-sm text-slate-500">{user.display_name}</span>
        </header>

        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
