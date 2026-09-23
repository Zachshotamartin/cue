"use client";
import { ArrowUpRight, Check, Key } from "@phosphor-icons/react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
export type ProviderInfo = {
  id: string;
  name: string;
  description: string;
  url: string;
};
export type ProviderStatus = {
  provider: string;
  configured: boolean;
  source?: string;
  suffix?: string;
};
export function ProviderConnection({
  p,
  status,
  busy,
  save,
  remove,
}: {
  p: ProviderInfo;
  status: ProviderStatus[];
  busy: string;
  save: (provider: string, form: FormData) => Promise<void>;
  remove: (provider: string) => Promise<void>;
}) {
  const s = status.find((x) => x.provider === p.id);
  return (
    <section key={p.id} className="provider-row">
      <div className="provider-heading">
        <Key size={25} />
        <div>
          <h2>{p.name}</h2>
          <p>{p.description}</p>
          <a href={p.url} target="_blank" rel="noreferrer">
            Get an API key <ArrowUpRight size={14} />
          </a>
        </div>
        {s?.configured && (
          <span className="connected">
            <Check size={14} />
            Connected
            {s.suffix ? ` ••••${s.suffix}` : " via environment"}
          </span>
        )}
      </div>
      <form action={(form) => save(p.id, form)}>
        <label htmlFor={`key-${p.id}`}>
          {s?.configured ? "Replace API key" : "API key"}
        </label>
        <div className="key-input">
          <Input
            id={`key-${p.id}`}
            name="key"
            type="password"
            autoComplete="off"
            required
            minLength={12}
            placeholder="Paste your provider key"
          />
          <Button type="submit" className="button" disabled={busy === p.id}>
            {busy === p.id ? "Saving…" : "Save key"}
          </Button>
          {s?.source === "encrypted" && (
            <Button
              type="button"
              className="button secondary"
              onClick={() => remove(p.id)}
            >
              Remove
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
