"use server";

import {
  getBestSellers,
  getDaySummary,
  getRecentDays,
  getZSummary,
  todayLocal,
} from "@/lib/server/reports";
import { requireOwner } from "@/lib/server/session";

export interface ReportData {
  date: string;
  summary: Awaited<ReturnType<typeof getDaySummary>>;
  week: Awaited<ReturnType<typeof getRecentDays>>;
  bestSellers: Awaited<ReturnType<typeof getBestSellers>>;
  z: Awaited<ReturnType<typeof getZSummary>>;
}

export async function fetchReport(
  dateStr?: string,
): Promise<{ ok: true; data: ReportData } | { ok: false; error: string }> {
  try {
    // Awaited on purpose: an un-awaited async guard resolves to a Promise
    // and the catch never fires (v1 security defect).
    await requireOwner();
  } catch {
    return { ok: false, error: "التقارير للمالك فقط." };
  }
  const date =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayLocal();
  const [summary, week, bestSellers, z] = await Promise.all([
    getDaySummary(date),
    getRecentDays(7, date),
    getBestSellers(date),
    getZSummary(date),
  ]);
  return { ok: true, data: { date, summary, week, bestSellers, z } };
}
