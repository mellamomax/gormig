import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";
import { runAutomaticFollowUps } from "@/lib/jobs/follow-ups";

export async function GET(request: Request) {
  const secret = getEnv("CRON_SECRET");
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const report = await runAutomaticFollowUps();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
