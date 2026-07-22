"use client";

import { useMemo, useState } from "react";
import type { DailyTask } from "@/lib/types";
import { useDailyTasks } from "@/lib/useDailyTasks";

// 三個主分類的顯示順序與中文標籤（未分類另外處理，預設收合）
const CATEGORY_ORDER = ["ai-auto", "ai-draft", "human"] as const;
type MainCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<DailyTask["category"], string> = {
  "ai-auto": "AI 自動",
  "ai-draft": "AI 草稿",
  human: "人工",
  uncategorized: "未分類",
};

// 判斷到期日是否已逾期（僅比較日期，不含時間）
function isOverdue(due: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  return d.getTime() < today.getTime();
}

// 單條待辦列：文字 + 客戶 / 負責人 / 到期日 / 其他 tag
function TaskRow({ task }: { task: DailyTask }) {
  const overdue = task.due ? isOverdue(task.due) : false;
  // 非分類用的其他 tag：排除已被歸為 category 的分類 tag
  const extraTags = task.tags.filter(
    (t) => !["ai-auto", "ai-draft", "human"].includes(t),
  );

  return (
    <li className="glass-card rounded-xl px-3 py-2 flex flex-col gap-1">
      <span className="text-sm text-gray-800 leading-snug">{task.text}</span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="px-1.5 py-0.5 rounded-md bg-indigo-100/70 text-indigo-700 font-medium">
          {task.client}
        </span>
        {task.owner && <span className="text-gray-500">@{task.owner}</span>}
        {task.due && (
          <span
            className={
              overdue
                ? "px-1.5 py-0.5 rounded-md bg-red-100/70 text-red-600 font-medium"
                : "text-gray-500"
            }
            title={overdue ? "已逾期" : "到期日"}
          >
            📅 {task.due}
          </span>
        )}
        {extraTags.map((t) => (
          <span key={t} className="text-gray-400">
            #{t}
          </span>
        ))}
      </div>
    </li>
  );
}

export default function DailyTasks() {
  const { data, status, error, refetch } = useDailyTasks();

  // 預設選中數量最多的主分類；三組皆空時退回 human
  const defaultCategory = useMemo<MainCategory>(() => {
    if (!data) return "human";
    let best: MainCategory = "human";
    let bestCount = -1;
    for (const c of CATEGORY_ORDER) {
      if (data.counts[c] > bestCount) {
        bestCount = data.counts[c];
        best = c;
      }
    }
    return best;
  }, [data]);

  const [selected, setSelected] = useState<MainCategory | null>(null);
  const [uncatOpen, setUncatOpen] = useState(false);

  // 使用者尚未手動點選前，跟隨資料算出的預設分類
  const activeCategory = selected ?? defaultCategory;

  // ── loading：骨架列 ──
  if (status === "loading") {
    return (
      <section
        className="glass-card rounded-2xl p-4 mb-6"
        aria-busy="true"
        aria-label="日常任務載入中"
      >
        <div className="h-5 glass-shimmer rounded-lg w-28 mb-3" />
        <div className="flex gap-2 mb-3">
          <div className="h-7 glass-shimmer rounded-full w-20" />
          <div className="h-7 glass-shimmer rounded-full w-20" />
          <div className="h-7 glass-shimmer rounded-full w-16" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 glass-shimmer rounded-xl w-full" />
          ))}
        </div>
      </section>
    );
  }

  // ── error：錯誤訊息 + 重試 ──
  if (status === "error") {
    return (
      <section className="glass-card rounded-2xl p-4 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-2">日常任務</h2>
        <div className="bg-red-100/60 border border-red-200/60 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between gap-3">
          <span>{error ?? "載入日常任務失敗"}</span>
          <button
            onClick={refetch}
            className="glass-button rounded-lg px-3 py-1.5 text-sm text-red-700 shrink-0"
          >
            重試
          </button>
        </div>
      </section>
    );
  }

  // ── empty：四組皆空 ──
  if (status === "empty" || !data) {
    return (
      <section className="glass-card rounded-2xl p-6 mb-6 text-center text-gray-500">
        <div className="text-3xl mb-2" aria-hidden>
          ✅
        </div>
        <h2 className="text-base font-semibold text-gray-700">日常任務</h2>
        <p className="mt-1 text-sm">目前沒有任何待辦，全部都清空了。</p>
      </section>
    );
  }

  // ── success ──
  const activeTasks = data.groups[activeCategory] ?? [];
  const uncategorized = data.groups.uncategorized ?? [];
  const uncatCount = data.counts.uncategorized;

  return (
    <section className="glass-card rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">日常任務</h2>
        <button
          onClick={refetch}
          className="glass-button rounded-lg px-2.5 py-1 text-xs text-gray-500 inline-flex items-center gap-1"
          title="重新整理日常任務"
        >
          <span aria-hidden>↻</span>
          刷新
        </button>
      </div>

      {/* 三分類 pill 切換 */}
      <div
        role="tablist"
        aria-label="任務分類"
        className="flex flex-wrap gap-2 mb-3"
      >
        {CATEGORY_ORDER.map((c) => {
          const isActive = c === activeCategory;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelected(c)}
              className={`px-3 py-1.5 text-xs rounded-full transition-all inline-flex items-center gap-1.5 ${
                isActive
                  ? "glass-button-active text-gray-800 font-medium"
                  : "glass-button text-gray-500"
              }`}
            >
              <span>{CATEGORY_LABELS[c]}</span>
              <span
                className={`px-1.5 rounded-full text-[10px] ${
                  isActive
                    ? "bg-indigo-500/15 text-indigo-700"
                    : "bg-gray-200/60 text-gray-500"
                }`}
              >
                {data.counts[c]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 選中分類的待辦清單 */}
      {activeTasks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {activeTasks.map((task, i) => (
            <TaskRow key={`${task.sourceFile}-${i}`} task={task} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 py-4 text-center">
          這個分類目前沒有待辦。
        </p>
      )}

      {/* 未分類：預設收合，標題列顯示計數 */}
      {uncatCount > 0 && (
        <div className="mt-4 border-t border-white/50 pt-3">
          <button
            onClick={() => setUncatOpen((v) => !v)}
            aria-expanded={uncatOpen}
            className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={`inline-block transition-transform ${
                  uncatOpen ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
              未分類
            </span>
            <span className="px-1.5 rounded-full text-[10px] bg-gray-200/60 text-gray-500">
              {uncatCount}
            </span>
          </button>
          {uncatOpen && (
            <ul className="flex flex-col gap-2 mt-3">
              {uncategorized.map((task, i) => (
                <TaskRow key={`uncat-${task.sourceFile}-${i}`} task={task} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
