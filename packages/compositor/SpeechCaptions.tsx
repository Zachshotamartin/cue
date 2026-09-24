import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Shot } from "../contracts";
export function SpeechCaptions({ cues }: { cues: Shot["speechCues"] }) {
  const { fps, width, height } = useVideoConfig(),
    time = useCurrentFrame() / fps;
  const cue = cues.find((c) => time >= c.start && time < c.end);
  if (!cue) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: height * 0.035,
        left: "8%",
        width: "84%",
        textAlign: "center",
        fontFamily: "Manrope, sans-serif",
        fontSize: width * (height > width ? 0.033 : 0.018),
        lineHeight: 1.35,
        color: "white",
      }}
    >
      <span
        style={{
          background: "#101818ec",
          padding: "8px 16px",
          boxDecorationBreak: "clone",
          borderRadius: 6,
        }}
      >
        {cue.text}
      </span>
    </div>
  );
}
