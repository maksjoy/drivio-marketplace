import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Alberta-Cars — private used cars in Alberta";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", height: 12, background: "#245886" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#cb0111", fontSize: 92, fontWeight: 800, letterSpacing: -2 }}>
            Alberta-Cars
          </div>
          <div style={{ display: "flex", marginTop: 18, color: "#245886", fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>
            WILD ROSE COUNTRY
          </div>
          <div style={{ display: "flex", marginTop: 28, color: "#1f2937", fontSize: 36 }}>
            Private sellers only · Alberta, Canada
          </div>
        </div>
        <div style={{ display: "flex", height: 12, background: "#cb0111" }} />
      </div>
    ),
    { ...size },
  );
}
