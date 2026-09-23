import { X } from "@phosphor-icons/react";
import { Button } from "./Button";
export function Notice({
  message,
  error = false,
  onDismiss,
}: {
  message: string;
  error?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`editor-banner ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span>{message}</span>
      {onDismiss && (
        <Button
          className="icon-button"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X size={15} />
        </Button>
      )}
    </div>
  );
}
