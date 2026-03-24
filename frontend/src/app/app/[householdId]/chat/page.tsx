"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { chatApi } from "@/lib/api";
import type { ChatMessage } from "@/types";
import { Send, Loader2 } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const { householdId } = useParams();
  const hid = Number(householdId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await chatApi.list(hid);
      setMessages(res.data.reverse());
    } catch {}
    setLoading(false);
  }, [hid]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      await chatApi.send(hid, input.trim());
      setInput("");
      fetchMessages();
      inputRef.current?.focus();
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-stone-900">Household Chat</h1>
        <p className="text-sm text-stone-400">Messages auto-refresh every 5 seconds</p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-stone-100 bg-white p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-stone-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => {
              const isMe = m.sender === user?.id;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] ${isMe ? "order-last" : ""}`}>
                    {!isMe && (
                      <p className="mb-1 text-xs font-medium text-stone-500">{m.sender_name}</p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isMe
                          ? "bg-brand-600 text-white rounded-br-md"
                          : "bg-stone-100 text-stone-800 rounded-bl-md"
                      }`}
                    >
                      {m.content}
                    </div>
                    <p className={`mt-1 text-xs text-stone-300 ${isMe ? "text-right" : ""}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          className="input-field flex-1"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="btn-primary px-4"
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
