"use client";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
export function CreateFilmDialog({
  error,
  pending,
  create,
  onClose,
}: {
  error: string;
  pending: boolean;
  create: (form: FormData) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal labelledBy="create-title" onClose={onClose}>
      <p className="eyebrow">A new beginning</p>
      <h2 id="create-title">What are we introducing?</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form action={create}>
        <label>
          Film name
          <Input
            name="title"
            placeholder="My product launch"
            required
            autoFocus
            maxLength={100}
          />
        </label>
        <label>
          Website <span className="optional">optional</span>
          <Input name="url" type="url" placeholder="https://your-product.com" />
        </label>
        <p className="form-note">
          Signed-in pages work through the capture extension. You can also
          import screenshots and recordings.
        </p>
        <Button type="submit" className="button" disabled={pending}>
          {pending ? "Creating…" : "Create film"}
          <ArrowRight size={18} />
        </Button>
      </form>
    </Modal>
  );
}
