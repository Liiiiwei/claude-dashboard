import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="zh-TW" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
