import { expect, it } from "vitest";
import { breakEven, calculatePlan } from "../src/shared/planner";
import { seed } from "../src/server/simulator";
it("S5 uses the discounted margin for both break-even targets", () => {
  expect(breakEven(6400, 30000, 50000, 5, 0)).toEqual({
    recover: 5,
    total: 13,
    additional: 8,
  });
});
it("S6 and S8 allocate actual competing orders and retain uncapped demand", () => {
  const s = seed("test"),
    r = calculatePlan(s, { variantId: "sim-v1" });
  expect([
    r.m,
    r.stock,
    r.pos,
    r.material,
    r.otherUnits,
    r.packing,
    r.baselineUnits,
    r.demand,
    r.units,
    r.baseline,
    r.contribution,
    r.gain,
    r.lowestCash,
  ]).toEqual([
    17935, 404, 3, 244, 57, 25, 17, 19, 19, 304895, 310765, 5870, 2970000,
  ]);
  expect(r.impact.map((n) => n.status)).toEqual(["ตึง", "พอ", "พอ", "พอ", "พอ"]);
  const limited = calculatePlan(s, { variantId: "sim-v1", capacity: 20 });
  expect([
    limited.queueOver,
    limited.units,
    limited.impact[3].need,
    limited.bottleneck,
  ]).toEqual([18, 0, 19, "pick"]);
});
it("S7 keeps explicit zero and unknown values distinct", () => {
  const s = seed("test");
  s.variants[0].cost = null;
  const r = calculatePlan(s, { variantId: "sim-v1", cash: null, capacity: 0 });
  expect([
    r.m,
    r.contribution,
    r.targets.recover,
    r.lowestCash,
    r.units,
  ]).toEqual([null, null, null, null, 0]);
  expect(calculatePlan(s, { variantId: "sim-v1", cash: 0 }).lowestCash).toBe(
    -30000,
  );
});
