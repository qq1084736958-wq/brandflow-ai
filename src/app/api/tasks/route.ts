import { NextResponse } from "next/server";
import { listGenerationTasks } from "@/lib/server/task-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 20);
  const tasks = await listGenerationTasks(Number.isFinite(limit) ? limit : 20);
  return NextResponse.json({ tasks });
}
