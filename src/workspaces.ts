import { workspaceNames, stations as shopStations } from '../shared/shop-workspaces.mjs';

export { workspaceNames };

export type Page = keyof typeof workspaceNames;

export const navigation = [
  { group: 'พื้นที่ทำงาน', items: ['overview', 'scene', 'cases', 'inbox', 'dot'] },
  { group: 'จัดการร้านค้า', items: ['stock', 'supplies', 'orders', 'finance'] },
  { group: 'วิเคราะห์และวางแผน', items: ['plan', 'insights', 'briefs', 'research'] },
  { group: 'ตั้งค่า', items: ['settings', 'memory'] },
] as const satisfies ReadonlyArray<{ group: string; items: readonly Page[] }>;

export const stations = shopStations satisfies Record<string, { page: Page; name: string }>;
