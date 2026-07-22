"use client";

import { useCallback, useState } from "react";
import { useToast } from "./ToastProvider";
import { useModalA11y } from "@/lib/useModalA11y";

interface Props {
  dirtyCount: number;
  onClose: () => void;
  // 提交成功後通知父層重新整理專案清單
  onCommitted: () => void;
}

// 批次 Git 提交對話框：對所有有變更的專案執行 git add -A && git commit。
// 從 Dashboard 抽出，縮小 Dashboard 重繪範圍；保留原本的 focus trap / Esc / 焦點還原。
export default function CommitDialog({
  dirtyCount,
  onClose,
  onCommitted,
}: Props) {
  const { toast } = useToast();
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);

  const handleClose = useCallback(() => {
    setCommitMsg("");
    onClose();
  }, [onClose]);

  // 批次提交對話框的 a11y（focus trap / Esc / 焦點還原）
  const dialogRef = useModalA11y(true, handleClose);

  const handleBatchCommit = useCallback(async () => {
    // 重入保護：提交中或訊息為空直接返回
    if (committing || !commitMsg.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch("/api/git-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMsg.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "批次提交失敗");
      const failed =
        data.results?.filter((r: { success: boolean }) => !r.success) || [];
      if (failed.length > 0) {
        toast(
          `已提交 ${data.committed} 個專案，${failed.length} 個失敗`,
          "error",
        );
      } else {
        toast(`已提交 ${data.committed} 個專案`, "success");
      }
      setCommitMsg("");
      onClose();
      onCommitted();
    } catch (err) {
      toast(err instanceof Error ? err.message : "批次提交失敗", "error");
    } finally {
      setCommitting(false);
    }
  }, [committing, commitMsg, toast, onClose, onCommitted]);

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="commit-dialog-title"
        className="glass rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="commit-dialog-title"
          className="text-lg font-bold text-gray-800 mb-1"
        >
          批次 Git 提交
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          將對 {dirtyCount} 個有變更的專案執行 git add -A && git commit
        </p>
        <input
          type="text"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleBatchCommit()}
          placeholder="輸入 commit 訊息..."
          aria-label="commit 訊息"
          disabled={committing}
          className="w-full bg-white/40 text-gray-700 rounded-xl px-4 py-3 border border-white/50 focus:border-amber-400 focus:outline-none mb-4 placeholder:text-gray-500 disabled:opacity-60"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm glass-button rounded-xl text-gray-600"
          >
            取消
          </button>
          <button
            onClick={handleBatchCommit}
            disabled={committing || !commitMsg.trim()}
            className="px-4 py-2 text-sm glass-amber rounded-xl disabled:opacity-50"
          >
            {committing ? "提交中..." : "確認提交"}
          </button>
        </div>
      </div>
    </div>
  );
}
