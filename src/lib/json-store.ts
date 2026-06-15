import { writeFile, rename } from "fs/promises";

// 原子寫入 JSON：先寫到同目錄的暫存檔，再 rename 蓋過目標。
// rename 在同一檔案系統內是原子操作，避免寫到一半當掉造成半截壞檔。
export async function writeJsonAtomic(
  path: string,
  data: unknown,
): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, path);
}

// 以 key 為單位串接非同步操作，序列化同一資源的「讀-改-寫」，
// 避免兩個 request 各自讀到舊狀態、各自寫回造成互相覆蓋（掉資料）。
const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  // 不論前一個成功或失敗都接著執行下一個
  const next = prev.then(fn, fn);
  // 鏈結用的 promise 永不 reject，確保佇列不會因單次失敗而中斷
  chains.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next as Promise<T>;
}
