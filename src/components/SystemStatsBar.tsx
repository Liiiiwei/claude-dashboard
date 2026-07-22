"use client";

import { useCallback, useState } from "react";
import { usePolling } from "@/lib/usePolling";

interface SystemStats {
  cpu: number;
  mem: { total: number; used: number; percent: number };
}

// 顏色門檻：>80% 紅、>50% 琥珀、其餘綠
function barColor(percent: number): string {
  if (percent > 80) return "bg-red-500";
  if (percent > 50) return "bg-amber-500";
  return "bg-green-500";
}

// 系統狀態列自帶輪詢與狀態，與 Dashboard 的專案資料解耦，
// 避免每 5 秒的 CPU/RAM 更新觸發整個專案列表重繪。
export default function SystemStatsBar() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/system-stats");
      if (res.ok) setStats(await res.json());
    } catch {
      /* 靜默：狀態列為非關鍵資訊，取不到就不顯示 */
    }
  }, []);

  // 每 5 秒輪詢，分頁不可見時自動暫停（見 usePolling）
  usePolling(fetchStats, 5000);

  // 尚未取得資料前不佔版面（載入態）
  if (!stats) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 px-4 py-2.5 glass rounded-xl text-xs">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">CPU</span>
        <div className="w-20 h-1.5 bg-white/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(stats.cpu)}`}
            style={{ width: `${stats.cpu}%` }}
          />
        </div>
        <span className="text-gray-500">{stats.cpu}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">RAM</span>
        <div className="w-20 h-1.5 bg-white/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(stats.mem.percent)}`}
            style={{ width: `${stats.mem.percent}%` }}
          />
        </div>
        <span className="text-gray-500">
          {stats.mem.used}/{stats.mem.total}GB
        </span>
      </div>
    </div>
  );
}
