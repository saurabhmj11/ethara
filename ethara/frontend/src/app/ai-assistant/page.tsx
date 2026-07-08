"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { AIResponse } from "@/types";
import PageHeader from "@/components/PageHeader";
import { RobotIcon, SparkleIcon } from "@/components/Sidebar";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  meta?: AIResponse;
}

// Minimal markdown-ish renderer: **bold**, `code`, line breaks
function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <p key={i} className={line.trim() === "" ? "h-2" : ""}>
        {parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
          }
          if (p.startsWith("`") && p.endsWith("`")) {
            return <code key={j} className="px-1.5 py-0.5 bg-slate-100 rounded text-[12px] font-mono text-indigo-700">{p.slice(1, -1)}</code>;
          }
          return <span key={j}>{p}</span>;
        })}
      </p>
    );
  });
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.aiSuggestions().then(setSuggestions).catch(() => {});
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
      <PageHeader
        title="AI Assistant"
        description="Natural-language queries about seats, employees, projects, and utilization."
        badge={
          <span className="badge badge-violet">
            <RobotIcon className="w-3 h-3 inline mr-1" /> Powered by LLM
          </span>
        }
      />

      <div className="card flex-1 flex flex-col p-0 overflow-hidden">
        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} slide-in`}>
              <div className={`max-w-[75%] ${m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}`}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-1 ml-1">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                      <RobotIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ethara AI</span>
                  </div>
                )}
                <div className={`px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
                }`}>
                  {renderContent(m.content)}
                </div>
                {m.meta && (
                  <div className="mt-1.5 flex items-center gap-2 ml-1">
                    <span className="badge badge-muted">{m.meta.intent}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{m.meta.elapsed_ms}ms</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start slide-in">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1 ml-1">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <RobotIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ethara AI</span>
                </div>
                <div className="chat-bubble-ai px-4 py-3.5">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <SparkleIcon className="w-4 h-4 text-amber-500" />
              <div className="text-xs uppercase font-bold tracking-wider text-slate-500">Try asking</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="btn btn-secondary btn-sm hover:border-indigo-300 hover:text-indigo-600"
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
        <div className="p-4 border-t border-slate-200 bg-white flex gap-2">
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
            {loading ? <span className="spinner" /> : null}
            Send
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
