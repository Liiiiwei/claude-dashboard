import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "專案儀表板",
  description: "本機專案管理儀表板",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="min-h-screen relative z-10" style={{ color: "#1f2937" }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
