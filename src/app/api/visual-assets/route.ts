import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const providerUrl = process.env.BRANDFLOW_IMAGE_PROVIDER_URL;
  const providerToken = process.env.BRANDFLOW_IMAGE_PROVIDER_TOKEN;
  if (!providerUrl) {
    return NextResponse.json({
      error: "尚未配置 AI 配图或版权图库服务。请配置 BRANDFLOW_IMAGE_PROVIDER_URL。",
      code: "IMAGE_PROVIDER_MISSING",
    }, { status: 501 });
  }

  try {
    const payload = await request.json();
    const response = await fetch(providerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(providerToken ? { Authorization: `Bearer ${providerToken}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: "配图服务请求失败", code: "IMAGE_PROVIDER_FAILED" }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "无法连接配图服务", code: "IMAGE_PROVIDER_UNAVAILABLE" }, { status: 502 });
  }
}
