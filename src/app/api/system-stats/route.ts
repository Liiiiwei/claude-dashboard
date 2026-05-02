import { NextResponse } from "next/server";
import { execSync } from "child_process";
import os from "os";

export const dynamic = "force-dynamic";

// 用 os.cpus() 兩次採樣計算 CPU 使用率（100ms 間隔）
function sampleCpuTimes() {
  return os.cpus().map((cpu) => {
    const times = cpu.times;
    const idle = times.idle;
    const total = Object.values(times).reduce((a, b) => a + b, 0);
    return { idle, total };
  });
}

async function getCpuUsage(): Promise<number> {
  const sample1 = sampleCpuTimes();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const sample2 = sampleCpuTimes();

  let totalIdle = 0;
  let totalDiff = 0;
  for (let i = 0; i < sample1.length; i++) {
    const idleDiff = sample2[i].idle - sample1[i].idle;
    const totalDiffCore = sample2[i].total - sample1[i].total;
    totalIdle += idleDiff;
    totalDiff += totalDiffCore;
  }

  if (totalDiff === 0) return 0;
  return Math.round(((totalDiff - totalIdle) / totalDiff) * 100);
}

export async function GET() {
  try {
    // CPU 使用率（os.cpus() 雙次採樣，避免 top 的同步阻塞）
    let cpuUsage = 0;
    try {
      cpuUsage = await getCpuUsage();
    } catch {
      /* 靜默 */
    }

    // 記憶體（透過 vm_stat + sysctl）
    let memTotal = 0;
    let memUsed = 0;
    let memPercent = 0;
    try {
      const totalBytes = parseInt(
        execSync("sysctl -n hw.memsize", {
          encoding: "utf-8",
          timeout: 3000,
        }).trim(),
        10,
      );
      memTotal = Math.round(totalBytes / 1024 / 1024 / 1024); // GB

      const vmOutput = execSync("vm_stat", {
        encoding: "utf-8",
        timeout: 3000,
      });
      // 取得 page size
      const pageSizeMatch = vmOutput.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384;

      const getValue = (key: string) => {
        const match = vmOutput.match(new RegExp(`${key}:\\s+(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      };

      const free = getValue("Pages free");
      const inactive = getValue("Pages inactive");
      const speculative = getValue("Pages speculative");
      const totalPages = totalBytes / pageSize;
      const availablePages = free + inactive + speculative;

      memUsed = Math.round(
        ((totalPages - availablePages) * pageSize) / 1024 / 1024 / 1024,
      ); // GB
      memPercent = Math.round(
        ((totalPages - availablePages) / totalPages) * 100,
      );
    } catch {
      /* 靜默 */
    }

    return NextResponse.json({
      cpu: cpuUsage,
      mem: { total: memTotal, used: memUsed, percent: memPercent },
    });
  } catch {
    return NextResponse.json({ error: "取得系統資訊失敗" }, { status: 500 });
  }
}
