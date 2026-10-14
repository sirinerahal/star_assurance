"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

export default function ChatDrawer({ clientId }: { clientId: string }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--color-primary)] text-white shadow-lg shadow-blue-900/20 flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors z-40"
        aria-label="Discuter avec l'assistant IA"
      >
        <Sparkles size={22} />
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOuvert(false)} />
          <div className="relative w-96 h-full shadow-2xl">
            <button
              onClick={() => setOuvert(false)}
              className="absolute -left-11 top-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-[var(--color-slate)] hover:text-[var(--color-ink)]"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
            <ChatPanel clientId={clientId} />
          </div>
        </div>
      )}
    </>
  );
}
