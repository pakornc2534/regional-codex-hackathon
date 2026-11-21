import { request, HttpError, type Payload } from "./client";
type Scope = { runId: string; version: number };
type Reply = { status: string };
const pending = new Map<string, Scope & { key: string }>();
export async function sendCommand(body: Payload, scope: Scope): Promise<Reply> {
  const identity = JSON.stringify([scope.runId, body]),
    prior = pending.get(identity);
  const attempt = prior ?? { ...scope, key: crypto.randomUUID() };
  const lookup = () =>
    request<{ receipt: Reply | null }>(
      "/api/receipts/" +
        encodeURIComponent(attempt.key) +
        "?runId=" +
        encodeURIComponent(attempt.runId),
    );
  if (prior) {
    const { receipt } = await lookup();
    if (receipt) {
      pending.delete(identity);
      return receipt;
    }
  }
  pending.set(identity, attempt);
  try {
    const reply = await request<Reply>(
      body.type === "memory" ? "/api/memories" : "/api/sim/command",
      { ...body, ...attempt },
    );
    pending.delete(identity);
    return reply;
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) {
      pending.delete(identity);
      throw error;
    }
    try {
      const { receipt } = await lookup();
      if (receipt) {
        pending.delete(identity);
        return receipt;
      }
    } catch {}
    throw Error("ยังไม่แน่ใจผลของคำสั่ง กดคำสั่งเดิมเพื่อตรวจผลอีกครั้ง");
  }
}
