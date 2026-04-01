"use client";

import { useEffect, useCallback } from "react";

interface ShortcutMap {
  [key: string]: (event: KeyboardEvent) => void;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options: UseKeyboardShortcutsOptions = {},
) {
  const { enabled = true, preventDefault = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Build key string, e.g., "ctrl+shift+a"
      const parts: string[] = [];
      if (event.ctrlKey || event.metaKey) parts.push("ctrl");
      if (event.shiftKey) parts.push("shift");
      if (event.altKey) parts.push("alt");
      parts.push(event.key.toLowerCase());
      const combo = parts.join("+");

      // Also check just the raw key
      const handler = shortcuts[combo] ?? shortcuts[event.key.toLowerCase()];
      if (handler) {
        if (preventDefault) event.preventDefault();
        handler(event);
      }
    },
    [shortcuts, enabled, preventDefault],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
