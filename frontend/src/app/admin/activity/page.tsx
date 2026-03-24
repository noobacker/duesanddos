"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Loader2, ScrollText } from "lucide-react";

interface AuditEntry {
  id: number;
  admin: number;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: number | null;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getAudit()
      .then((res) => setLogs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-slate-400">Admin actions and changes history</p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
          <ScrollText size={40} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-500">No audit entries yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {log.admin_name}{" "}
                    <span className="text-slate-400">—</span>{" "}
                    <span className="text-emerald-400">{log.action}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {log.target_type} #{log.target_id} · {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {(Object.keys(log.before_state).length > 0 || Object.keys(log.after_state).length > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-800 p-2">
                    <p className="text-xs font-medium text-slate-500 mb-1">Before</p>
                    <pre className="text-xs text-red-400 whitespace-pre-wrap">
                      {JSON.stringify(log.before_state, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-xl bg-slate-800 p-2">
                    <p className="text-xs font-medium text-slate-500 mb-1">After</p>
                    <pre className="text-xs text-emerald-400 whitespace-pre-wrap">
                      {JSON.stringify(log.after_state, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
