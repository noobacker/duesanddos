"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { householdApi } from "@/lib/api";
import type { Household, HouseholdMembership, Invite } from "@/types";
import {
  Settings,
  Users,
  UserMinus,
  Copy,
  Loader2,
  Link as LinkIcon,
  Check,
  Home,
  Plus,
  LogIn,
  ChevronDown,
} from "lucide-react";
import { Modal, ConfirmModal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";

export default function HouseholdSettingsPage() {
  const { user } = useAuth();
  const { householdId } = useParams();
  const router = useRouter();
  const hid = Number(householdId);

  const [household, setHousehold] = useState<Household | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<HouseholdMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [hRes, mRes, listRes] = await Promise.all([
        householdApi.get(hid),
        householdApi.getMembers(hid),
        householdApi.list(),
      ]);
      setHousehold(hRes.data);
      setMembers(mRes.data);
      setHouseholds(listRes.data);
      setName(hRes.data.name);
    } catch {}
    setLoading(false);
  }, [hid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await householdApi.update(hid, { name: name.trim() }); fetchData(); } catch {}
    setSaving(false);
  };

  const handleCreateInvite = async () => {
    try { const res = await householdApi.createInvite(hid); setInvite(res.data); } catch {}
  };

  const handleCopyCode = () => {
    if (invite) {
      navigator.clipboard.writeText(invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRoleChange = async (mid: number, newRole: string) => {
    await householdApi.updateMember(hid, mid, { role: newRole });
    fetchData();
  };

  const handleRemoveMember = async () => {
    if (!removingMemberId) return;
    await householdApi.removeMember(hid, removingMemberId);
    setRemovingMemberId(null);
    fetchData();
  };
  
  const handleDeleteHousehold = async () => {
    if (deleteConfirmName !== household?.name) return;
    setDeleting(true);
    try {
      await householdApi.delete(hid);
      router.push("/households");
    } catch (err) {
      console.error("Failed to delete household", err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  const myRole = members.find(m => m.user.id === user?.id)?.role;

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">Household Settings</h1>
        {households.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Switch:</span>
            <div className="relative">
              <button 
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className="flex items-center justify-between w-48 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 transition-colors"
              >
                <span className="truncate">{households.find(h => h.id === hid)?.name || "Select..."}</span>
                <ChevronDown size={14} className={`text-stone-400 flex-shrink-0 ml-2 transition-transform duration-200 ${isSwitcherOpen ? "rotate-180" : ""}`} />
              </button>
              
              {isSwitcherOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsSwitcherOpen(false)} 
                  />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-stone-100 bg-white py-1.5 shadow-lg animate-in fade-in slide-in-from-top-2">
                    {households.map(h => (
                      <button
                        key={h.id}
                        onClick={() => { setIsSwitcherOpen(false); router.push(`/app/${h.id}/settings`); }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                          h.id === hid ? "bg-brand-50 text-brand-700 font-semibold" : "text-stone-700 hover:bg-stone-50 mb-0.5"
                        }`}
                      >
                        <span className="truncate">{h.name}</span>
                        {h.id === hid && <Check size={14} className="text-brand-600 flex-shrink-0 ml-2" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">

        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {myRole === "admin" && (
            <>
              {/* Household Name */}
              <div className="card p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900">
                  <Settings size={18} /> General
                </h2>
                <label className="form-label">Household Name</label>
                <div className="flex gap-2">
                  <input className="input-field flex-1" value={name} onChange={(e) => setName(e.target.value)} />
                  <button className="btn-primary" onClick={handleSaveName} disabled={saving || name === household?.name}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                  </button>
                </div>
              </div>

              {/* Invite */}
              <div className="card p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900">
                  <LinkIcon size={18} /> Invite Members
                </h2>
                {invite ? (
                  <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-4">
                    <code className="flex-1 text-lg font-mono font-bold tracking-widest text-brand-700">
                      {invite.code}
                    </code>
                    <button onClick={handleCopyCode} className="btn-secondary text-sm">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary" onClick={handleCreateInvite}>
                    <LinkIcon size={16} /> Generate Invite Code
                  </button>
                )}
                <p className="mt-2 text-xs text-stone-400">Invite codes expire in 7 days. Share with your roommate to join.</p>
              </div>
            </>
          )}

          {/* Households — Join / Create another */}
          <div className="card p-6">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-stone-900">
              <Home size={18} /> Your Households
            </h2>
            <p className="mb-4 text-sm text-stone-400">
              You can be a member of multiple households simultaneously.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => router.push("/households")} className="btn-primary">
                <Plus size={16} /> Create Household
              </button>
              <button onClick={() => router.push("/households")} className="btn-secondary">
                <LogIn size={16} /> Join Household
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Members */}
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-stone-900">
              <Users size={18} /> Members ({members.length})
            </h2>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3">
                  <Avatar user={m.user} size="h-8 w-8 text-xs font-semibold text-white bg-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-700">
                      {m.user.display_name}
                      {m.user.id === user?.id && <span className="text-stone-400"> (you)</span>}
                    </p>
                    <p className="text-xs text-stone-400">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {myRole === "admin" ? (
                      <>
                        <select
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          disabled={m.user.id === user?.id}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                        {m.user.id !== user?.id && (
                          <button
                            onClick={() => setRemovingMemberId(m.id)}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500"
                            title="Remove member"
                          >
                            <UserMinus size={14} />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 capitalize">{m.role}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>


      <div className="mt-12 border-t border-stone-200 pt-8 max-w-5xl">
        <div className="mb-6 flex items-center gap-2 text-red-600">
          <Settings size={20} />
          <h2 className="text-xl font-bold">Danger Zone</h2>
        </div>
        <div className="card border-red-100 bg-red-50/30 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-stone-900">Delete this household</p>
              <p className="text-sm text-stone-500 mt-1">
                Once you delete a household, there is no going back. Please be certain.
              </p>
            </div>
            {myRole === "admin" ? (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="btn-danger bg-red-600 hover:bg-red-700 whitespace-nowrap"
              >
                Delete Household
              </button>
            ) : (
              <span className="text-xs font-medium text-stone-400 bg-stone-100 px-3 py-1 rounded-lg">
                Admin only
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={removingMemberId !== null}
        onClose={() => setRemovingMemberId(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        description="Remove this member from the household? They'll lose access but their history is preserved."
        confirmLabel="Remove"
        confirmClass="btn-danger"
      />

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteConfirmName("");
        }}
        title="Delete Household"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600 leading-relaxed">
            This action <strong className="text-stone-900">cannot</strong> be undone. This will permanently delete the 
            <strong className="text-stone-900"> {household?.name}</strong> household and remove all members.
          </p>
          <div>
            <label className="form-label text-stone-500">
              Please type <span className="font-bold text-stone-700">{household?.name}</span> to confirm.
            </label>
            <input
              type="text"
              className="input-field mt-1 w-full"
              placeholder="Case-sensitive"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmName("");
              }}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="btn-danger bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDeleteHousehold}
              disabled={deleting || deleteConfirmName !== household?.name}
            >
              {deleting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              I understand, delete this household
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
