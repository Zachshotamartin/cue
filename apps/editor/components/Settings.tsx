"use client";
import { useEffect, useState } from "react";
import { Check, Key, ArrowUpRight } from "@phosphor-icons/react";
import { api } from "./client-api";
const providers = [
  {
    id: "runway",
    name: "Runway",
    description: "Image-to-video generation for your scenes.",
    url: "https://dev.runwayml.com/",
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "A director that reads your screens and proposes a story.",
    url: "https://aistudio.google.com/apikey",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Optional voice-over from your narration script.",
    url: "https://elevenlabs.io/app/settings/api-keys",
  },
];
export function Settings() {
  const [status, setStatus] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    api("/settings")
      .then((x) => setStatus(x.providers))
      .catch((e) => setMessage(e.message));
  }, []);
  async function save(provider: string, form: FormData) {
    setBusy(provider);
    setMessage("");
    try {
      const x = await api("/settings", {
        method: "PUT",
        body: JSON.stringify({ provider, key: String(form.get("key")) }),
      });
      setStatus(x.providers);
      setMessage("Key saved with encryption.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy("");
    }
  }
  async function remove(provider: string) {
    try {
      const x = await api("/settings", {
        method: "DELETE",
        body: JSON.stringify({ provider }),
      });
      setStatus(x.providers);
      setMessage(
        "Saved key removed. Environment credentials, if configured, remain under your control.",
      );
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  return (
    <main className="settings-page page-shell">
      <p className="eyebrow">Your connections</p>
      <h1>Bring your creative tools.</h1>
      <p className="reading-lede">
        Connect only what you need. Capturing, editing and local exports work
        without an AI key.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="provider-list">
        {providers.map((p) => {
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
                  <input
                    id={`key-${p.id}`}
                    name="key"
                    type="password"
                    autoComplete="off"
                    required
                    minLength={12}
                    placeholder="Paste your provider key"
                  />
                  <button className="button" disabled={busy === p.id}>
                    {busy === p.id ? "Saving…" : "Save key"}
                  </button>
                  {s?.source === "encrypted" && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => remove(p.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </form>
            </section>
          );
        })}
      </div>
      <aside className="privacy-note">
        <h3>Private by design.</h3>
        <p>
          Keys are encrypted at rest and used only by the local worker. They
          never appear in a project archive or reach the capture extension.
          Provider requests are sent only when you choose an AI operation.
        </p>
      </aside>
    </main>
  );
}
