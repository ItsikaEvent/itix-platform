import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquare, Send, RefreshCw } from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Spinner } from "../../components/ui";
import type { ChatConversation, ChatMessageItem } from "../../types";
import { formatDateTime, formatTime } from "../../utils/format";

export default function SupportMessages() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  const loadConversations = async (showLoading = false) => {
    if (showLoading) setLoadingConv(true);
    try {
      const { data } = await api.get<ChatConversation[]>("/api/admin/chat/conversations");
      setConversations(data);
      if (!activeEmail && data.length > 0) {
        setActiveEmail(data[0].customer_email);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (showLoading) setLoadingConv(false);
    }
  };

  const loadChat = async (email: string, showLoading = false) => {
    if (!email) return;
    if (showLoading) setLoadingChat(true);
    try {
      const { data } = await api.get<ChatMessageItem[]>(
        `/api/admin/chat/${encodeURIComponent(email)}`
      );
      setMessages(data);
      setTimeout(() => scrollToBottom(), 50);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (showLoading) setLoadingChat(false);
    }
  };

  useEffect(() => {
    loadConversations(true);
    const interval = setInterval(() => {
      loadConversations(false);
      if (activeEmail) loadChat(activeEmail, false);
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmail]);

  useEffect(() => {
    if (activeEmail) {
      loadChat(activeEmail, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmail]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendReply = async () => {
    const text = inputText.trim();
    if (!text || !activeEmail || sending) return;

    setSending(true);
    setError("");

    const activeConv = conversations.find((c) => c.customer_email === activeEmail);
    const optimisticMsg: ChatMessageItem = {
      id: Date.now(),
      customer_email: activeEmail,
      customer_name: activeConv?.customer_name || "Client",
      sender: "ADMIN",
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");

    try {
      await api.post(`/api/admin/chat/${encodeURIComponent(activeEmail)}`, {
        message: text,
      });
      await loadChat(activeEmail, false);
      await loadConversations(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const activeConv = conversations.find((c) => c.customer_email === activeEmail);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DCD0] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B]">
            Service Relations Spectateurs
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Centre d'Assistance & Messages
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Échanges directs, support billetterie et réponses aux auditeurs
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadConversations(true)}
          disabled={loadingConv}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          <span>Actualiser</span>
        </Button>
      </div>

      <ErrorBox message={error} />

      {/* Two-pane chat system */}
      <div className="grid grid-cols-1 md:grid-cols-3 border border-[#D4C9BA] bg-[#FFFFFF] shadow-sm overflow-hidden h-[640px]">
        {/* Left Pane: Conversation list */}
        <div className="border-r border-[#E4DCD0] flex flex-col bg-[#FAF8F3]">
          <div className="border-b border-[#E4DCD0] bg-[#FFFFFF] p-4 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#66625B]">
              Conversations ({conversations.length})
            </h3>
            <span className="text-[10px] text-[#2E6F40] font-semibold">
              En direct
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#EFE9DC]">
            {loadingConv && conversations.length === 0 && (
              <div className="p-8 text-center">
                <Spinner />
              </div>
            )}

            {!loadingConv && conversations.length === 0 && (
              <div className="p-8 text-center text-xs text-[#8C877E]">
                Aucun message client reçu pour le moment.
              </div>
            )}

            {conversations.map((c) => {
              const isSelected = c.customer_email === activeEmail;
              const isLastFromClient = c.last_sender === "CLIENT";

              return (
                <button
                  key={c.customer_email}
                  onClick={() => setActiveEmail(c.customer_email)}
                  className={`w-full text-left p-4 flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? "bg-[#EFE9DC] border-l-4 border-[#641C2D]"
                      : "hover:bg-[#FFFFFF]"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#111111] text-[#F7F3EA] border border-[#C6A15B] text-xs font-serif font-bold">
                    {c.customer_name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs text-[#111111] truncate">
                        {c.customer_name}
                      </span>
                      <span className="text-[10px] text-[#8C877E] shrink-0">
                        {formatTime(c.last_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#66625B] truncate">
                      {c.customer_email}
                    </p>

                    <p className="text-xs text-[#303030] truncate mt-1">
                      {isLastFromClient ? (
                        <strong className="text-[#641C2D]">Client : </strong>
                      ) : (
                        <span className="text-[#8C877E]">Vous : </span>
                      )}
                      {c.last_message}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Active chat */}
        <div className="col-span-2 flex flex-col bg-[#FFFFFF]">
          {activeEmail && activeConv ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E4DCD0] bg-[#FAF8F3] px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center bg-[#111111] text-[#F7F3EA] border border-[#C6A15B] text-xs font-serif font-bold">
                    {activeConv.customer_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#111111] leading-tight">
                      {activeConv.customer_name}
                    </h3>
                    <p className="text-[11px] text-[#641C2D] font-medium">
                      {activeConv.customer_email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message scroll view */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FAF8F3]">
                {loadingChat && messages.length === 0 && (
                  <div className="p-8 text-center">
                    <Spinner />
                  </div>
                )}

                {messages.map((m) => {
                  const isMe = m.sender === "ADMIN";

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}
                    >
                      <div
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[75%]`}
                      >
                        <div
                          className={`px-4 py-2.5 text-xs break-words ${
                            isMe
                              ? "bg-[#641C2D] text-[#F7F3EA] border border-[#521524]"
                              : "bg-[#FFFFFF] border border-[#E4DCD0] text-[#111111]"
                          }`}
                        >
                          {!isMe && (
                            <p className="font-serif font-bold text-[11px] text-[#641C2D] mb-1">
                              {m.customer_name}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.message}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#8C877E] mt-1 px-1">
                          {formatDateTime(m.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[#E4DCD0] bg-[#FFFFFF] p-3 sm:p-4">
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    handleSendReply();
                  }}
                  className="flex items-center gap-2"
                >
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Rédiger une réponse à ${activeConv.customer_name}… (Entrée pour valider)`}
                    className="flex-1 resize-none border border-[#D4C9BA] bg-[#FAF8F3] px-4 py-2.5 text-xs text-[#111111] placeholder-[#8C877E] focus:border-[#641C2D] focus:bg-[#FFFFFF] focus:outline-none max-h-24"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#641C2D] text-[#F7F3EA] hover:bg-[#4E1422] disabled:opacity-40 cursor-pointer"
                    title="Envoyer la réponse"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#8C877E]">
              <MessageSquare className="h-10 w-10 text-[#C6A15B] mb-2" />
              <p className="font-serif text-sm font-semibold text-[#111111]">
                Sélectionnez une discussion
              </p>
              <p className="text-xs text-[#66625B] mt-1">
                Choisissez une conversation dans le panneau de gauche pour consulter l'historique et répondre.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
