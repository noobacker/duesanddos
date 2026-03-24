"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
  Bell,
  Home,
  Shield,
  User,
  Activity,
  ChevronLeft,
  Pin,
  PinOff,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { householdApi, notificationApi } from "@/lib/api";
import type { Household, Notification } from "@/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Avatar } from "@/components/Avatar";


export default function HouseholdLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const householdId = Number(params.householdId);

  const [household, setHousehold] = useState<Household | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Sidebar state: hovered (temporary) vs pinned (permanent open)
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarPinned") !== "false";
    }
    return true;
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarOpen = sidebarPinned || sidebarHovered;
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarEnter = () => {
    if (sidebarPinned) return;
    hoverTimer.current = setTimeout(() => setSidebarHovered(true), 240);
  };
  const handleSidebarLeave = () => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    if (!sidebarPinned) setSidebarHovered(false);
  };

  const togglePin = () => {
    const next = !sidebarPinned;
    setSidebarPinned(next);
    if (!next) setSidebarHovered(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarPinned", String(next));
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setNotifications(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user && householdId) {
      householdApi
        .get(householdId)
        .then((res) => setHousehold(res.data))
        .catch(() => router.replace("/app"));
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, loading, router, householdId, fetchNotifications]);

  if (loading || !user || !household) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: `/app/${householdId}/dashboard` },
    { icon: Receipt, label: "Expenses", href: `/app/${householdId}/expenses` },
    { icon: CheckSquare, label: "Chores", href: `/app/${householdId}/chores` },
    { icon: Activity, label: "My Activity", href: `/app/${householdId}/activity` },
    { icon: MessageCircle, label: "Chat", href: `/app/${householdId}/chat` },
    { icon: User, label: "Profile", href: `/app/${householdId}/profile` },
    ...(household.my_role === "admin"
      ? [{ icon: Settings, label: "Household Settings", href: `/app/${householdId}/settings` }]
      : []),
  ];

  const markRead = async (id: number) => {
    await notificationApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    await notificationApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // ── Desktop sidebar (collapsible) ─────────────────
  const DesktopSidebar = () => (
    <aside
      onMouseEnter={handleSidebarEnter}
      onMouseLeave={handleSidebarLeave}
      style={{
        width: sidebarOpen ? "15rem" : "4rem",
        transition: "width 320ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="hidden lg:flex flex-col flex-shrink-0 border-r border-stone-100 bg-white overflow-hidden"
    >
      {/* Logo / brand */}
      <div className={`flex items-center border-b border-stone-100 px-3 py-4 ${sidebarOpen ? "justify-between gap-2" : "justify-center"}`}>
        <Link href="/app" className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>
          {sidebarOpen && (
            <span className="font-display text-sm font-semibold text-stone-900 truncate">
              Dues <span className="text-brand-600">&</span> Do&apos;s
            </span>
          )}
        </Link>
        {sidebarOpen && (
          <button
            onClick={togglePin}
            title={sidebarPinned ? "Unpin sidebar" : "Pin sidebar open"}
            className="flex-shrink-0 rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            {sidebarPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        )}
      </div>

      {/* Current household */}
      <div className={`border-b border-stone-100 px-2 py-2`}>
        <Link
          href="/households"
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-stone-50"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100">
            <Home size={15} className="text-brand-600" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-stone-900">{household.name}</div>
              <div className="flex items-center gap-0.5 text-[10px] text-stone-400">
                <ChevronLeft size={10} /> Switch household
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              title={!sidebarOpen ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl transition-colors ${
                sidebarOpen ? "px-3 py-2.5" : "justify-center px-0 py-2.5"
              } ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
              }`}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {sidebarOpen && (
                <span className={`text-sm ${isActive ? "font-medium" : ""}`}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {user.is_platform_admin && (
        <div className="border-t border-stone-100 px-2 py-2">
          <Link
            href="/admin"
            title={!sidebarOpen ? "Admin Portal" : undefined}
            className={`flex items-center gap-3 rounded-xl text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700 ${
              sidebarOpen ? "px-3 py-2.5" : "justify-center px-0 py-2.5"
            }`}
          >
            <Shield size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Admin Portal</span>}
          </Link>
        </div>
      )}

      {/* User footer */}
      <div className="border-t border-stone-100 p-2">
        <div className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${!sidebarOpen ? "justify-center" : ""}`}>
          <Avatar 
            user={user} 
            size="h-8 w-8 text-xs text-white bg-brand-600 font-semibold" 
          />
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-stone-900">{user.display_name}</div>
              <div className="truncate text-[10px] text-stone-400">{user.email}</div>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={logout}
              className="flex-shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  // ── Mobile sidebar ─────────────────────────────────
  const MobileSidebar = () => (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <Link href="/app" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={28} height={28} className="object-contain" />
          <span className="font-display text-sm font-semibold text-stone-900">
            Dues <span className="text-brand-600">&</span> Do&apos;s
          </span>
        </Link>
        <button onClick={() => setMobileSidebarOpen(false)} className="rounded-lg p-1 hover:bg-stone-100">
          <X size={18} className="text-stone-500" />
        </button>
      </div>

      <div className="border-b border-stone-100 px-3 py-2">
        <Link
          href="/households"
          onClick={() => setMobileSidebarOpen(false)}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-stone-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
            <Home size={15} className="text-brand-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-stone-900">{household.name}</div>
            <div className="text-xs text-stone-400">Switch household</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              <item.icon size={18} />
              <span className={`text-sm ${isActive ? "font-medium" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <Avatar 
            user={user} 
            size="h-8 w-8 text-xs text-white bg-brand-600 font-semibold" 
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-stone-900">{user.display_name}</div>
            <div className="truncate text-xs text-stone-400">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-stone-50">
      <DesktopSidebar />

      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <MobileSidebar />
        </>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-4 border-b border-stone-100 bg-white px-4 py-4 sm:px-6">
          <button
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-stone-100 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <span className="text-sm font-semibold text-stone-900">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-sm text-stone-400">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 20).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`block w-full border-b border-stone-50 px-4 py-3 text-left transition-colors hover:bg-stone-50 ${!n.is_read ? "bg-brand-50/30" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && (
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-stone-900">{n.title}</p>
                            <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">{n.message}</p>
                            <p className="mt-1 text-xs text-stone-300">{new Date(n.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
