"use client";
import { X } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";
export function Modal({
  label,
  labelledBy,
  className = "",
  onClose,
  children,
}: {
  label?: string;
  labelledBy?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const element = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      node = element.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...node.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not(:disabled):not([hidden]),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      ].filter((e) => e.getClientRects().length > 0);
    if (!node.contains(document.activeElement))
      (
        node.querySelector<HTMLElement>("[autofocus]") ||
        focusable()[0] ||
        node
      ).focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key !== "Tab") return;
      const elements = focusable(),
        first = elements[0],
        last = elements.at(-1);
      if (!first) {
        e.preventDefault();
        node.focus();
      } else if (
        e.shiftKey &&
        (document.activeElement === first ||
          !node.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !node.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    }
    node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={element}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        <Button
          className="icon-button close-modal"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </Button>
        {children}
      </section>
    </div>
  );
}
