import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ticket,
  RefreshCw,
  CheckCircle2,
  Calendar,
  MapPin,
  Mail,
  Download,
  QrCode,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
} from "../../components/icons";
import { useClientAuth } from "../../context/ClientAuthContext";
import { api, errorMessage } from "../../api/client";
import { Badge, Button, ErrorBox, Spinner } from "../../components/ui";
import type { ClientOrder } from "../../types";
import { formatAr, formatDateTime } from "../../utils/format";
import ClientLogin from "./ClientLogin";

export default function MyTickets() {
  const { clientUser, isClientAuth } = useClientAuth();
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!clientUser?.email) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<{ orders: ClientOrder[] }>("/api/client/orders", {
        params: { email: clientUser.email },
      });
      setOrders(data.orders);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isClientAuth) {
      loadOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientUser?.email, isClientAuth]);

  const handleResend = async (orderId: number) => {
    if (!clientUser?.email) return;
    setResendingId(orderId);
    setResendSuccess(null);
    try {
      const { data } = await api.post<{ message: string }>(
        `/api/client/orders/${orderId}/resend-email`,
        null,
        { params: { email: clientUser.email } }
      );
      setResendSuccess(data.message || "E-mail renvoyé avec succès !");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResendingId(null);
    }
  };

  if (!isClientAuth) {
    return (
      <div className="py-8">
        <ClientLogin
          title="Consulter mes billets & QR Codes"
          subtitle="Identifiez-vous avec votre e-mail et prénom pour afficher tous vos billets officiels."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECEAE6] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Espace Client
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Mes Billets & Réservations
          </h1>
          <p className="text-xs text-[#555555] mt-1">
            Compte : <strong className="text-[#111111]">{clientUser?.name}</strong> &bull;{" "}
            <span>{clientUser?.email}</span>
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadOrders}
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Actualiser</span>
        </Button>
      </div>

      <ErrorBox message={error} />

      {resendSuccess && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
          <span>{resendSuccess}</span>
        </div>
      )}

      {loading && <Spinner />}

      {!loading && orders.length === 0 && (
        <div className="rounded-2xl border border-[#ECEAE6] bg-[#FAF9F6] p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFFFF] border border-[#ECEAE6] text-[#666666] mb-3">
            <Ticket className="h-6 w-6 text-[#641C2D]" />
          </div>
          <h3 className="font-serif text-base font-bold text-[#111111]">
            Aucun billet trouvé pour cette adresse
          </h3>
          <p className="text-xs text-[#555555] mt-1 max-w-md mx-auto">
            Aucune commande n'a été enregistrée sous <strong className="text-[#111111]">{clientUser?.email}</strong>.
          </p>
          <div className="mt-6">
            <Link
              to="/billetterie"
              className="itix-btn-primary px-5 py-2.5 text-xs font-semibold"
            >
              <span>Découvrir la programmation</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </div>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-6">
          {orders.map((o) => {
            const isAccepted = o.status === "ACCEPTED";
            const isPending = o.status === "PENDING";
            const isRejected = o.status === "REJECTED";
            const isPaid = o.payment_status === "PAID";

            return (
              <div
                key={o.id}
                className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] overflow-hidden shadow-sm"
              >
                {/* En-tête de la commande */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECEAE6] bg-[#FAF9F6] p-5 sm:px-6">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#641C2D] uppercase tracking-widest block">
                      RÉFÉRENCE &bull; {o.reference}
                    </span>
                    <h3 className="font-serif text-lg font-bold text-[#111111] mt-0.5">
                      {o.concert_name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Statut Commande */}
                    {isAccepted && (
                      <Badge tone="green">
                        <CheckCircle2 className="h-3 w-3 inline mr-1" />
                        Validée
                      </Badge>
                    )}
                    {isPending && (
                      <Badge tone="amber">
                        <Clock className="h-3 w-3 inline mr-1" />
                        En attente
                      </Badge>
                    )}
                    {isRejected && (
                      <Badge tone="red">
                        <XCircle className="h-3 w-3 inline mr-1" />
                        Non acceptée
                      </Badge>
                    )}

                    {/* Statut Paiement */}
                    {isPaid ? (
                      <Badge tone="green">Paiement Réglé</Badge>
                    ) : (
                      <Badge tone="amber">Règlement sur place</Badge>
                    )}
                  </div>
                </div>

                {/* Corps de la commande */}
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-3.5">
                      <span className="text-[10px] text-[#888888] block uppercase font-semibold">
                        Date & Heure
                      </span>
                      <div className="flex items-center gap-2 font-semibold text-[#111111] mt-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#641C2D]" />
                        <span>{formatDateTime(o.concert_date)}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-3.5">
                      <span className="text-[10px] text-[#888888] block uppercase font-semibold">
                        Lieu du spectacle
                      </span>
                      <div className="flex items-center gap-2 font-semibold text-[#111111] mt-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#641C2D]" />
                        <span className="truncate">{o.concert_venue}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-3.5">
                      <span className="text-[10px] text-[#888888] block uppercase font-semibold">
                        Places & Tarif
                      </span>
                      <div className="flex items-center gap-2 font-semibold text-[#641C2D] mt-1.5 font-serif text-sm">
                        <Ticket className="h-3.5 w-3.5 text-[#641C2D]" />
                        <span>
                          {o.quantity} × {o.ticket_type_name} ({formatAr(o.total_amount)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statut e-mail */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-4 text-xs">
                    <div className="flex items-center gap-2 text-[#555555]">
                      <Mail className="h-4 w-4 text-[#641C2D] shrink-0" />
                      <span>
                        {isAccepted
                          ? `E-billet transmis à l'adresse ${clientUser?.email}`
                          : "Les e-billets sont envoyés automatiquement dès validation de la commande."}
                      </span>
                    </div>

                    {isAccepted && (
                      <Button
                        variant="outline"
                        disabled={resendingId === o.id}
                        onClick={() => handleResend(o.id)}
                        className="text-xs py-1.5 px-3 self-start sm:self-auto"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>{resendingId === o.id ? "Envoi…" : "Renvoyer l'e-mail"}</span>
                      </Button>
                    )}
                  </div>

                  {/* Motif de refus */}
                  {isRejected && o.reject_reason && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Motif de non-validation :</strong> {o.reject_reason}
                      </div>
                    </div>
                  )}

                  {/* Billet physique / E-billet QR Codes */}
                  {isAccepted && o.tickets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dashed border-[#ECEAE6] space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif text-base font-bold text-[#111111] flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-[#641C2D]" />
                          <span>Titres d'Accès Officiels ({o.tickets.length} place{o.tickets.length > 1 ? "s" : ""})</span>
                        </h4>
                        <span className="text-[11px] text-[#888888] hidden sm:inline">
                          À présenter au contrôle d'accès
                        </span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {o.tickets.map((t, idx) => (
                          <div
                            key={t.number || idx}
                            className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-5 text-center space-y-3 shadow-sm hover:border-[#641C2D]"
                          >
                            <div className="border-b border-[#ECEAE6] pb-2">
                              <span className="text-[10px] uppercase font-bold text-[#641C2D] tracking-wider block">
                                {o.ticket_type_name}
                              </span>
                              <span className="font-mono text-xs font-bold text-[#111111] tracking-wider block mt-0.5">
                                {t.number}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] inline-block shadow-sm">
                              <img
                                src={t.qr_image}
                                alt={`QR ${t.number}`}
                                className="h-36 w-36 object-contain mx-auto"
                              />
                            </div>

                            <a
                              href={t.qr_image}
                              download={`ITIX_Billet_${t.number || "qr"}.png`}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#DCD9D3] bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-[#111111] hover:bg-[#ECEAE6]"
                            >
                              <Download className="h-3.5 w-3.5 text-[#641C2D]" />
                              <span>Enregistrer le QR</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
