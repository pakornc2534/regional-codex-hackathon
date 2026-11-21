import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import PQueue from "p-queue";
import writeAtomic from "write-file-atomic";
import {
  type Shop,
  type PrivateStore,
  type StreamEvent,
} from "../shared/model";
import { seed } from "./simulator";
import { uid } from "./fulfillment";
export const emptyPrivate = (runId: string): PrivateStore => ({
  runId,
  memories: [],
  chat: [],
  plans: [],
  rehearsals: [],
});
async function optional<T>(name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(name, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
}
export function hash(payload: unknown) {
  const sorted = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(sorted)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.entries(x)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, sorted(v)]),
          )
        : x;
  return createHash("sha256")
    .update(JSON.stringify(sorted(payload)))
    .digest("hex");
}
export class Conflict extends Error {}
export class Store {
  readonly events = new EventEmitter();
  private readonly queue = new PQueue({ concurrency: 1 });
  private constructor(
    readonly dir: string,
    public shop: Shop,
    public owner: PrivateStore,
  ) {
    this.events.setMaxListeners(0);
  }
  static async open(dir: string) {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const journal = await optional<{ shop: Shop; owner: PrivateStore }>(
      path.join(dir, "pending.json"),
    );
    if (journal) {
      await writeAtomic(
        path.join(dir, "simulator.json"),
        JSON.stringify(journal.shop),
      );
      await writeAtomic(
        path.join(dir, "store.json"),
        JSON.stringify(journal.owner),
      );
      await fs.unlink(path.join(dir, "pending.json"));
    }
    const s = await optional<Shop>(path.join(dir, "simulator.json")),
      p = await optional<PrivateStore>(path.join(dir, "store.json"));
    if (!!s !== !!p || (s && p && (s.schema !== 1 || s.runId !== p.runId)))
      throw Error("ข้อมูลที่เก็บไว้ต้องได้รับการตรวจสอบ");
    const shop = s ?? seed(uid()),
      store = new Store(dir, shop, p ?? emptyPrivate(shop.runId));
    if (!s) await store.save(shop, store.owner);
    return store;
  }
  private async save(shop: Shop, owner: PrivateStore) {
    const file = (n: string) => path.join(this.dir, n);
    await writeAtomic(file("pending.json"), JSON.stringify({ shop, owner }), {
      mode: 0o600,
    });
    await writeAtomic(file("simulator.json"), JSON.stringify(shop), {
      mode: 0o600,
    });
    await writeAtomic(file("store.json"), JSON.stringify(owner), {
      mode: 0o600,
    });
    await fs.unlink(file("pending.json"));
  }
  run<T>(fn: (s: Shop, p: PrivateStore) => T | Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      const s = structuredClone(this.shop),
        p = structuredClone(this.owner),
        last = this.shop.activity.at(-1)?.id;
      const value = await fn(s, p);
      await this.save(s, p);
      this.shop = s;
      this.owner = p;
      const event: StreamEvent = {
        type: "state",
        runId: s.runId,
        revision: s.revision,
      };
      this.events.emit("change", event);
      const activity = s.activity.at(-1);
      if (activity && activity.id !== last)
        this.events.emit("change", { ...event, type: "activity", activity });
      return value;
    }) as Promise<T>;
  }
  async archive(s: Shop, p: PrivateStore) {
    const d = path.join(this.dir, "archives");
    await fs.mkdir(d, { recursive: true });
    await writeAtomic(
      path.join(d, s.runId + ".json"),
      JSON.stringify({ shop: s, owner: p }),
      { mode: 0o600 },
    );
  }
}
