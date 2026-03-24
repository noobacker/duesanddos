"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { choreApi, householdApi } from "@/lib/api";
import type { Chore, HouseholdMembership } from "@/types";
import {
  Plus,
  X,
  Loader2,
  CheckSquare,
  Calendar,
  Users,
  RotateCcw,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  BarChart2,
} from "lucide-react";
import { ConfirmModal, PromptModal } from "@/components/Modal";

// Extended types for the new API shape
interface ChoreAssignment {
  id: number;
  chore: number;
  assigned_user: number;
  assigned_user_name: string;
  due_date: string;
  is_done: boolean;
  done_at: string | null;
  note: string;
  logs: { id: number; user: number; user_name: string; action: string; note: string; created_at: string }[];
  created_at: string;
}

interface ExtendedChore extends Chore {
  is_rotation: boolean;
  rotation_member_ids: number[];
  rotation_member_names: string[];
  current_assignee_id: number | null;
  current_assignee_name: string | null;
  rotation_order: number;
  upcoming_assignments: ChoreAssignment[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-stone-100 text-stone-600",
  done: "bg-green-100 text-green-700",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "One-time",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  until_closed: "Until closed by admin",
};

export default function ChoresPage() {
  const { user } = useAuth();
  const { householdId } = useParams();
  const hid = Number(householdId);

  const [chores, setChores] = useState<ExtendedChore[]>([]);
  const [mySchedule, setMySchedule] = useState<ChoreAssignment[]>([]);
  const [members, setMembers] = useState<HouseholdMembership[]>([]);
  const [loadingChores, setLoadingChores] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "mine" | "stats">("mine");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filterUser, setFilterUser] = useState<number | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isRotation, setIsRotation] = useState(false);
  const [rotationMemberIds, setRotationMemberIds] = useState<number[]>([]);
  const [startsWithUserId, setStartsWithUserId] = useState<number | null>(null);
  const [memberCycles, setMemberCycles] = useState<Record<number, number>>({});
  const [assignedTo, setAssignedTo] = useState<number | "">("")
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [editingNote, setEditingNote] = useState<{ choreId: number; logId: number; note: string } | null>(null);

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [markDoneTarget, setMarkDoneTarget] = useState<{ choreId: number; assignmentId: number } | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ choreId: number; assignmentId: number } | null>(null);

  const householdRole =
    members.find((m) => m.user.id === user?.id)?.role || "member";

  const fetchData = useCallback(async (p = 1, append = false) => {
    try {
      const params: Record<string, string | number> = { page: p, page_size: 15 };
      if (filterUser) params.assignee = filterUser;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      
      const [choreRes, memRes, schedRes] = await Promise.all([
        choreApi.list(hid, params as Record<string, string>),
        householdApi.getMembers(hid),
        choreApi.getMySchedule(hid),
      ]);
      
      const data = choreRes.data;
      setChores(prev => append ? [...prev, ...data.results] : data.results);
      setHasMore(data.has_more);
      setTotalCount(data.count);
      setPage(p);
      
      setMembers(memRes.data);
      setMySchedule(schedRes.data);
    } catch {}
    setLoadingChores(false);
  }, [hid, filterUser, filterDateFrom, filterDateTo]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await choreApi.create(hid, {
        title: title.trim(),
        description,
        is_rotation: isRotation,
        ...(isRotation
          ? {
              rotation_member_ids: rotationMemberIds,
              starts_with: startsWithUserId || rotationMemberIds[0] || null,
              recurrence,
            }
          : { assigned_to: assignedTo || null }),
        due_date: dueDate || null,
        recurrence,
      });
      setTitle(""); setDescription(""); setIsRotation(false);
      setRotationMemberIds([]); setStartsWithUserId(null); setMemberCycles({});
      setAssignedTo(""); setDueDate(""); setRecurrence("none");
      setShowForm(false); fetchData(1);
    } catch {}
    setSubmitting(false);
  };

  const handleCompleteAssignment = async (choreId: number, assignmentId: number, note?: string) => {
    await choreApi.complete(hid, choreId, assignmentId, note);
    fetchData(1);
  };

  const handleCompleteChore = async (choreId: number) => {
    await choreApi.complete(hid, choreId);
    fetchData(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await choreApi.delete(hid, deleteTarget);
    setDeleteTarget(null);
    fetchData(1);
  };

  const handleSwap = async (reason: string) => {
    if (!swapTarget) return;
    await choreApi.requestSwap(hid, swapTarget.choreId, swapTarget.assignmentId, reason);
    setSwapTarget(null);
  };

  const handleMarkDone = async (note: string) => {
    if (!markDoneTarget) return;
    await handleCompleteAssignment(markDoneTarget.choreId, markDoneTarget.assignmentId, note || undefined);
    setMarkDoneTarget(null);
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;
    await choreApi.editLogNote(hid, editingNote.choreId, editingNote.logId, editingNote.note);
    setEditingNote(null); fetchData(1);
  };

  const toggleMember = (uid: number) => {
    setRotationMemberIds(prev => {
      const next = prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid];
      // Default cycles = equal
      setMemberCycles(mc => {
        const updated = { ...mc };
        if (!prev.includes(uid)) updated[uid] = 2; // new member gets 2 cycles by default
        else delete updated[uid];
        return updated;
      });
      return next;
    });
    setStartsWithUserId(prev => {
      if (!prev) return null;
      const newList = rotationMemberIds.includes(uid)
        ? rotationMemberIds.filter(id => id !== uid)
        : [...rotationMemberIds, uid];
      return newList.includes(prev) ? prev : null;
    });
  };

  // Build distribution stats across all rotation chores
  const distributionStats = useMemo(() => {
    const stats: Record<number, { name: string; assigned: number; completed: number; missed: number; reassigned: number }> = {};
    const initUser = (id: number, name: string) => {
      if (!stats[id]) stats[id] = { name, assigned: 0, completed: 0, missed: 0, reassigned: 0 };
    };
    const today = new Date().toISOString().split("T")[0];
    chores.forEach(c => {
      if (!c.is_rotation) return;
      c.upcoming_assignments.forEach(a => {
        initUser(a.assigned_user, a.assigned_user_name);
        stats[a.assigned_user].assigned++;
        if (a.is_done) stats[a.assigned_user].completed++;
        else if (a.due_date < today) stats[a.assigned_user].missed++;
      });
      c.logs?.forEach(log => {
        if (log.action === "reassigned") {
          initUser(log.user, log.user_name);
          stats[log.user].reassigned++;
        }
      });
    });
    return Object.values(stats).sort((a, b) => b.assigned - a.assigned);
  }, [chores]);

  if (loadingChores) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  const overdueToday = mySchedule.filter(
    (a) => a.due_date < new Date().toISOString().split("T")[0] && !a.is_done
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Chores</h1>
          {overdueToday.length > 0 && (
            <p className="mt-0.5 text-sm text-red-500 font-medium">
              ⚠ {overdueToday.length} overdue assignment{overdueToday.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {householdRole === "admin" && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "Add Chore"}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card mb-6 p-6 animate-fade-up">
          <h2 className="mb-4 text-lg font-semibold text-stone-900">New Chore</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label">Title</label>
              <input className="input-field" placeholder="e.g. Sweep the kitchen" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Description (optional)</label>
              <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Extra details..." />
            </div>

            {/* Rotation toggle */}
            <div className="sm:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsRotation(!isRotation)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRotation ? "bg-brand-500" : "bg-stone-200"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isRotation ? "translate-x-6" : "translate-x-1"}`} />
                </div>
                <div>
                  <span className="text-sm font-medium text-stone-700">Rotation Mode</span>
                  <p className="text-xs text-stone-400">Assign to multiple people in turns</p>
                </div>
              </label>
            </div>

            {isRotation ? (
              <>
                <div className="sm:col-span-2">
                  <label className="form-label flex items-center gap-1"><Users size={12} /> Rotation Members</label>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <button
                        key={m.user.id}
                        type="button"
                        onClick={() => toggleMember(m.user.id)}
                        className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                          rotationMemberIds.includes(m.user.id)
                            ? "bg-brand-600 text-white border-brand-600"
                            : "border-stone-200 text-stone-600 hover:border-brand-300"
                        }`}
                      >
                        {m.user.display_name}
                        {rotationMemberIds.includes(m.user.id) && <Check size={12} className="inline ml-1" />}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-stone-400">
                    Order: {rotationMemberIds.map(id => members.find(m => m.user.id === id)?.user.display_name).join(" → ") || "(none)"}
                  </p>
                  {rotationMemberIds.length >= 2 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-stone-500 mb-2 flex items-center gap-1">
                        Cycles per person
                        <span className="text-stone-300 font-normal">(equal by default — adjust as needed)</span>
                      </p>
                      <div className="space-y-1.5">
                        {rotationMemberIds.map(uid => {
                          const m = members.find(mb => mb.user.id === uid);
                          const cycles = memberCycles[uid] ?? 2;
                          return (
                            <div key={uid} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-1.5">
                              <span className="text-sm text-stone-700">{m?.user.display_name}</span>
                              <div className="flex items-center gap-2">
                                <button type="button"
                                  onClick={() => setMemberCycles(mc => ({ ...mc, [uid]: Math.max(1, (mc[uid] ?? 2) - 1) }))}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-200 text-stone-600 hover:bg-stone-300 text-sm font-bold">−</button>
                                <span className="w-6 text-center text-sm font-semibold text-stone-800">{cycles}</span>
                                <button type="button"
                                  onClick={() => setMemberCycles(mc => ({ ...mc, [uid]: (mc[uid] ?? 2) + 1 }))}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700 hover:bg-brand-200 text-sm font-bold">+</button>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-xs text-stone-400">
                          Total cycles: {rotationMemberIds.reduce((s, uid) => s + (memberCycles[uid] ?? 2), 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Recurrence</label>
                  <select className="input-field" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="until_closed">Until closed by admin</option>
                  </select>
                  {recurrence === "until_closed" && (
                    <p className="mt-1 text-xs text-amber-600">Only the next 4 occurrences will be generated at a time. Admin closes the chore to stop recurrence.</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Starting Date</label>
                  <input className="input-field" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                {rotationMemberIds.length >= 2 && (
                  <div className="sm:col-span-2">
                    <label className="form-label flex items-center gap-1">
                      <RotateCcw size={12} /> Who starts first?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {rotationMemberIds.map(uid => {
                        const m = members.find(mb => mb.user.id === uid);
                        return (
                          <button key={uid} type="button"
                            onClick={() => setStartsWithUserId(uid)}
                            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                              startsWithUserId === uid
                                ? "bg-brand-600 text-white border-brand-600"
                                : "border-stone-200 text-stone-600 hover:border-brand-300"
                            }`}>
                            {m?.user.display_name}
                            {startsWithUserId === uid && <Check size={11} className="inline ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-stone-400">
                      Turn order: {(startsWithUserId
                        ? [
                            ...rotationMemberIds.slice(rotationMemberIds.indexOf(startsWithUserId)),
                            ...rotationMemberIds.slice(0, rotationMemberIds.indexOf(startsWithUserId)),
                          ]
                        : rotationMemberIds
                      ).map(id => members.find(m => m.user.id === id)?.user.display_name).join(" → ")}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">Assign to</label>
                  <select className="input-field" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Due Date</label>
                  <input className="input-field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Recurrence</label>
                  <select className="input-field" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                    <option value="none">None (one-time)</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <button className="btn-primary mt-5" onClick={handleCreate} disabled={submitting || !title.trim() || (isRotation && rotationMemberIds.length < 2)}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Create Chore {isRotation && rotationMemberIds.length < 2 ? "(need ≥2 members)" : ""}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-stone-100">
        {(["mine", "all", "stats"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-stone-500 hover:text-stone-700"
            }`}>
            {tab === "mine" ? "My Schedule" : tab === "all" ? "All Chores" : <span className="flex items-center gap-1"><BarChart2 size={13} />Distribution</span>}
          </button>
        ))}
      </div>

      {/* MY SCHEDULE TAB */}
      {activeTab === "mine" && (
        <div>
          {mySchedule.length === 0 ? (
            <div className="card p-12 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-500">You have no upcoming chores assigned. Enjoy the day!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mySchedule.map(assignment => {
                const chore = chores.find(c => c.id === assignment.chore);
                const isOverdue = assignment.due_date < new Date().toISOString().split("T")[0];
                return (
                  <div key={assignment.id} className={`card p-5 ${isOverdue ? "border-red-200 bg-red-50/30" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-stone-900">{chore?.title || "Chore"}</h3>
                        {chore?.description && <p className="mt-0.5 text-sm text-stone-400">{chore.description}</p>}
                        <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
                          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                            <Clock size={11} /> {isOverdue ? "Overdue: " : "Due: "}
                            {new Date(assignment.due_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          {chore?.recurrence && chore.recurrence !== "none" && (
                            <span className="flex items-center gap-1"><RotateCcw size={11} /> {RECURRENCE_LABELS[chore.recurrence]}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => setMarkDoneTarget({ choreId: assignment.chore, assignmentId: assignment.id })}
                          className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600">
                          <Check size={14} /> Mark Done
                        </button>
                        <button
                          onClick={() => setSwapTarget({ choreId: assignment.chore, assignmentId: assignment.id })}
                          className="flex items-center gap-1 text-xs text-stone-400 hover:text-amber-600">
                          <RotateCcw size={11} /> Request swap
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISTRIBUTION TAB */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          <p className="text-sm text-stone-400">Across all rotation chores in this household:</p>
          {distributionStats.length === 0 ? (
            <div className="card p-10 text-center">
              <BarChart2 size={36} className="mx-auto mb-2 text-stone-300" />
              <p className="text-stone-400">No rotation chore data yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {distributionStats.map(s => {
                const doneRate = s.assigned > 0 ? Math.round((s.completed / s.assigned) * 100) : 0;
                return (
                  <div key={s.name} className="card p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-stone-900">{s.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        doneRate >= 80 ? "bg-green-100 text-green-700" : doneRate >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>{doneRate}% on-time</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mb-3 h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${doneRate}%` }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "Assigned", value: s.assigned, color: "text-stone-700" },
                        { label: "Completed", value: s.completed, color: "text-green-600" },
                        { label: "Missed", value: s.missed, color: "text-red-500" },
                        { label: "Reassigned", value: s.reassigned, color: "text-amber-600" },
                      ].map(st => (
                        <div key={st.label} className="rounded-xl bg-stone-50 py-2">
                          <p className={`text-xl font-bold ${st.color}`}>{st.value}</p>
                          <p className="text-xs text-stone-400">{st.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === "all" && (
        <div className="space-y-3">
          {/* Filters for All Chores */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 p-3">
            <div className="flex items-center gap-1.5 text-stone-500 mr-2">
              <span className="text-xs font-semibold tracking-wide uppercase">Filters</span>
            </div>
            <select
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              value={filterUser}
              onChange={(e) => { setFilterUser(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
            >
              <option value="">Any assignee</option>
              {members.map(m => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.display_name} {m.user.id === user?.id ? "(You)" : ""}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none w-32 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
              />
              <span className="text-stone-400 text-sm">to</span>
              <input
                type="date"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 shadow-sm outline-none w-32 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
              />
            </div>
            {(filterUser || filterDateFrom || filterDateTo) && (
              <button 
                onClick={() => { setFilterUser(""); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }} 
                className="rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition-colors ml-auto"
              >
                <X size={12} className="inline mr-0.5" /> Clear
              </button>
            )}
          </div>
          
          {chores.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckSquare size={40} className="mx-auto mb-3 text-stone-300" />
              <p className="text-stone-500">No chores yet. {householdRole === "admin" ? "Add the first one!" : "Ask an admin to add chores."}</p>
            </div>
          ) : (
            chores.map((c) => {
              const expanded = expandedId === c.id;
              return (
                <div key={c.id} className="card overflow-hidden">
                  <div
                    className="flex cursor-pointer items-start justify-between p-5"
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-stone-900">{c.title}</h3>
                        {c.is_rotation ? (
                          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            <RotateCcw size={10} /> Rotation
                          </span>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || "bg-stone-100 text-stone-600"}`}>
                            {c.status === "done" ? "Done" : "To Do"}
                          </span>
                        )}
                        {c.recurrence !== "none" && (
                          <span className="text-xs text-stone-400">{RECURRENCE_LABELS[c.recurrence]}</span>
                        )}
                      </div>

                      {c.is_rotation ? (
                        <p className="mt-1 text-sm text-stone-500">
                          Currently: <span className="font-medium text-stone-700">{c.current_assignee_name || "no one"}</span>
                          {" · "}
                          Rotation: {c.rotation_member_names.join(" → ")}
                        </p>
                      ) : (
                        c.assigned_to_name && (
                          <p className="mt-1 text-sm text-stone-500">Assigned to {c.assigned_to_name}</p>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {householdRole === "admin" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.id); }}
                          className="rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {!c.is_rotation && c.status !== "done" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCompleteChore(c.id); }}
                          className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {expanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
                    </div>
                  </div>

                  {/* Expanded: upcoming assignments */}
                  {expanded && c.is_rotation && c.upcoming_assignments.length > 0 && (
                    <div className="border-t border-stone-100 px-5 pb-5 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Upcoming Schedule</p>
                      <div className="space-y-2">
                        {c.upcoming_assignments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
                            <div>
                              <span className="text-sm font-medium text-stone-700">{a.assigned_user_name}</span>
                              <span className="ml-2 text-xs text-stone-400">
                                {new Date(a.due_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                            </div>
                            {a.is_done ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Done</span>
                            ) : a.assigned_user === user?.id ? (
                              <button
                                onClick={() => {
                                  const note = prompt("Add a note (optional):");
                                  handleCompleteAssignment(c.id, a.id, note || undefined);
                                }}
                                className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-600"
                              >
                                Mark Done
                              </button>
                            ) : (
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">Upcoming</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded: activity log */}
                  {expanded && c.logs.length > 0 && (
                    <div className="border-t border-stone-100 px-5 pb-4 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Activity</p>
                      <div className="space-y-1.5">
                        {c.logs.slice(0, 5).map((log) => (
                          <div key={log.id} className="flex items-start gap-2 text-sm">
                            <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-stone-300" />
                            <div className="flex-1">
                              <span className="text-stone-500">{log.user_name} — </span>
                              <span className="text-stone-700">{log.action.replace(/_/g, " ")}</span>
                              {log.note && (
                                editingNote?.logId === log.id ? (
                                  <span className="ml-2">
                                    <input
                                      className="rounded border border-stone-300 px-2 py-0.5 text-xs"
                                      value={editingNote.note}
                                      onChange={(e) => setEditingNote({ ...editingNote, note: e.target.value })}
                                    />
                                    <button onClick={handleSaveNote} className="ml-1 text-brand-600 text-xs">Save</button>
                                    <button onClick={() => setEditingNote(null)} className="ml-1 text-stone-400 text-xs">Cancel</button>
                                  </span>
                                ) : (
                                  <span className="ml-1 text-xs text-stone-400 italic">
                                    "{log.note}"
                                    {log.user === user?.id && (
                                      <button
                                        onClick={() => setEditingNote({ choreId: c.id, logId: log.id, note: log.note })}
                                        className="ml-1 text-stone-300 hover:text-stone-500"
                                      >
                                        <Pencil size={10} />
                                      </button>
                                    )}
                                  </span>
                                )
                              )}
                            </div>
                            <span className="text-xs text-stone-300 flex-shrink-0">
                              {new Date(log.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          
          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2 pb-6">
              <button
                className="btn-secondary"
                onClick={() => fetchData(page + 1, true)}
              >
                Load more <span className="text-stone-400 text-xs">({chores.length} of {totalCount})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
