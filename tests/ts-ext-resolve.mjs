// 測試用模組解析 hook：
// 專案原始碼採 extensionless 相對匯入（例如 import ... from "./config"），
// Next 的打包器能解析，但 Node 原生 ESM（--experimental-strip-types）要求明確副檔名。
// 這個 hook 在解析失敗時補上 .ts 重試，讓測試能直接載入原始 lib 模組而不必改動原始碼。
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // 解析失敗且無副檔名時，依序補上 .ts（專案原始碼）與 .js（如 next/server，
    // Next 套件未提供 exports map，Node 無法自動補副檔名）重試。
    const hasExt = /\.[a-zA-Z0-9]+$/.test(specifier);
    if (!hasExt) {
      for (const ext of [".ts", ".js"]) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {
          // 換下一個副檔名
        }
      }
    }
    throw err;
  }
}
