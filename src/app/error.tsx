"use client"; // Error boundary 必須是 Client Component

import { useEffect } from "react";

// 路由段的錯誤邊界：捕捉 render 期未處理例外，避免整頁白屏。
// 注意：此版 Next.js 用 unstable_retry（非舊版的 reset）來重試該段。
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container mx-auto max-w-md px-4 py-20 text-center">
      <div className="glass-card rounded-2xl p-8">
        <div className="mb-3 text-4xl" aria-hidden>
          ⚠️
        </div>
        <h2 className="mb-2 text-lg font-bold text-gray-800">儀表板載入失敗</h2>
        <p className="mb-6 break-words text-sm text-gray-500">
          {error.message || "發生未預期的錯誤"}
        </p>
        <button
          onClick={() => unstable_retry()}
          className="glass-button rounded-xl px-5 py-2.5 text-sm text-gray-700"
        >
          重新嘗試
        </button>
      </div>
    </main>
  );
}
