import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")),
    lng = Number(params.get("lng"));
  if (
    !params.has("lat") ||
    !params.has("lng") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 33 ||
    lat > 39 ||
    lng < 124 ||
    lng > 132
  )
    return NextResponse.json(
      { error: "조회 위치를 확인해 주세요." },
      { status: 400 },
    );
  const key = process.env.TOURISM_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "관광정보 서비스 연결을 준비 중입니다." },
      { status: 503 },
    );
  try {
    const query = new URLSearchParams({
      serviceKey: key,
      numOfRows: "20",
      pageNo: "1",
      MobileOS: "ETC",
      MobileApp: "SafeHikingTour",
      arrange: "E",
      mapX: String(lng),
      mapY: String(lat),
      radius: "5000",
      _type: "json",
    });
    const response = await fetch(
      `https://apis.data.go.kr/B551011/KorService2/locationBasedList2?${query}`,
      { signal: AbortSignal.timeout(10000), next: { revalidate: 3600 } },
    );
    if (!response.ok) throw new Error("Upstream error");
    const data = await response.json();
    if (data.response?.header?.resultCode !== "0000")
      throw new Error("API error");
    const items = data.response?.body?.items?.item;
    return NextResponse.json({ items: Array.isArray(items) ? items : [] });
  } catch {
    return NextResponse.json(
      { error: "관광정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." },
      { status: 502 },
    );
  }
}
