"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// 與 localStorage 同步的 state。
// 初始 render 用 initial（避免 SSR/hydration 不一致），mount 後才讀取儲存值，
// 之後任何變更寫回。首次寫入被跳過，避免用預設值覆寫掉已存的偏好。
export function useLocalStorageState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const isFirstWrite = useRef(true);

  // mount 後讀取一次（在 client 執行，避免 hydration mismatch）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // 刻意在 mount 後才同步 localStorage 值：初次 render 必須用 initial 才不會
      // 造成 SSR/hydration 不一致，因此這裡的 setState 是必要的外部狀態同步。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 忽略毀損的儲存值 */
    }
  }, [key]);

  // 值變更時寫回，但跳過首次（此時尚未套用儲存值，寫入會覆寫成預設值）
  useEffect(() => {
    if (isFirstWrite.current) {
      isFirstWrite.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 忽略配額或隱私模式錯誤 */
    }
  }, [key, value]);

  return [value, setValue];
}
