import { facts, unpacked } from "../shared/facts";
import type { Shop, PrivateStore } from "../shared/model";
import { risk, score } from "./manager-controller";
import { orderView } from "./fulfillment";
import type { Manager } from "./ai-bridge";
export function readModel(
  s: Shop,
  p: PrivateStore,
  ai: Manager["status"],
  shared: boolean,
) {
  const f = facts(s);
  const cases = s.cases
    .map((c) => ({ ...c, risk: risk(s, c, f) }))
    .sort(
      (a, b) =>
        (b.risk.value ?? -1) - (a.risk.value ?? -1) ||
        (a.deadline ?? "z").localeCompare(b.deadline ?? "z"),
    );
  return {
    runId: s.runId,
    revision: s.revision,
    clock: s.clock,
    name: s.name,
    mode: s.mode,
    source: "simulated",
    observedAt: s.clock,
    period: { from: f.week, to: f.end },
    complete: true,
    shared,
    defaults: s.defaults,
    ...f,
    cases,
    campaigns: s.campaigns.map((a) => ({
      id: a.id,
      variantIds: a.variantIds,
      budget: a.budget,
      status: a.status,
      spend: a.spend,
      clicks: a.clicks,
      revenue: a.attributedOrderIds.reduce(
        (sum, id) => sum + (s.orders.find((o) => o.id === id)?.paidAmount ?? 0),
        0,
      ),
    })),
    sync: s.sync,
    conversations: s.conversations.map((t) => ({
      ...t,
      messages: t.messages.slice(-30),
    })),
    returns: s.returns,
    policies: s.policies,
    proposals: s.proposals.slice(-30),
    receipts: s.receipts.slice(-25),
    activity: s.activity.slice(-20),
    movements: s.movements.slice(-40),
    briefs: s.briefs.slice(-7),
    paused: s.paused,
    ack: s.ack,
    owner: {
      memories: p.memories.slice(-50),
      chat: p.chat.slice(-65),
      plans: p.plans.slice(-10),
      rehearsals: p.rehearsals.slice(-10),
    },
    score: score(s),
    ai,
    fulfillment: Object.fromEntries(
      ["waiting", "packing", "ready", "picked", "transit", "delivered"].map(
        (stage) => {
          const os = s.orders.filter(
            (o) => o.channel === "online" && o.paid && o.stage === stage,
          );
          return [
            stage,
            { orders: os.length, units: os.reduce((a, o) => a + o.qty, 0) },
          ];
        },
      ),
    ),
    recent: s.orders
      .filter((o) => unpacked(o) || o.stage === "ready")
      .sort(
        (a, b) =>
          (a.prepareBy ?? "").localeCompare(b.prepareBy ?? "") ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 65)
      .map(orderView),
  };
}
export type ReadModel = ReturnType<typeof readModel>;
