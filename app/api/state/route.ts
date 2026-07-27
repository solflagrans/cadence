import { getCurrentAccount } from "@/src/infrastructure/auth/neon-auth-server";
import { normalizePlannerData } from "@/src/domain/planner/validation/normalize-planner-state";
import {
  loadAccountState,
  saveAccountState,
} from "@/src/application/state/user-state-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STATE_BYTES = 1_000_000;

const json = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function GET(): Promise<Response> {
  try {
    const account = await getCurrentAccount();
    if (!account) return json({ error: "Unauthorized" }, { status: 401 });
    const state = await loadAccountState(account);
    if (!state) return json({ error: "State not found" }, { status: 404 });
    return json(state);
  } catch (error) {
    console.error({ event: "state_load_failed", error: errorMessage(error) });
    return json({ error: "Unable to load state" }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_STATE_BYTES) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = record(body);
  const data = normalizePlannerData(payload?.data);
  const revision = payload?.revision;
  if (!data) return json({ error: "Invalid state" }, { status: 400 });
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    return json({ error: "Invalid revision" }, { status: 400 });
  }
  if (
    new TextEncoder().encode(JSON.stringify(data)).byteLength >
    MAX_STATE_BYTES
  ) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  try {
    const account = await getCurrentAccount();
    if (!account) return json({ error: "Unauthorized" }, { status: 401 });
    const result = await saveAccountState(account, data, revision);
    if (result.status === "conflict") {
      return json(
        { error: "State conflict", revision: result.revision },
        { status: 409 },
      );
    }
    return json({
      revision: result.revision,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    console.error({ event: "state_save_failed", error: errorMessage(error) });
    return json({ error: "Unable to save state" }, { status: 500 });
  }
}
