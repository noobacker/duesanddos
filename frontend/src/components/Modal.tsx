"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        className={`relative z-10 w-full ${maxWidth} rounded-2xl bg-white shadow-2xl animate-fade-up`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  confirmClass?: string;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen, onClose, onConfirm, title, description,
  confirmLabel = "Confirm", confirmClass = "btn-danger", loading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-sm text-stone-600 leading-relaxed">{description}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={confirmClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  submitLabel?: string;
  optional?: boolean;
}

export function PromptModal({
  isOpen, onClose, onSubmit, title, label,
  placeholder = "", submitLabel = "Submit", optional = false,
}: PromptModalProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    onSubmit(inputRef.current?.value || "");
    if (inputRef.current) inputRef.current.value = "";
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="form-label">{label}{optional && <span className="text-stone-400 ml-1">(optional)</span>}</label>
          <textarea
            ref={inputRef}
            rows={3}
            placeholder={placeholder}
            className="input-field w-full resize-none"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>{submitLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
