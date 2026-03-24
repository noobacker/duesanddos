"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";
import {
  Search,
  Loader2,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  username: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  date_joined: string;
  auth_provider: string;
  deactivated_at: string | null;
  household_count: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await adminApi.listUsers(params);
      setUsers(res.data);
    } catch {}
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const toggleAdmin = async (uid: number, current: boolean) => {
    setUpdating(uid);
    try {
      await adminApi.updateUser(uid, { is_platform_admin: !current });
      fetchUsers();
    } catch {}
    setUpdating(null);
  };

  const toggleActive = async (uid: number, current: boolean) => {
    setUpdating(uid);
    try {
      await adminApi.updateUser(uid, { is_active: !current });
      fetchUsers();
    } catch {}
    setUpdating(null);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-sm text-slate-400">Manage platform users, roles, and access</p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Households</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="bg-slate-900 hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-white">{u.display_name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {u.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_platform_admin
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-slate-700 text-slate-400"
                    }`}>
                      {u.is_platform_admin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.household_count}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.date_joined).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleAdmin(u.id, u.is_platform_admin)}
                        disabled={updating === u.id}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-amber-400"
                        title={u.is_platform_admin ? "Remove admin" : "Make admin"}
                      >
                        {u.is_platform_admin ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </button>
                      <button
                        onClick={() => toggleActive(u.id, u.is_active)}
                        disabled={updating === u.id}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-emerald-400"
                        title={u.is_active ? "Deactivate" : "Reactivate"}
                      >
                        {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
