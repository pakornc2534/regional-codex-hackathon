import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs/promises";
const shots = "output/playwright";
async function reset(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "รีเซ็ตเดโม", exact: true }).click();
  await page.getByRole("button", { name: "ยืนยันรีเซ็ตเดโม" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function nav(page: Page, label: string) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const mobile = page.getByRole("button", { name: "เปิดเมนู", exact: true });
  if ((page.viewportSize()?.width ?? 1440) <= 760) await mobile.click();
  await page
    .getByRole("navigation")
    .filter({ visible: true })
    .getByRole("button", { name: label, exact: true })
    .click();
}
test.beforeAll(async () => {
  await fs.mkdir(shots, { recursive: true });
});
test("S6 S8 S18 open real gallery popups and evaluate the same planner as the API", async ({
  page,
  request,
}) => {
  await reset(page);
  await page.getByRole("button", { name: /สินค้าที่เลือก.*ROBOT/ }).click();
  const first = page.getByRole("dialog");
  await expect(first).toContainText("407");
  await first.getByRole("button", { name: "ยิงแอด", exact: true }).click();
  const top = page.getByRole("dialog").last();
  await expect(top.getByText("ผลประเมินแผน", { exact: true })).toHaveCount(0);
  await top.getByRole("button", { name: "ประเมินแผนนี้" }).click();
  await expect(top).toContainText("รวมอย่างน้อย 19 ชิ้น");
  await expect(top).toContainText("58.7");
  const s = await (await request.get("/api/state")).json(),
    res = await (
      await request.post("/api/sim/plan", {
        data: {
          runId: s.runId,
          version: s.revision,
          inputs: { variantId: "sim-v1" },
        },
      })
    ).json();
  expect(res.gain).toBe(5870);
  await top.getByRole("button", { name: "บันทึกแผน" }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/state")).json()).owner.plans.length,
    )
    .toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toContainText("ชั้นสินค้า");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "ลองปรับแผน");
  await page.getByRole("button", { name: "ดูสมมติฐานทั้งหมด" }).click();
  await page.getByRole("spinbutton", { name: "กำลังแพ็ก (ชิ้น/วัน)" }).fill("20");
  await page.getByRole("button", { name: "ประเมินแผนนี้" }).click();
  await expect(page.locator("main")).toContainText("คิวเดิมเกินกำลังแพ็ก 18 ชิ้น");
  await page.getByRole("button", { name: /กำลังแพ็ก.*คอขวด/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "ส่งของ" }),
  ).toBeVisible();
});
test("S11 S12 S19 S20 S21 shared reset, offline manager, brief, rehearsal and guided steps", async ({
  page,
  context,
  request,
}) => {
  await reset(page);
  const second = await context.newPage();
  await second.goto("/");
  const before = await (await request.get("/api/state")).json();
  await page.getByRole("button", { name: "เริ่มเดโม", exact: true }).click();
  await expect(page.getByText("เดโม 1 / 7")).toBeVisible();
  await expect
    .poll(async () => (await (await request.get("/api/state")).json()).runId)
    .not.toBe(before.runId);
  const stale = await request.post("/api/sim/command", {
    data: {
      type: "pos",
      target: "sim-v11",
      qty: 1,
      runId: before.runId,
      version: before.revision,
      key: "old-tab",
    },
  });
  expect(stale.status()).toBe(409);
  for (let i = 0; i < 6; i++)
    await page
      .getByRole("button", { name: "ถัดไป", exact: true })
      .first()
      .click();
  await page.getByRole("button", { name: "จบเดโม", exact: true }).click();
  await nav(page, "บรีฟประจำวัน");
  await page.getByRole("button", { name: "เดินเวลา 10 นาที" }).click();
  await expect(page.locator("main")).toContainText("2026-10-02");
  await expect(second.locator(".nav-clock")).toContainText("07:00");
  await nav(page, "ซ้อมแคมเปญใหญ่");
  await page.getByRole("button", { name: "ซ้อมแคมเปญ", exact: true }).click();
  await expect(page.locator("main")).toContainText("ก่อนเตรียมร้าน");
  await page.getByRole("button", { name: /เตรียมวัสดุและเพิ่มกำลังแพ็ก/ }).click();
  await expect(page.locator("main")).toContainText("หลังเตรียมร้าน");
  await page.getByRole("button", { name: "บันทึกแผนเตรียมร้าน" }).click();
  expect(await (await request.get("/api/ai/retry")).status()).toBe(404);
  await expect(page.locator(".desk-desktop")).toContainText(
    "ผู้จัดการ AI ยังไม่ได้เชื่อมต่อ",
  );
  await second.close();
});
for (const width of [1440, 390, 360])
  test(
    "Responsive, Thai labels and keyboard access at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: width > 1000 ? 960 : 844 });
      await reset(page);
      await page.getByRole("button", { name: "2D", exact: true }).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: shots + "/overview-" + width + ".png" });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: /สินค้าที่เลือก.*ROBOT/ }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await nav(page, "สต็อกกลาง");
      await page.getByRole("textbox", { name: "ค้นหาสต็อก" }).fill("sonic");
      await page.getByRole("button", { name: /SONIC.*พวงกุญแจ/ }).click();
      await expect(page.getByRole("dialog")).toContainText("SONIC");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );
