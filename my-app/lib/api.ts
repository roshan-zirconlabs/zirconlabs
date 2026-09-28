import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MarketError } from "@/lib/polymarket/markets";
import { OrderError } from "@/lib/trading/execute";
import { AutomationError } from "@/lib/automations/service";

export const noStore = { "Cache-Control": "private, no-store" };

export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** The signed-in user's id, or throws a 401. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user.id) throw new HttpError("Sign in to continue.", 401);
  return session.user.id;
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

/** Maps known errors to their status and a readable message; hides the rest. */
export function fail(error: unknown) {
  if (error instanceof HttpError || error instanceof MarketError || error instanceof OrderError || error instanceof AutomationError) {
    return json({ error: error.message }, error.status);
  }
  console.error(error);
  return json({ error: "Something went wrong on our side. Nothing was changed — try again." }, 500);
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => {
    throw new HttpError("Send a JSON body.");
  });
}
