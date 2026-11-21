import { expect, it } from "vitest";
import { seed } from "../src/server/simulator";
import { facts } from "../src/shared/facts";
it("S1 reconciles complete order, channel, supply and stock checksums", () => {
  const s = seed("sim-test"),
    f = facts(s);
  expect(seed("sim-test")).toEqual(s);
  expect([
    new Set(s.variants.map((v) => v.productId)).size,
    s.variants.length,
    s.conversations.length,
    s.campaigns.length,
    s.cases.length,
  ]).toEqual([9, 13, 4, 4, 3]);
  expect([f.total, f.paid, f.sales, f.weekCount, f.weekSales, f.queue]).toEqual(
    [2658, 2657, 97441400, 600, 22105600, 38],
  );
  expect(f.trend.at(-1)).toMatchObject({ count: 26, sales: 973600 });
  expect(f.variants.map((v) => v.online)).toEqual([
    463, 715, 99, 71, 267, 183, 71, 43, 155, 127, 8, 1, 0,
  ]);
  expect(f.variants.map((v) => v.pos)).toEqual([
    64, 120, 36, 36, 64, 36, 0, 0, 36, 36, 0, 0, 0,
  ]);
  expect(
    [0, 1, 10].map((i) => [
      f.variants[i].physical,
      f.variants[i].reserved,
      f.variants[i].available,
    ]),
  ).toEqual([
    [420, 13, 407],
    [680, 15, 665],
    [2, 1, 1],
  ]);
  expect(f.supplies.map((v) => v.free)).toEqual([
    875, 247, 1018, 2043, 962, 129.3,
  ]);
});
