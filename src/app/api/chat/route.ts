import { NextResponse } from "next/server";

type Message = { role: "user" | "model"; text: string };
function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<Message>;
  return (
    (m.role === "user" || m.role === "model") &&
    typeof m.text === "string" &&
    m.text.trim().length > 0 &&
    m.text.length <= 4000
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  try {
    if (origin && new URL(origin).host !== host)
      return NextResponse.json(
        { error: "허용되지 않은 요청입니다." },
        { status: 403 },
      );
  } catch {
    return NextResponse.json(
      { error: "허용되지 않은 요청입니다." },
      { status: 403 },
    );
  }

  let messages: Message[];
  try {
    const raw = await request.text();
    if (raw.length > 24000)
      return NextResponse.json(
        { error: "질문이 너무 깁니다." },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (
      !Array.isArray(body.messages) ||
      !body.messages.length ||
      body.messages.length > 10 ||
      !body.messages.every(isMessage) ||
      body.messages.at(-1).role !== "user"
    )
      throw new Error("Invalid messages");
    messages = body.messages;
  } catch {
    return NextResponse.json(
      { error: "질문 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "산행 도우미 연결을 준비 중입니다." },
      { status: 503 },
    );
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        store: false,
        reasoning: { effort: "none" },
        max_output_tokens: 900,
        instructions:
          "한국어 산행 도우미입니다. 산행 관련 질문에만 간결한 일반 텍스트로 답하세요. 최신 날씨·통제·등산로 상태를 확인했다고 주장하지 마세요. 알 수 없는 코스·위험정보는 추측하지 말고 공식 안내 확인을 권하세요. 긴급 상황에는 119 연락과 안전 확보를 안내하세요.",
        input: messages.map((m) => ({
          role: m.role === "model" ? "assistant" : "user",
          content: m.text,
        })),
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const quota = [
        "insufficient_quota",
        "credit_balance_exhausted",
        "project_spend_limit_exceeded",
        "organization_spend_limit_exceeded",
      ].includes(data.error?.code);
      return NextResponse.json(
        {
          error: quota
            ? "AI 서비스 이용 한도가 소진되어 현재 답변을 제공할 수 없습니다."
            : "도우미 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: response.status === 429 ? 429 : 502 },
      );
    }
    const data = await response.json();
    const text = (data.output || [])
      .filter((item: { type: string }) => item.type === "message")
      .flatMap(
        (item: { content?: { type: string; text?: string }[] }) =>
          item.content || [],
      )
      .filter((part: { type: string }) => part.type === "output_text")
      .map((part: { text: string }) => part.text)
      .join("\n");
    if (!text) throw new Error("Empty answer");
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "질문 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
