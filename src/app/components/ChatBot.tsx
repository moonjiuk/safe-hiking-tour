"use client";
import { useRef, useState } from "react";
type Message = { role: "user" | "model"; text: string };
export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const next: Message[] = [
      ...messages,
      { role: "user", text: question.trim() },
    ];
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-10) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages([...next, { role: "model", text: data.text }]);
      setQuestion("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "응답을 받지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }
  return (
    <div className="chat-container">
      <div className="chat-window" role="log" aria-live="polite">
        <p className="chat-welcome">
          어떤 산행을 계획하고 계신가요?
          <br />
          <small>준비물, 코스 선택, 안전 수칙을 물어보세요.</small>
        </p>
        {messages.map((m, i) => (
          <p key={i} className={`message ${m.role}`}>
            {m.text}
          </p>
        ))}
        {loading && <p role="status">답변을 준비하고 있습니다…</p>}
      </div>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={send} className="chat-input">
        <input
          aria-label="산행 질문"
          maxLength={2000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="예 : 월악산 코스랑 준비물 알려줘"
        />
        <button className="primary" disabled={loading || !question.trim()}>
          보내기
        </button>
      </form>
    </div>
  );
}
