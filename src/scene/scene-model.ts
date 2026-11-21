export interface SceneVariant {
  id: string
  name: string
  sku: string
  category?: string
  available?: number
}

export const zoneLabels = {
  product: { title: 'สินค้า', detail: 'ดูสต็อก ต้นทุน และผลกระทบจากโปรโมชัน' },
  picking: { title: 'รอหยิบ', detail: 'เปิดคิวออเดอร์ที่ชำระแล้วและใบหยิบสินค้า' },
  packing: { title: 'โต๊ะแพ็ก', detail: 'ดูวัสดุและกำลังแพ็กที่เหลือ' },
  staging: { title: 'รอขนส่งรับ', detail: 'ดูพัสดุที่แพ็กเสร็จและรอขนส่งรับ' },
  carrier: { title: 'ขนส่ง', detail: 'ดูสถานะพัสดุและเลขติดตาม' },
  returns: { title: 'ของคืน', detail: 'ติดตามพัสดุที่กำลังกลับมาและรอตรวจ' },
  cashier: { title: 'การเงิน', detail: 'ดูยอดขาย เงินรับ และรายจ่ายของร้าน' },
  insights: { title: 'ผลการขาย', detail: 'ดูยอดขายและสุขภาพบัญชีร้าน' },
  computer: { title: 'จัดการร้าน', detail: 'ดูการตั้งค่าและบริการของร้าน' },
}

export type SceneZone = keyof typeof zoneLabels
export type SceneLabels = Partial<Record<SceneZone, { title: string; detail: string }>>
export type Position = [x: number, y: number, z: number]

export interface ShopSceneProps {
  variants: readonly SceneVariant[]
  selectedVariantId?: string
  onOpen: (zone: SceneZone, variantId?: string) => void
  labels?: SceneLabels
  resetKey?: number
  fullScreen?: boolean
  active?: boolean
}

interface ProductTarget {
  zone: 'product'
  variant: SceneVariant
}

interface WorkflowTarget {
  zone: Exclude<SceneZone, 'product'>
}

export type SceneTarget = ProductTarget | WorkflowTarget

export const workflowPositions: Record<WorkflowTarget['zone'], Position> = {
  picking: [-3.75, 1.56, 1.0],
  packing: [3.2, 1.61, 0.36],
  staging: [3.26, .79, 2.30],
  carrier: [5.14, 1.29, 4.98],
  returns: [5.58, 1.18, 1.55],
  cashier: [-4.6, 1.25, 3.46],
  insights: [5.06, 3.20, -3.54],
  computer: [4.56, 1.61, -1.43],
}

export const workflowZones: readonly WorkflowTarget['zone'][] = [
  'picking', 'packing', 'staging', 'carrier', 'returns', 'cashier', 'insights', 'computer',
]

export function describeTarget(target: SceneTarget, labels?: SceneLabels) {
  if (target.zone === 'product') {
    const { sku, name, available } = target.variant
    return {
      title: sku,
      detail: `${available === undefined ? name : `${name} · ขายได้ ${available} ชิ้น`}. ดูสต็อกและวางแผน`,
    }
  }
  const definition = zoneLabels[target.zone]
  const live = labels?.[target.zone]
  return live ? { title: live.title, detail: `${live.detail}. ${definition.detail}` } : definition
}
