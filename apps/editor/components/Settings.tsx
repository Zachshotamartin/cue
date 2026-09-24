"use client";
import { useEffect, useState } from "react";
import { AccountSettings } from "./AccountSettings";
import { AccountHealth } from "./AccountHealth";
import { ProviderConnection, type ProviderStatus } from "./ProviderConnection";
import { api } from "./client-api";
import Link from "next/link";
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
    id: "openai",
    name: "OpenAI (ChatGPT)",
    description:
      "Storyboard planning from your screens and brief. Uses an OpenAI API key, billed separately from ChatGPT.",
    url: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Claude",
    description:
      "Storyboard planning from your screens and brief. Uses an Anthropic API key, billed separately from a Claude subscription.",
    url: "https://platform.claude.com/settings/keys",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Narration, instrumental music and sound effects.",
    url: "https://elevenlabs.io/app/settings/api-keys",
  },
];
export function Settings() {
  const [status, setStatus] = useState<ProviderStatus[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    api("/settings")
      .then((x) => {
        if (active) {
          setStatus(x.providers);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
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
  async function verify(provider: string) {
    setBusy(provider);
    setMessage("");
    try {
      const result = await api("/settings/verify", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      const fresh = await api("/settings");
      setStatus(fresh.providers);
      setMessage(
        result.status === "verified"
          ? "Account access verified. No media generated."
          : "The provider did not accept the connection. Check the key and its permissions.",
      );
    } catch (e) {
      setMessage((e as Error).message);
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
        "Saved key removed. New jobs cannot use this provider until you add a key.",
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
        Connect only what you need. Capturing, editing and exports work without
        an AI key.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="provider-list">
        {providers.map((p) => (
          <ProviderConnection
            key={p.id}
            p={p}
            status={status}
            busy={busy}
            save={save}
            remove={remove}
            verify={verify}
          />
        ))}
      </div>
      <aside className="privacy-note">
        <h3>Private by design.</h3>
        <p>
          Keys are encrypted at rest and used only by Cue’s server-side jobs.
          They never appear in a project archive or reach the capture extension.
          Provider requests are sent only when you choose an AI operation.
        </p>
        <Link className="text-link" href="/privacy">
          Privacy and data processing ↗
        </Link>
      </aside>
      <AccountSettings />
      <AccountHealth />
    </main>
  );
}
