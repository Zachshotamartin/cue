"use client";
import { useEffect, useRef } from "react";
export function useModalFocus(open: boolean, close: () => void) {
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      [
        ...(dialog?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not([hidden]),textarea,select,[tabindex="0"]',
        ) || []),
      ].filter((e) => e.offsetParent !== null);
    if (!dialog?.contains(document.activeElement)) focusable()[0]?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose.current();
      }
      if (e.key !== "Tab") return;
      const all = focusable(),
        first = all[0],
        last = all.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !dialog?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !dialog?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open]);
}
