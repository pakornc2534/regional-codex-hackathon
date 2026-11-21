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
  await expect(
    page.getByRole("button", { name: "ยิงแอด", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "ลองปรับแผน");
  await page.getByRole("button", { name: "ดูสมมติฐานทั้งหมด" }).click();
  await page.getByRole("spinbutton", { name: "กำลังแพ็ก (ชิ้น/วัน)" }).fill("20");
  await page.getByRole("button", { name: "ประเมินแผนนี้" }).click();
  await expect(page.locator("main")).toContainText("คิวเดิมเกินกำลังแพ็ก 18 ชิ้น");
  await page.getByRole("button", { name: /กำลังแพ็ก.*คอขวด/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "โต๊ะแพ็ก" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "พัสดุที่กำลังแพ็ก" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "วัสดุแพ็ก" }).click();
  await expect(page.getByRole("dialog").getByText("รับวัสดุเข้าร้าน")).toBeVisible();
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
      await page.getByRole("tab", { name: "การเคลื่อนไหว" }).click();
      await expect(
        page
          .getByRole("dialog")
          .getByText("ขนส่งรับแล้ว", { exact: true })
          .first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );

test("human packing docs, scoped inbox and readback after a lost command response", async ({
  page,
  request,
}) => {
  await reset(page);
  await nav(page, "ส่งของ");
  const order = page
    .getByRole("row")
    .filter({
      has: page.getByRole("button", { name: "เตรียมใบปะหน้า", exact: true }),
    })
    .first();
  await order
    .getByRole("button", { name: "เตรียมใบปะหน้า", exact: true })
    .click();
  await page.getByRole("button", { name: "ดูใบหยิบและใบปะหน้า" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("เลขพัสดุอ้างอิง");
  await page.keyboard.press("Escape");
  await nav(page, "แชทลูกค้า");
  await page
    .getByRole("button", { name: "เปิดข้อความรับเรื่อง", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "ข้อความสำหรับแชทจำลอง" })
    .fill("ยังเหลือไหมคะ");
  await page.getByRole("button", { name: "จำลองลูกค้าส่งข้อความ" }).click();
  await expect(page.locator("main [data-slot=bubble-content]")).toHaveCount(3);
  await nav(page, "สต็อกกลาง");
  await page.getByRole("textbox", { name: "ค้นหาสต็อก" }).fill("sonic");
  await page.getByRole("button", { name: /SONIC.*พวงกุญแจ/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByText("จำลองการขายหน้าร้านหรือรับออเดอร์ออนไลน์", { exact: true })
    .click();
  await page.route("**/api/sim/command", async (route) => {
    if (route.request().postDataJSON().type === "pos") {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "ขายหน้าร้าน", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/state")).json()).variants.find(
          (v: { sku: string }) => v.sku === "SONIC",
        ).available,
    )
    .toBe(0);
  await expect(page.locator(".command-error")).toHaveCount(0);
  expect(
    (await (await request.get("/api/state")).json()).receipts.filter(
      (r: { type: string }) => r.type === "pos",
    ),
  ).toHaveLength(1);
});

test("S18 every gallery workstation opens its matching dialog and closes with Escape", async ({
  page,
}) => {
  await reset(page);
  await nav(page, "ร้าน 3D");
  await page
    .locator(".gallery-tools summary, .store-gallery summary")
    .first()
    .click();
  const controls = page.getByRole("navigation", { name: "จุดทำงานในร้าน" });
  for (const label of [
    "ชั้นสินค้า",
    "คิวหยิบสินค้า",
    "โต๊ะแพ็ก",
    "จุดรอขนส่ง",
    "รถขนส่ง",
    "พื้นที่รับคืน",
    "เคาน์เตอร์เงิน",
    "กระดานร้าน",
    "โต๊ะผู้จัดการ",
  ]) {
    const b = controls.getByRole("button", { name: label, exact: true });
    await b.focus();
    await page.keyboard.press("Enter");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
