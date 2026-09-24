"use client";
import { useEffect, useState } from "react";
import { assetUrl } from "../client-api";
export function AudioWaveform({ assetId }: { assetId: string }) {
  const [peaks, setPeaks] = useState<number[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    const context = new AudioContext();
    let active = true;
    void fetch(assetUrl(assetId), { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error("Audio unavailable");
        return r.arrayBuffer();
      })
      .then((b) => context.decodeAudioData(b))
      .then((audio) => {
        const data = audio.getChannelData(0),
          stride = Math.max(1, Math.floor(data.length / 100));
        const values = Array.from({ length: 100 }, (_, i) => {
          let peak = 0;
          for (
            let n = i * stride;
            n < Math.min(data.length, (i + 1) * stride);
            n += 8
          )
            peak = Math.max(peak, Math.abs(data[n]));
          return peak;
        });
        if (active) setPeaks(values);
      })
      .catch(() => {})
      .finally(() => context.close());
    return () => {
      active = false;
      abort.abort();
    };
  }, [assetId]);
  if (!peaks.length) return null;
  return (
    <svg
      className="audio-waveform"
      viewBox="0 0 400 64"
      role="img"
      aria-label="Audio amplitude waveform"
    >
      {peaks.map((p, i) => (
        <line
          key={i}
          x1={i * 4 + 2}
          x2={i * 4 + 2}
          y1={32 - p * 30}
          y2={32 + p * 30}
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
