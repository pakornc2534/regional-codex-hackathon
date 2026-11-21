export const workspaceNames = /** @type {const} */ ({
  overview: 'ภาพรวมร้านค้า',
  scene: 'ร้าน 3D',
  cases: 'เคสของร้าน',
  inbox: 'แชทลูกค้า',
  dot: 'แจ้งเตือน Dot',
  stock: 'สต็อกกลาง',
  supplies: 'วัสดุแพ็ก',
  orders: 'ส่งของและของคืน',
  finance: 'การเงิน',
  plan: 'ลองปรับแผน',
  insights: 'ยอดขายและสุขภาพบัญชี',
  briefs: 'บรีฟข่าว',
  research: 'สินค้าและคู่แข่ง',
  settings: 'จัดการร้าน',
  memory: 'ความจำและกฎ',
})

export const stations = /** @type {const} */ ({
  product: { page: 'stock', name: 'สินค้าบนชั้น' },
  picking: { page: 'orders', name: 'คิวหยิบสินค้า' },
  packing: { page: 'orders', name: 'โต๊ะแพ็กของ' },
  staging: { page: 'orders', name: 'จุดรอขนส่งรับ' },
  carrier: { page: 'orders', name: 'ลานขนส่ง' },
  returns: { page: 'orders', name: 'จุดรับของคืน' },
  cashier: { page: 'finance', name: 'เคาน์เตอร์การเงิน' },
  insights: { page: 'insights', name: 'จอผลการขาย' },
  computer: { page: 'settings', name: 'โต๊ะจัดการร้าน' },
})
