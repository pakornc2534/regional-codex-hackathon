import { create } from "zustand";
import { createContext, useContext } from "react";
import type { ReadModel } from "../server/read-model";
import type { Command } from "../server/operations";
import type { PlanInputs, PlanResult } from "../shared/planner";
import type { Zone } from "../shared/model";
export type Page =
  | "overview"
  | "gallery"
  | "cases"
  | "inbox"
  | "stock"
  | "supplies"
  | "shipping"
  | "planning"
  | "rehearsal"
  | "brief"
  | "memory";
export const pageNames: Record<Page, string> = {
  overview: "ภาพรวมร้าน",
  gallery: "ร้าน 3D",
  cases: "เคสที่ต้องตัดสินใจ",
  inbox: "แชทลูกค้า",
  stock: "สต็อกกลาง",
  supplies: "วัสดุแพ็ก",
  shipping: "ส่งของ",
  planning: "ลองปรับแผน",
  rehearsal: "ซ้อมแคมเปญใหญ่",
  brief: "บรีฟประจำวัน",
  memory: "ความจำและกฎของร้าน",
};
export const ui = create<{
  page: Page;
  selected: string;
  caseId: string;
  inbox: string;
  zone: Zone | null;
  planner: boolean;
  manager: boolean;
  nav: boolean;
  drafts: Record<string, PlanInputs>;
  result: PlanResult | null;
  change: (v: Partial<Omit<ReturnType<typeof getUI>, "change">>) => void;
}>((set) => ({ ...getUI(), change: (v) => set(v) }));
function getUI() {
  return {
    page: "overview" as Page,
    selected: "sim-v1",
    caseId: "sim-case-1",
    inbox: "sim-inbox-1",
    zone: null as Zone | null,
    planner: false,
    manager: false,
    nav: false,
    drafts: {} as Record<string, PlanInputs>,
    result: null as PlanResult | null,
  };
}
export const go = (page: Page) =>
  ui.getState().change({ page, zone: null, planner: false, nav: false });
export type Payload = Command extends infer T
  ? T extends unknown
    ? Omit<T, "runId" | "version" | "key">
    : never
  : never;
export async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(
    url,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok) throw Error(data.error ?? "ติดต่อร้านไม่ได้");
  return data;
}
export const StoreContext = createContext<{
  s: ReadModel;
  cmd: (
    payload: Payload,
    scope?: { runId: string; version: number },
  ) => Promise<boolean>;
  ask: (text: string, room?: string, extra?: object) => Promise<boolean>;
  report: (e: unknown) => void;
  refresh: () => Promise<void>;
  busy: boolean;
} | null>(null);
export const useShop = () => useContext(StoreContext)!;
