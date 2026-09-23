"use client";
import { Button } from "./Button";
export function Tabs<T extends string>({
  id,
  label,
  tabs,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={className} role="tablist" aria-label={label}>
      {tabs.map((tab, i) => (
        <Button
          key={tab.value}
          id={`${id}-${tab.value}`}
          role="tab"
          aria-controls={`${id}-panel`}
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          className={value === tab.value ? "active" : ""}
          onClick={() => onChange(tab.value)}
          onKeyDown={(e) => {
            let at: number | undefined;
            if (e.key === "ArrowRight") at = (i + 1) % tabs.length;
            if (e.key === "ArrowLeft") at = (i - 1 + tabs.length) % tabs.length;
            if (e.key === "Home") at = 0;
            if (e.key === "End") at = tabs.length - 1;
            if (at !== undefined) {
              e.preventDefault();
              onChange(tabs[at].value);
              document.getElementById(`${id}-${tabs[at].value}`)?.focus();
            }
          }}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
