"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

const STORAGE_KEY = "dues_custom_categories";

function getStoredCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function storeCategory(cat: string) {
  if (typeof window === "undefined") return;
  const existing = getStoredCategories();
  if (!existing.includes(cat)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([cat, ...existing].slice(0, 30)));
  }
}

interface CategoryComboProps {
  value: string;
  onChange: (value: string) => void;
  presets: string[];
  placeholder?: string;
}

export function CategoryCombo({ value, onChange, presets, placeholder = "Type or choose a category..." }: CategoryComboProps) {
  const [query, setQuery] = useState(value);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    setCustomCategories(getStoredCategories());
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = Array.from(new Set([...presets, ...customCategories]));
  const filtered = allOptions.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (cat: string) => {
    onChange(cat);
    setQuery(cat);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleBlur = () => {
    // Short delay so click on option registers first
    setTimeout(() => {
      setOpen(false);
      // If typed something custom not in presets, remember it
      if (query && !presets.map(p => p.toLowerCase()).includes(query.toLowerCase())) {
        storeCategory(query);
        setCustomCategories(getStoredCategories());
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          className="input-field pr-8"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-stone-100 bg-white shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-stone-50 ${
                  cat.toLowerCase() === query.toLowerCase()
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-stone-700"
                }`}
                onMouseDown={() => handleSelect(cat)}
              >
                {cat}
                {!presets.map(p => p.toLowerCase()).includes(cat.toLowerCase()) && (
                  <span className="ml-auto rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-400">custom</span>
                )}
              </button>
            ))}
          </div>
          {query && !filtered.some((c) => c.toLowerCase() === query.toLowerCase()) && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-stone-100 px-4 py-2.5 text-sm text-brand-600 hover:bg-brand-50"
              onMouseDown={() => handleSelect(query)}
            >
              <span className="text-brand-500">+</span> Use "{query}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
