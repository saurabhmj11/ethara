"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { AIResponse } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  meta?: AIResponse;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.aiSuggestions().then(setSuggestions).catch(() => {});
    // Welcome message
    setMessages([{
      role: "assistant",
      content: "👋 Hi! I'm the Ethara AI Assistant. Ask me about seat availability, new joiners, floor utilization, project members, or where a specific employee sits. Try one of the suggestions below to get started.",
    }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendQuery = async (query: string) => {
    if (!query.trim() || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: query }]);
    setLoading(true);
    try {
      const r = await api.aiQuery(query);
      setMessages((m) => [...m, { role: "assistant", content: r.answer, meta: r }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, I couldn't process that: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 fade-in h-[calc(100vh-3rem)] flex flex-col">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-sm text-slate-600 mt-1">Natural-language queries about seats, employees, projects, and utilization.</p>
      </header>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden">
        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}>
                {m.role === "assistant" && <div className="text-xs font-semibold mb-1 opacity-60">🤖 Ethara AI</div>}
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                {m.meta && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-xs opacity-70">
                    <span className="badge badge-muted mr-2">{m.meta.intent}</span>
                    <span>{m.meta.elapsed_ms}ms</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="spinner" /> Thinking...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Try asking</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="btn btn-secondary btn-sm"
                  onClick={() => sendQuery(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-slate-200 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ask about seats, employees, projects..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendQuery(input); }}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={() => sendQuery(input)}
            disabled={loading || !input.trim()}
          >
            Send →
          </button>
        </div>
      </div>
    </div>
  );
}
