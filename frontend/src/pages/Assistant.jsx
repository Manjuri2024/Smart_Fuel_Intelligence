import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, User } from "lucide-react";
import { sendChat } from "../services/aiService.js";
import { getErrorMessage } from "../services/client.js";
import { PageHeader } from "../components/ui.jsx";

const SUGGESTIONS = [
  "Which scooter is cheaper for a 100 km trip?",
  "How can I reduce my fuel expenses?",
  "Estimate my remaining vehicle range.",
  "Compare EV and petrol running costs.",
  "Analyse my recent travel expenses.",
];

const GREETING = { role: "assistant", kind: "greeting", content: "Hi! Ask me about fuel costs, EV vs petrol, range, or your recent trips. I only use the numbers stored in FuelWise." };

export default function Assistant() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text) => {
    const message = text.trim();
    if (!message || loading) return;
    const history = messages.filter((m) => m.kind === undefined).map(({ role, content }) => ({ role, content })).slice(-8);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChat(message, history);
      setMessages((m) => [...m, res.configured === false
        ? { role: "assistant", kind: "config", content: res.reply }
        : { role: "assistant", content: res.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", kind: "error", content: getErrorMessage(err) }]);
    } finally { setLoading(false); }
  };

  const bubble = (m) => {
    if (m.role === "user") return "ml-auto bg-forest text-white";
    if (m.kind === "error") return "border border-beige bg-beige/20 text-ink";
    if (m.kind === "config") return "border border-beige bg-beige/20 text-ink";
    return "bg-tint text-ink";
  };

  return (
    <div>
      <PageHeader title="FuelWise AI Assistant" subtitle="Answers are grounded in calculations and trips from your FuelWise database." />
      <div className="card flex h-[34rem] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`flex max-w-[85%] items-start gap-2 ${m.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-deep text-white">
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <p className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${bubble(m)}`}>{m.content}</p>
            </div>
          ))}
          {loading && <div className="flex items-center gap-2 text-sm text-sage" role="status"><Loader2 className="h-4 w-4 animate-spin" /> FuelWise AI is thinking...</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-line p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} disabled={loading}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-tint disabled:opacity-60">{s}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question..." aria-label="Your question" maxLength={2000} />
            <button className="btn-primary px-4" disabled={loading || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
