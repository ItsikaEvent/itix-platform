import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Send,
  RefreshCw,
  Shield,
  Info,
} from "../../components/icons";
import { useClientAuth } from "../../context/ClientAuthContext";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Spinner } from "../../components/ui";
import type { ChatMessageItem } from "../../types";
import { formatTime } from "../../utils/format";
import ClientLogin from "./ClientLogin";

const QUICK_SUGGESTIONS = [
  "Je n'ai pas encore reçu l'e-mail contenant mes e-billets.",
  "J'aimerais obtenir une assistance pour la validation de mon paiement.",
  "Comment présenter mon QR Code à l'accueil du concert ?",
  "Je souhaite modifier les coordonnées indiquées sur ma réservation.",
];

export default function ClientMessaging() {
  const { clientUser, isClientAuth } = useClientAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  const loadMessages = async (showLoading = false) => {
    if (!clientUser?.email) return;
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get<ChatMessageItem[]>("/api/client/chat", {
        params: { email: clientUser.email },
      });
      setMessages(data);
      setTimeout(() => scrollToBottom(), 50);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isClientAuth) {
      loadMessages(true);
      const interval = setInterval(() => loadMessages(false), 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientUser?.email, isClientAuth]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !clientUser?.email || !clientUser?.name || sending) return;

    setSending(true);
    setError("");

    const optimisticMsg: ChatMessageItem = {
      id: Date.now(),
      customer_email: clientUser.email,
      customer_name: clientUser.name,
      sender: "CLIENT",
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");

    try {
      await api.post("/api/client/chat", {
        customer_email: clientUser.email,
        customer_name: clientUser.name,
        message: text,
      });
      await loadMessages(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isClientAuth) {
    return (
      <div className="py-8">
        <ClientLogin
          title="Assistance & Messagerie Dédiée"
          subtitle="Identifiez-vous avec votre e-mail et votre prénom pour entrer en contact direct avec l'organisation I-Tix."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECEAE6] pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Service Relations Auditeurs
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#111111] mt-0.5">
            Assistance & Échanges en Direct
          </h1>
          <p className="text-xs text-[#555555]">
            Liaison directe avec l'équipe de régie et de billetterie I-Tix
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => loadMessages(true)}
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Actualiser</span>
        </Button>
      </div>

      <ErrorBox message={error} />

      {/* Cadre principal de Messagerie */}
      <div className="flex flex-col h-[600px] rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] shadow-sm overflow-hidden">
        {/* Topbar de la discussion */}
        <div className="flex items-center justify-between border-b border-[#ECEAE6] bg-[#FAF9F6] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="I-Tix Support" className="h-8 w-auto object-contain" />
            <div>
              <h3 className="font-serif text-sm font-bold text-[#111111] leading-tight">
                Régie Billetterie I-Tix
              </h3>
              <p className="text-[11px] text-[#1E6B38] font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1E6B38] inline-block" />
                <span>Service actif &bull; Réponse rapide</span>
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-[#555555]">
            Auditeur : <strong className="text-[#111111]">{clientUser?.name}</strong>
          </div>
        </div>

        {/* Zone centrale des messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FAF9F6]">
          {/* Message de bienvenue automatique */}
          <div className="flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111111] text-[#FFFFFF] text-xs font-serif font-bold">
              IX
            </div>
            <div className="space-y-1">
              <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 text-xs text-[#303030] shadow-sm">
                <p className="font-serif font-bold text-[#641C2D] text-xs mb-1">
                  Équipe I-Tix
                </p>
                <p className="leading-relaxed">
                  Bonjour <strong className="text-[#111111]">{clientUser?.name}</strong>. Nous sommes à votre disposition pour vous accompagner concernant vos réservations, l'envoi de vos e-billets ou le déroulement des concerts.
                </p>
              </div>
              <span className="text-[10px] text-[#888888] pl-1 block">
                Message d'accueil automatique
              </span>
            </div>
          </div>

          {loading && messages.length === 0 && (
            <div className="py-8 text-center">
              <Spinner />
            </div>
          )}

          {/* Liste des bulles de messages */}
          {messages.map((m) => {
            const isMe = m.sender === "CLIENT";

            return (
              <div
                key={m.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}
              >
                {!isMe && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111111] text-[#FFFFFF] text-xs font-serif font-bold mb-4">
                    IX
                  </div>
                )}

                <div
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[75%]`}
                >
                  <div
                    className={`px-4 py-3 text-xs break-words ${
                      isMe
                        ? "itix-chat-bubble-me"
                        : "itix-chat-bubble-other"
                    }`}
                  >
                    {!isMe && (
                      <p className="font-serif font-bold text-[11px] text-[#641C2D] mb-1">
                        Organisateur
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                  <span className="text-[10px] text-[#888888] mt-1 px-1">
                    {formatTime(m.created_at)}
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions rapides */}
        {messages.length <= 2 && (
          <div className="border-t border-[#ECEAE6] bg-[#FFFFFF] px-4 py-2.5 flex gap-2 overflow-x-auto">
            {QUICK_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleSend(sug)}
                className="whitespace-nowrap rounded-lg border border-[#DCD9D3] bg-[#FAF9F6] px-3 py-1.5 text-[11px] font-medium text-[#444444] hover:border-[#641C2D] hover:text-[#641C2D]"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Barre de saisie en bas */}
        <div className="border-t border-[#ECEAE6] bg-[#FFFFFF] p-3 sm:p-4">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rédigez votre question ou message… (Appuyez sur Entrée pour envoyer)"
              className="flex-1 resize-none rounded-lg border border-[#DCD9D3] bg-[#FAF9F6] px-4 py-2.5 text-xs text-[#111111] placeholder-[#888888] focus:border-[#641C2D] focus:bg-[#FFFFFF] focus:outline-none max-h-24"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#641C2D] text-[#FFFFFF] hover:bg-[#4E1422] disabled:opacity-40 cursor-pointer"
              title="Transmettre le message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-[#888888] mt-2 px-1">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-[#641C2D]" />
              <span>Touche Entrée pour valider l'envoi</span>
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-[#1E6B38]" />
              <span>Échanges privés & sécurisés I-Tix</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
