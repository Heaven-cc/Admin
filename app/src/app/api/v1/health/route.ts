import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data";

/** Probe endpoint (docs/11 §8) — no data, 200/503 only. */
export async function GET() {
  try {
    getDataProvider();
    return NextResponse.json({
      data: { status: "ok", mode: "supabase", time: new Date().toISOString() },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Health check failed." } },
      { status: 503 }
    );
  }
}
