"use client";

import { useMemo, useState } from "react";
import type { DailyTask } from "@/lib/types";
import { useDailyTasks } from "@/lib/useDailyTasks";
import type { CompleteTasksResult } from "@/lib/useDailyTasks";

// 三個主分類的顯示順序與中文標籤（未分類另外處理，預設收合）
const CATEGORY_ORDER = ["ai-auto", "ai-draft", "human"] as const;
type MainCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<DailyTask["category"], string> = {
  "ai-auto": "AI 自動",
  "ai-draft": "AI 草稿",
  human: "人工",
  uncategorized: "未分類",
};

// 待辦唯一鍵：來源檔 + 行號（跨客戶、跨分類皆唯一）
function taskKey(task: DailyTask): string {
  return `${task.sourceFile}:${task.lineNumber}`;
}

// 到期日排序值：無到期日者用遠期哨兵殿後
function dueSortValue(due: string | null): string {
  return due ?? "9999-12-31";
}

// 依到期日升冪比較（無到期日殿後）
function byDue(a: DailyTask, b: DailyTask): number {
  const av = dueSortValue(a.due);
  const bv = dueSortValue(b.due);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

// 依 client 分組；各群內待辦按到期日升冪，客戶群再依最早到期日排序
function groupByClient(
  tasks: DailyTask[],
): { client: string; tasks: DailyTask[] }[] {
  const map = new Map<string, DailyTask[]>();
  for (const t of tasks) {
    const arr = map.get(t.client);
    if (arr) arr.push(t);
    else map.set(t.client, [t]);
  }
  const groups = Array.from(map, ([client, list]) => ({
    client,
    tasks: list.slice().sort(byDue),
  }));
  // tasks 已按到期日排序，第一筆即該客戶最早到期日
  groups.sort((a, b) => {
    const av = dueSortValue(a.tasks[0]?.due ?? null);
    const bv = dueSortValue(b.tasks[0]?.due ?? null);
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return groups;
}

// 後端 failed reason 轉人話
function humanizeReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("mismatch") || r.includes("changed") || r.includes("變動")) {
    return "內容已變動，請重新整理";
  }
  if (
    r.includes("not found") ||
    r.includes("missing") ||
    r.includes("找不到")
  ) {
    return "找不到來源，請重新整理";
  }
  return reason;
}

// 判斷到期日是否已逾期（僅比較日期，不含時間）
function isOverdue(due: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  return d.getTime() < today.getTime();
}

// 單條待辦列：checkbox + 文字 + 客戶 / 負責人 / 到期日 / 其他 tag
function TaskRow({
  task,
  checked,
  onToggle,
}: {
  task: DailyTask;
  checked: boolean;
  onToggle: (task: DailyTask) => void;
}) {
  const overdue = task.due ? isOverdue(task.due) : false;
  // 非分類用的其他 tag：排除已被歸為 category 的分類 tag
  const extraTags = task.tags.filter(
    (t) => !["ai-auto", "ai-draft", "human"].includes(t),
  );

  return (
    <li className="glass-card rounded-xl px-3 py-2 flex items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(task)}
        aria-label={`選取待辦：${task.text}`}
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-500 cursor-pointer"
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
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
      </div>
    </li>
  );
}

// 單一客戶的可摺疊區塊，預設收合
function ClientGroup({
  client,
  tasks,
  selected,
  onToggle,
  onToggleAll,
}: {
  client: string;
  tasks: DailyTask[];
  selected: Set<string>;
  onToggle: (task: DailyTask) => void;
  onToggleAll: (tasks: DailyTask[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = tasks.filter((t) => selected.has(taskKey(t))).length;
  const allSelected = selectedCount === tasks.length && tasks.length > 0;

  return (
    <div className="rounded-xl bg-white/30 border border-white/40">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
          >
            ›
          </span>
          <span className="truncate font-medium">{client}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          {selectedCount > 0 && (
            <span className="px-1.5 rounded-full text-[10px] bg-indigo-500/15 text-indigo-700 font-medium">
              已選 {selectedCount}
            </span>
          )}
          <span className="px-1.5 rounded-full text-[10px] bg-gray-200/60 text-gray-500">
            {tasks.length}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2">
          <div className="flex justify-end px-1 pb-1.5">
            <button
              onClick={() => onToggleAll(tasks)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              {allSelected ? "取消全選" : "全選"}
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow
                key={taskKey(task)}
                task={task}
                checked={selected.has(taskKey(task))}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DailyTasks() {
  const { data, status, error, refetch, completing, completeTasks } =
    useDailyTasks();

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

  const [selectedCat, setSelectedCat] = useState<MainCategory | null>(null);
  const [uncatOpen, setUncatOpen] = useState(false);

  // 多選集合：key = sourceFile:lineNumber，跨客戶/跨分類皆維持
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<CompleteTasksResult["failed"]>([]);

  // 使用者尚未手動點選前，跟隨資料算出的預設分類
  const activeCategory = selectedCat ?? defaultCategory;

  // 所有分類的任務攤平為 key -> task 對照，供標記完成時還原完整資料
  const taskByKey = useMemo(() => {
    const m = new Map<string, DailyTask>();
    if (data) {
      for (const c of Object.values(data.groups)) {
        for (const t of c) m.set(taskKey(t), t);
      }
    }
    return m;
  }, [data]);

  const toggleTask = (task: DailyTask) => {
    const key = taskKey(task);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 單一客戶全選／取消全選：作用於該客戶的所有待辦
  const toggleClientAll = (tasks: DailyTask[]) => {
    const keys = tasks.map(taskKey);
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const handleConfirm = async () => {
    // 只送仍存在於當前資料中的選取項
    const tasks = Array.from(selected)
      .map((k) => taskByKey.get(k))
      .filter((t): t is DailyTask => Boolean(t))
      .map((t) => ({
        sourceFile: t.sourceFile,
        lineNumber: t.lineNumber,
        text: t.text,
      }));
    if (tasks.length === 0) {
      setConfirming(false);
      return;
    }
    try {
      const result = await completeTasks(tasks);
      setFailed(result.failed ?? []);
      setSelected(new Set()); // 成功後清空選取（refetch 由 hook 處理）
    } catch {
      setFailed([]);
      // 寫回整體失敗，沿用面板提示
    } finally {
      setConfirming(false);
    }
  };

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
  const clientGroups = groupByClient(activeTasks);
  const uncategorized = (data.groups.uncategorized ?? []).slice().sort(byDue);
  const uncatCount = data.counts.uncategorized;
  const selectedCount = selected.size;

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
              onClick={() => setSelectedCat(c)}
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

      {/* 標記完成動作列：有選取才顯示，含 inline 二次確認 */}
      {selectedCount > 0 && (
        <div className="mb-3 rounded-xl bg-indigo-50/60 border border-indigo-100/70 px-3 py-2">
          {confirming ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700">
                確定標記 {selectedCount} 筆完成？
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleConfirm}
                  disabled={completing}
                  className="glass-button-active rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium disabled:opacity-50"
                >
                  {completing ? "處理中…" : "確認"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={completing}
                  className="glass-button rounded-lg px-3 py-1.5 text-xs text-gray-500 disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">
                已選取 {selectedCount} 筆
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelected(new Set())}
                  className="glass-button rounded-lg px-3 py-1.5 text-xs text-gray-500"
                >
                  清除
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="glass-button-active rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium"
                >
                  標記完成 ({selectedCount})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 部分失敗提示 */}
      {failed.length > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50/70 border border-amber-200/70 px-3 py-2 text-xs text-amber-800">
          <div className="font-medium mb-1">有 {failed.length} 筆未成功：</div>
          <ul className="flex flex-col gap-0.5">
            {failed.map((f) => (
              <li key={`${f.sourceFile}:${f.lineNumber}`}>
                {f.sourceFile.replace(/\.md$/, "")}（第 {f.lineNumber} 行）—
                {humanizeReason(f.reason)}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setFailed([])}
            className="mt-1.5 text-amber-700 underline underline-offset-2"
          >
            知道了
          </button>
        </div>
      )}

      {/* 選中分類的待辦：按客戶分組、可摺疊、預設收合 */}
      {clientGroups.length > 0 ? (
        <div className="flex flex-col gap-2">
          {clientGroups.map((g) => (
            <ClientGroup
              key={`${activeCategory}:${g.client}`}
              client={g.client}
              tasks={g.tasks}
              selected={selected}
              onToggle={toggleTask}
              onToggleAll={toggleClientAll}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4 text-center">
          這個分類目前沒有待辦。
        </p>
      )}

      {/* 未分類：維持既有收合語意（平列） */}
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
              {uncategorized.map((task) => (
                <TaskRow
                  key={`uncat-${taskKey(task)}`}
                  task={task}
                  checked={selected.has(taskKey(task))}
                  onToggle={toggleTask}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
