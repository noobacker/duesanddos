"use client";

import { useState, useEffect, useCallback } from "react";

const KEY = "animationsEnabled";

export function useAnimations() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Read preference on mount
    const stored = localStorage.getItem(KEY);
    const isEnabled = stored !== "false"; // default true
    setEnabled(isEnabled);
    if (!isEnabled) {
      document.body.classList.add("no-animations");
    } else {
      document.body.classList.remove("no-animations");
    }
  }, []);

  const toggle = useCallback((value: boolean) => {
    setEnabled(value);
    localStorage.setItem(KEY, String(value));
    if (!value) {
      document.body.classList.add("no-animations");
    } else {
      document.body.classList.remove("no-animations");
    }
  }, []);

  return { enabled, toggle };
}
