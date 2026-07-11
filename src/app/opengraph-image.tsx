import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #171717 45%, #262626 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#fafafa",
              color: "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            IA
          </div>
          <div style={{ fontSize: "28px", fontWeight: 600 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "920px" }}>
          <div style={{ fontSize: "56px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            Interview prep roadmaps in minutes
          </div>
          <div style={{ fontSize: "28px", lineHeight: 1.4, color: "#d4d4d4" }}>{SITE_DESCRIPTION}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
