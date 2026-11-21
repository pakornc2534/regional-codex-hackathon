import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = process.env.SHOP_UI_TEST_URL;
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
  throw new Error('Set SHOP_UI_TEST_URL to an isolated local shop. This test starts a new simulator run.');
}
const directory = process.env.SHOP_SCREENSHOT_DIR || 'docs/screenshots';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 930 } });
const failures = [];
page.on('pageerror', error => failures.push(error.message));

async function navigate(name) {
  if (await page.getByRole('button', { name: 'เปิดเมนูร้าน' }).isVisible()) {
    await page.getByRole('button', { name: 'เปิดเมนูร้าน' }).click();
  }
  await page.getByRole('navigation').getByRole('button', { name, exact: typeof name === 'string' }).click();
}
try {
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: 'ภาพรวมร้านค้า', exact: true })).toBeVisible();
  await navigate('จัดการร้าน');
  await page.getByRole('button', { name: 'เริ่มรอบทดลองใหม่' }).click();
  await page.getByRole('button', { name: 'เริ่มรอบใหม่' }).click();
  await expect(page.getByText('฿221,056', { exact: true })).toBeVisible();
  await expect(page.getByText('600', { exact: true })).toBeVisible();
  await page.locator('canvas').waitFor({ timeout: 15000 });
  await expect(page.locator('.diorama').getByRole('button', { name: /การเงิน/ })).toBeVisible();
  await page.screenshot({ path: directory + '/overview-1440.png' });

  const robotButton = page.getByRole('button', { name: 'ROBOT · เหลือขาย 407 ชิ้น', exact: true });
  await robotButton.click();
  await page.getByRole('dialog').getByRole('button', { name: 'ยิงแอด', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'ยิงแอด', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'ยิงแอด', exact: true }).click();
  await page.getByRole('button', { name: 'ประเมินแผนนี้' }).click();
  await expect(page.getByText(/ถ้าขายเพิ่มจากปกติ 2 ชิ้นขึ้นไป รวมอย่างน้อย 19 ชิ้น/)).toBeVisible();
  await expect(page.getByText('25 ชิ้น', { exact: true })).toBeVisible();
  await page.screenshot({ path: directory + '/growth-1440.png' });

  await navigate(/^เคส/);
  await page.getByRole('button', { name: /ตอบลูกค้าเรื่อง Sonic/ }).click();
  await page.getByRole('button', { name: 'วิเคราะห์เคส' }).click();
  await expect(page.getByText('ข้อเสนอจากระบบจำลอง')).toBeVisible();
  await expect(page.locator('.desk-pause')).toBeEnabled();
  await page.getByRole('button', { name: 'ส่งข้อความนี้' }).first().click();
  await expect(page.getByRole('heading', { name: 'งานแบบนี้ครั้งหน้าให้ทำเองตามกฎ หรือถามทุกครั้ง?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await navigate('แชทลูกค้า');
  await expect(page.getByText(/มีพร้อมขาย 1 ชิ้น/)).toBeVisible();

  await navigate('สต็อกกลาง');
  await page.getByRole('textbox', { name: 'ค้นหาสินค้า' }).fill('ROBOT');
  await page.getByRole('button', { name: /โมเดลหุ่นยนต์/ }).click();
  await page.getByText('จำลองการขายสินค้านี้', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'จำนวน (ชิ้น)' }).fill('2');
  await page.getByRole('button', { name: 'รับออเดอร์ออนไลน์' }).click();
  await expect(page.getByRole('table').getByText('405', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await navigate('ส่งของและของคืน');
  await expect(page.getByText(/40 พัสดุ · 40 ชิ้น|39 พัสดุ · 40 ชิ้น/)).toBeVisible();
  await page.getByRole('button', { name: /ROBOT × 2/ }).click();
  await page.getByRole('button', { name: 'เตรียมใบปะหน้า' }).click();
  await expect(page.getByText(/SIM-LABEL-/)).toBeVisible();
  const savedAction = page.getByRole('status').filter({ hasText: 'บันทึกในร้านจำลองแล้ว' });
  await expect(savedAction).toBeVisible();
  await page.getByRole('button', { name: 'เริ่มแพ็ก' }).click();
  await expect(savedAction).toBeVisible();
  await page.getByRole('button', { name: 'ยืนยันว่าแพ็กแล้ว' }).click();
  await expect(page.getByText('38 พัสดุ · 38 ชิ้น')).toBeVisible();
  await expect(savedAction).toBeVisible();
  await page.getByRole('button', { name: 'จำลองขนส่งรับ' }).click();
  await expect(page.getByText(/เลขติดตามพัสดุ SIM-/)).toBeVisible();
  await navigate('วัสดุแพ็ก');
  await page.getByRole('button', { name: 'บันทึกวัสดุเข้าร้าน' }).click();
  await expect(page.getByRole('status').filter({hasText:'บันทึกในร้านจำลองแล้ว'})).toBeVisible();

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 847 });
    await navigate('ร้าน 3D');
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await page.locator('.flat-grid').getByRole('button', { name: /สต็อกกลาง/ }).press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: directory + '/mobile-' + width + '.png' });
    await page.keyboard.press('Escape');
  }
  expect(failures).toEqual([]);
  console.log('Browser passed: desktop and 390/360 px, 3D/2D, keyboard dialog stack, ROBOT growth, fixture response approval and readback, search, accepting/packing/shipping orders, and supplies.');
} finally {
  await browser.close();
}
