import { type Activity, type Zone, statuses, zones } from "../../shared/model";

export interface GalleryVariant {
  id: string;
  sku: string;
  name: string;
  available: number;
  category?: string;
  productId?: string;
}
export interface GalleryProps {
  variants: GalleryVariant[];
  selected: string;
  onSelect: (id: string) => void;
  onOpen: (zone: Zone) => void;
  activity: Activity | null;
  impact?: Zone[];
  bottleneck?: Zone | null;
  compact?: boolean;
}
export type Pick = { zone: Zone; variantId?: string };
export type GalleryMode = "2d" | "3d";
export const purposes: Record<Zone, string> = {
  shelf: "ตรวจสต็อกและวางแผนโฆษณา",
  pick: "ตรวจคิวหยิบและเตรียมใบปะหน้า",
  pack: "ตรวจวัสดุและยืนยันการแพ็ก",
  pickup: "ตรวจพัสดุที่แพ็กเสร็จแล้ว",
  carrier: "ติดตามพัสดุที่ขนส่งรับแล้ว",
  returns: "ตรวจสถานะพัสดุส่งคืน",
  cash: "ดูยอดขาย เงินโอน และเงินสำหรับวางแผน",
  dashboard: "ดูยอดขายเจ็ดวันและผลงานผู้จัดการ",
  computer: "ดูสิทธิ์และกิจกรรมล่าสุดของผู้จัดการ",
};
export const positions: Record<Zone, [number, number, number]> = {
  shelf: [-0.55, 0, 1.0],
  pick: [-3.9, 0, 2.25],
  pack: [2.65, 0, -0.28],
  pickup: [1.55, 0, 2.19],
  carrier: [4.1, 0, 2.12],
  returns: [4.51, 0, -1.65],
  cash: [-3.68, 0, 0.05],
  dashboard: [3.85, 1.8, -2.95],
  computer: [0.87, 0, -2.15],
};
const toolLabels: Record<string, string> = {
  sim_get_context: "กำลังตรวจข้อมูล",
  sim_calculate_plan: "กำลังคำนวณแผนโฆษณา",
  sim_calculate_rehearsal: "กำลังซ้อมแคมเปญ",
  sim_propose_options: "กำลังเตรียมทางเลือก",
  sim_execute_approved: "กำลังทำตามที่อนุมัติ",
};
export function statusText(event: Activity | null, variants: GalleryVariant[]) {
  if (!event) return "ผู้จัดการอยู่ที่โต๊ะ";
  const product = variants.find(
    (v) => v.id === event.target || v.sku === event.target,
  );
  const verb =
    event.status === "reading"
      ? (toolLabels[event.tool] ?? statuses.reading)
      : statuses[event.status];
  return verb + " · " + (product?.sku ?? zones[event.zone]);
}

export interface CameraPose {
  position: [number, number, number];
  scale: number;
  reset: number;
}
