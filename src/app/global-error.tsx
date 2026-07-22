"use client"; // Error boundary 必須是 Client Component

// 覆蓋 root layout 本身的例外。global-error 會取代整個 layout，
// 因此必須自帶 <html> 與 <body>。
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="zh-TW">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#eef1f7",
          color: "#1f2937",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>
            ⚠️
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            應用程式發生嚴重錯誤
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
            {error.message || "請重新整理頁面再試一次"}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 14,
              background: "white",
              cursor: "pointer",
            }}
          >
            重新嘗試
          </button>
        </main>
      </body>
    </html>
  );
}
