"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { poserQuestionChat } from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Explique les garanties du produit recommandé",
  "Rédige un email pour proposer ce produit",
  "Prépare un argumentaire pour convaincre ce client",
];

export default function ChatPanel({ clientId }: { clientId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const finDesMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finDesMessages.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function envoyer(texte: string) {
    if (!texte.trim() || envoiEnCours) return;
    const nouveauxMessages: Message[] = [...messages, { role: "user", content: texte }];
    setMessages(nouveauxMessages);
    setInput("");
    setEnvoiEnCours(true);
    try {
      const reponse = await poserQuestionChat(clientId, texte);
      setMessages([...nouveauxMessages, { role: "assistant", content: reponse }]);
    } catch {
      setMessages([
        ...nouveauxMessages,
        { role: "assistant", content: "Une erreur est survenue. Vérifiez que l'API est bien lancée." },
      ]);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-card)] border-l border-[var(--color-border)]">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
          <Sparkles size={16} strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-semibold text-sm text-[var(--color-ink)]">Assistant IA</p>
          <p className="text-[11px] text-[var(--color-slate)]">Répond à propos de ce client</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-slate)] mb-3">Suggestions :</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => envoyer(s)}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[var(--color-primary)] text-white rounded-br-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-ink)] rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {envoiEnCours && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface)] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-[var(--color-slate)]">
              L&apos;assistant rédige une réponse...
            </div>
          </div>
        )}
        <div ref={finDesMessages} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(input);
        }}
        className="p-4 border-t border-[var(--color-border)] flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez une question..."
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
        <button
          type="submit"
          disabled={envoiEnCours || !input.trim()}
          className="w-10 h-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[var(--color-primary-dark)] transition-colors shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
