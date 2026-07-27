import type { PlannerData } from "@/src/domain/planner/model/types";
import { normalizePlannerData } from "@/src/domain/planner/validation/normalize-planner-state";

type ApiStateResponse = {
  data: unknown;
  revision: number;
  updatedAt: string;
};

export class StateGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly remoteRevision?: number,
  ) {
    super(message);
    this.name = "StateGatewayError";
  }
}

const isLoadResponse = (value: unknown): value is ApiStateResponse => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiStateResponse>;
  return (
    candidate.data !== undefined &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.revision === "number" &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision >= 1
  );
};

const isSaveResponse = (
  value: unknown,
): value is { revision: number; updatedAt: string } => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { revision?: unknown; updatedAt?: unknown };
  return (
    typeof candidate.revision === "number" &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision >= 1 &&
    typeof candidate.updatedAt === "string"
  );
};

export class ApiStateGateway {
  constructor(private readonly apiPath = "/api/state") {}

  async load(): Promise<{
    data: PlannerData;
    revision: number;
    updatedAt: string;
  } | null> {
    const response = await fetch(this.apiPath, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new StateGatewayError("Unable to load state", response.status);
    }
    const payload: unknown = await response.json();
    if (!isLoadResponse(payload)) {
      throw new StateGatewayError("Invalid state response", 502);
    }
    const data = normalizePlannerData(payload.data);
    if (!data) {
      throw new StateGatewayError("Unsupported state version", 502);
    }
    return {
      data,
      revision: payload.revision,
      updatedAt: payload.updatedAt,
    };
  }

  async save(data: PlannerData, revision: number): Promise<{
    revision: number;
    updatedAt: string;
  }> {
    const response = await fetch(this.apiPath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, revision }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const remoteRevision =
        payload && typeof payload === "object" &&
        typeof (payload as { revision?: unknown }).revision === "number"
          ? (payload as { revision: number }).revision
          : undefined;
      throw new StateGatewayError(
        response.status === 409 ? "State conflict" : "Unable to save state",
        response.status,
        remoteRevision,
      );
    }
    if (!isSaveResponse(payload)) {
      throw new StateGatewayError("Invalid save response", 502);
    }
    return payload;
  }
}
