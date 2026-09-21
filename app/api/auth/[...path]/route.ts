import type { NextRequest } from "next/server";

import { getAuth } from "@/src/shared/auth/server";
import { ConfigurationError } from "@/src/shared/config/env";

export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

async function handle(method: "GET" | "POST", request: NextRequest, context: Context) {
  try {
    return await getAuth().handler()[method](request, context);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return Response.json(
        { error: "Authentication is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }
}

export function GET(request: NextRequest, context: Context) {
  return handle("GET", request, context);
}

export function POST(request: NextRequest, context: Context) {
  return handle("POST", request, context);
}
