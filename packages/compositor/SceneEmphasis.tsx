import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Shot } from "../contracts";
export function SceneEmphasis({
  shot,
  accent,
  crop,
}: {
  shot: Shot;
  accent: string;
  crop: Shot["focalRect"];
}) {
  const time = useCurrentFrame() / useVideoConfig().fps;
  return (
    <>
      {shot.emphasis
        .filter((e) => time >= e.at && time < e.at + e.duration)
        .map((e, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${((e.x - crop.x) / crop.width) * 100}%`,
              top: `${((e.y - crop.y) / crop.height) * 100}%`,
              transform: "translate(-50%,-50%)",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: `3px solid ${accent}`,
                borderRadius: "50%",
                boxShadow: "0 0 0 6px #fff5",
              }}
            />
            {e.label && (
              <div
                style={{
                  position: "absolute",
                  top: 44,
                  left: -80,
                  width: 200,
                  background: "#181a19",
                  color: "#fff",
                  padding: 12,
                  fontSize: 20,
                  borderRadius: 6,
                }}
              >
                {e.label}
              </div>
            )}
          </div>
        ))}
    </>
  );
}
