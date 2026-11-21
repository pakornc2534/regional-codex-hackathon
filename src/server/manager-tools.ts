import { z } from "zod";
import { facts } from "../shared/facts";
import { calculatePlan, planSchema } from "../shared/planner";
import { rehearse, rehearsalSchema, presets } from "../shared/rehearsal";
import {
  actions,
  type Action,
  type Shop,
  type PrivateStore,
  type Receipt,
} from "../shared/model";
import {
  allowed,
  covers,
  perform,
  policyOf,
  recordActivity,
  risk,
} from "./manager-controller";
import { findItem, uid } from "./fulfillment";
import { Conflict, Store } from "./persistence";
export const optionSchema = z.object({
  action: z.enum(Object.keys(actions) as [Action, ...Action[]]),
  text: z.string().min(1).max(900),
  reason: z.string().min(1).max(700),
  amount: z.number().int().nonnegative().optional(),
});
const definitions = {
  sim_get_context: {
    description:
      "Read scoped current facts, shop totals and conversation evidence.",
    schema: z.object({}),
  },
  sim_calculate_plan: {
    description:
      "Evaluate a read-only ad plan. All monetary inputs and outputs use integer satang.",
    schema: planSchema,
  },
  sim_calculate_rehearsal: {
    description:
      "Simulate a campaign on a fork and get calculator-issued option IDs.",
    schema: rehearsalSchema,
  },
  sim_propose_options: {
    description:
      "Attach up to three options to this case, or calculator-issued preparation IDs to the current rehearsal.",
    schema: z.object({
      options: z.array(optionSchema).min(1).max(3).optional(),
      preparationIds: z
        .array(z.enum(["capacity", "supplies", "both"]))
        .min(1)
        .max(3)
        .optional(),
    }),
  },
  sim_execute_approved: {
    description:
      "Execute an existing case option only if its stored owner decision or matching policy authorizes it.",
    schema: z.object({ proposalId: z.string(), optionId: z.string() }),
  },
};
export const modelTools = Object.entries(definitions).map(([name, t]) => {
  const parameters = z.toJSONSchema(t.schema, { target: "draft-7" });
  delete parameters.$schema;
  return {
    type: "function" as const,
    function: { name, description: t.description, parameters },
  };
});
export interface Room {
  room: string;
  variantId?: string;
  runId: string;
  version: number;
  rehearsal?: z.input<typeof rehearsalSchema>;
}
export function scopeContext(s: Shop, p: PrivateStore, r: Room) {
  const f = facts(s),
    c = s.cases.find((c) => c.id === r.room);
  if (!c && !["overview", "planning", "rehearsal"].includes(r.room))
    throw Error("ไม่พบห้องที่เลือก");
  const thread =
      c?.type === "reply" ? findItem(s.conversations, c.target) : null,
    scope = c
      ? s.orders.filter(
          (o) =>
            c.orderIds.includes(o.id) ||
            (thread && o.customerId === thread.customerId) ||
            (c.type === "ads" && o.variantId === c.variantId),
        )
      : s.orders;
  const sorted = [...scope].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const chosen = c
    ? Array.from(
        new Map(
          [
            ...sorted.slice(0, 50),
            ...sorted.filter(
              (o) =>
                c.orderIds.includes(o.id) ||
                (thread && o.conversationId === thread.id),
            ),
          ].map((o) => [o.id, o]),
        ).values(),
      )
    : sorted.slice(0, 50);
  const selected = c?.variantId ?? r.variantId ?? s.variants[0].id;
  return {
    mode: s.mode,
    runId: s.runId,
    version: s.revision,
    clock: s.clock,
    source: "simulated",
    currency: "satang",
    shop: s.name,
    selectedVariant: findItem(f.variants, selected),
    case: c
      ? {
          ...c,
          risk: risk(s, c, f),
          policy: s.policies.filter((p) => p.scope === c.target),
        }
      : null,
    conversation: thread,
    campaign:
      c?.type === "ads"
        ? s.campaigns
            .filter((a) => a.id === c.target)
            .map((a) => ({
              ...a,
              variantStocks: a.variantIds.map((id) => findItem(f.variants, id)),
            }))
        : null,
    aggregates: {
      orders: f.total,
      paid: f.paid,
      sales: f.sales,
      weekCount: f.weekCount,
      weekSales: f.weekSales,
      queue: f.queue,
      capacity: s.defaults.capacity,
    },
    orders: chosen.map(({ id, qty, variantId, stage, paidAmount }) => ({
      id,
      qty,
      variantId,
      stage,
      paidAmount,
    })),
    contextCoverage: {
      total: scope.length,
      returned: chosen.length,
      omitted: scope.length - chosen.length,
      selection:
        "Latest 50 in scope plus linked orders. Store totals use every order.",
      aggregates: "aggregates",
    },
    ownerMemory: c?.type === "reply" ? [] : p.memories.slice(-12),
    savedPlans: r.room === "planning" ? p.plans.slice(-2) : [],
    campaignDates: presets(s),
    proposals: s.proposals.filter((pr) => pr.caseId === r.room).slice(-2),
  };
}
export async function useTool(
  store: Store,
  r: Room,
  name: string,
  args: unknown,
  signal?: AbortSignal,
) {
  const def = definitions[name as keyof typeof definitions];
  if (!def) throw Error("ไม่มีเครื่องมือนี้");
  return store.run((s, p) => {
    if (signal?.aborted) throw Error("ยกเลิกงานแล้ว");
    if (r.runId !== s.runId || r.version !== s.revision)
      throw new Conflict("ข้อมูลเปลี่ยนแล้ว กรุณาวิเคราะห์ใหม่");
    const c = s.cases.find((c) => c.id === r.room);
    if (
      s.paused ||
      (c?.type === "reply" &&
        findItem(s.conversations, c.target).owner === "human")
    )
      throw Error("เจ้าของหยุดผู้จัดการหรือรับช่วงแล้ว");
    const zone =
      c?.type === "prepare"
        ? "pick"
        : name === "sim_calculate_plan" || name === "sim_calculate_rehearsal"
          ? "dashboard"
          : name === "sim_get_context"
            ? "shelf"
            : "computer";
    const event = (
      status:
        | "reading"
        | "proposed"
        | "verified"
        | "uncertain"
        | "failed" = "reading",
    ) =>
      recordActivity(
        s,
        name,
        c?.target ?? r.variantId ?? s.id,
        r.room,
        status,
        zone,
      );
    if (name === "sim_get_context") {
      event();
      return scopeContext(s, p, r);
    }
    if (name === "sim_calculate_plan" || name === "sim_calculate_rehearsal") {
      if (c) throw Error("เปิดเครื่องคำนวณในห้องวางแผน");
      event();
      return name === "sim_calculate_plan"
        ? calculatePlan(s, planSchema.parse(args))
        : rehearse(s, rehearsalSchema.parse(args));
    }
    if (name === "sim_propose_options") {
      const a = definitions.sim_propose_options.schema.parse(args);
      if (r.room === "rehearsal" && a.preparationIds && r.rehearsal) {
        const calc = rehearse(s, r.rehearsal);
        const options = calc.options.filter((o) =>
          a.preparationIds!.includes(o.id),
        );
        if (options.length !== new Set(a.preparationIds).size)
          throw Error("ไม่พบทางเลือกของการซ้อมรอบนี้");
        event("proposed");
        return { options, sourceVersion: s.revision, ownerMustSave: true };
      }
      if (
        !c ||
        c.status !== "open" ||
        !a.options ||
        a.options.some((o) => !allowed(c, o.action))
      )
        throw Error("ทางเลือกอยู่นอกขอบเขตของเคส");
      const prop = {
        id: uid(),
        caseId: c.id,
        options: a.options.map((o) => ({ ...o, id: uid() })),
        version: s.revision,
        source: "ai" as const,
        status: "proposed" as const,
      };
      s.proposals
        .filter((pr) => pr.caseId === c.id && pr.status === "proposed")
        .forEach((pr) => (pr.status = "stale"));
      s.proposals.push(prop);
      event("proposed");
      return prop;
    }
    if (!c) throw Error("ต้องเลือกเคสก่อนลงมือ");
    const a = definitions.sim_execute_approved.schema.parse(args),
      pr = findItem(s.proposals, a.proposalId),
      o = findItem(pr.options, a.optionId);
    if (pr.caseId !== c.id) throw Error("เคสไม่ตรงกับข้อเสนอ");
    const key = pr.id + "/" + o.id,
      previous = s.receipts.find((rc) => rc.id === key);
    if (previous) return previous;
    if (
      pr.version !== s.revision ||
      pr.status !== "proposed" ||
      !covers(s, c, o, policyOf(s, c, o.action))
    )
      throw new Conflict("ต้องรอเจ้าของเลือก หรือข้อมูลเปลี่ยนแล้ว");
    const receipt: Receipt = {
      id: key,
      hash: key,
      at: s.clock,
      runId: s.runId,
      status: "executing",
      type: "autonomous",
      target: c.target,
      level: 1,
      before: null,
      after: null,
      verification: null,
    };
    pr.status = perform(s, c, o, false, receipt);
    s.receipts.push(receipt);
    s.revision++;
    r.version = s.revision;
    event(
      pr.status === "verified"
        ? "verified"
        : pr.status === "failed"
          ? "failed"
          : "uncertain",
    );
    return receipt;
  });
}
