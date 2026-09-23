import type { ReactNode } from "react";
export function Disclosure({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="disclosure">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
