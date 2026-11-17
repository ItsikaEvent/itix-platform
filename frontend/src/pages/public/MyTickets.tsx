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
  ArrowRight,
  Shield,
  ShieldCheck,
} from "../../components/icons";
import { useClientAuth } from "../../context/ClientAuthContext";
import { api, errorMessage } from "../../api/client";
import { Badge, Button, ErrorBox, Spinner } from "../../components/ui";
import type { ClientOrder } from "../../types";
import { formatAr, formatDateTime } from "../../utils/format";
import ClientLogin from "./ClientLogin";

const OFFLINE_TICKETS_KEY = "itix_cached_client_orders";

export default function MyTickets() {
  const { clientUser, isClientAuth, loginClient } = useClientAuth();
  const [orders, setOrders] = useState<ClientOrder[]>(() => {
    const cached = localStorage.getItem(OFFLINE_TICKETS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // A2F Spectateur
  const [totpEnabled, setTotpEnabled] = useState(clientUser?.totp_enabled ?? false);
  const [show2FaModal, setShow2FaModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qr_code: string } | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  // Vérifier le statut 2FA actuel
  useEffect(() => {
    if (clientUser?.email) {
      api.post<{ totp_enabled: boolean }>("/api/client/auth/check", { email: clientUser.email })
        .then(({ data }) => setTotpEnabled(data.totp_enabled))
        .catch(() => {});
    }
  }, [clientUser?.email]);

  const loadOrders = async () => {
    if (!clientUser?.email) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<{ orders: ClientOrder[] }>("/api/client/orders");
      setOrders(data.orders);
      localStorage.setItem(OFFLINE_TICKETS_KEY, JSON.stringify(data.orders));
    } catch (e) {
      const cached = localStorage.getItem(OFFLINE_TICKETS_KEY);
      if (cached) {
        try {
          setOrders(JSON.parse(cached));
          setError("Mode hors-ligne : Affichage de vos billets sauvegardés.");
        } catch {
          setError(errorMessage(e));
        }
      } else {
        setError(errorMessage(e));
      }
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
        `/api/client/orders/${orderId}/resend-email`
      );
      setResendSuccess(data.message || "E-mail renvoyé avec succès !");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResendingId(null);
    }
  };

  const handleOpenEnable2Fa = async () => {
    setModalError("");
    setModalBusy(true);
    setShow2FaModal(true);
    try {
      const { data } = await api.post<{ secret: string; qr_code: string }>("/api/client/auth/enable-2fa");
      setSetupData(data);
    } catch (err) {
      setModalError(errorMessage(err, "Impossible d'initier la configuration A2F."));
    } finally {
      setModalBusy(false);
    }
  };

  const handleConfirmEnable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalBusy(true);
    try {
      await api.post("/api/client/auth/confirm-enable-2fa", { code: setupCode.trim() });
      setTotpEnabled(true);
      if (clientUser) {
        loginClient(localStorage.getItem("itix_client_token") || "", { ...clientUser, totp_enabled: true });
      }
      setShow2FaModal(false);
      setSetupCode("");
      setSetupData(null);
    } catch (err) {
      setModalError(errorMessage(err, "Code incorrect. Vérifiez votre application."));
    } finally {
      setModalBusy(false);
    }
  };

  const handleDisable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalBusy(true);
    try {
      await api.post("/api/client/auth/disable-2fa", { code: disableCode.trim() });
      setTotpEnabled(false);
      if (clientUser) {
        loginClient(localStorage.getItem("itix_client_token") || "", { ...clientUser, totp_enabled: false });
      }
      setShowDisableModal(false);
      setDisableCode("");
    } catch (err) {
      setModalError(errorMessage(err, "Code incorrect."));
    } finally {
      setModalBusy(false);
    }
  };

  if (!isClientAuth) {
    return (
      <div className="py-8">
        <ClientLogin
          title="Consulter mes billets & QR Codes"
          subtitle="Identifiez-vous avec votre e-mail pour afficher tous vos billets officiels."
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

        <div className="flex items-center gap-2">
          {totpEnabled ? (
            <button
              onClick={() => setShowDisableModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>A2F Active</span>
            </button>
          ) : (
            <button
              onClick={handleOpenEnable2Fa}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#FAF9F6] text-[#641C2D] border border-[#641C2D]/40 hover:bg-[#ECEAE6] cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Activer A2F</span>
            </button>
          )}

          <Button
            variant="outline"
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </Button>
        </div>
      </div>

      <ErrorBox message={error} />

      {resendSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{resendSuccess}</span>
        </div>
      )}

      {/* Modal Activation A2F */}
      {show2FaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#181818] border border-[#2A2A2A] p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-2 text-[#C6A15B]">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-serif font-bold text-base text-white">Activer la protection A2F</h3>
              </div>
              <button
                onClick={() => setShow2FaModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9E9B94] leading-relaxed">
              Scannez ce QR Code avec <strong>Google Authenticator</strong> ou toute application TOTP compatible :
            </p>

            {setupData?.qr_code && (
              <div className="p-3 bg-white rounded flex justify-center">
                <img src={setupData.qr_code} alt="QR Code A2F" className="w-40 h-40 object-contain" />
              </div>
            )}

            {setupData?.secret && (
              <div className="text-[10px] text-gray-300 font-mono bg-[#222222] p-2 rounded border border-[#333333]">
                Clé manuelle : <span className="text-[#C6A15B]">{setupData.secret}</span>
              </div>
            )}

            <form onSubmit={handleConfirmEnable2Fa} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Code de vérification à 6 chiffres
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-center tracking-widest text-lg font-mono rounded bg-[#222222] border border-[#333333] px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                  required
                  autoFocus
                />
              </div>

              <ErrorBox message={modalError} />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2FaModal(false)}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={modalBusy || setupCode.length !== 6}
                  className="px-4 py-2 text-xs font-semibold bg-[#641C2D] text-white hover:bg-[#4E1422] disabled:opacity-50 cursor-pointer"
                >
                  {modalBusy ? "Activation…" : "Valider et activer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Désactivation A2F */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#181818] border border-[#2A2A2A] p-6 text-white space-y-4">
            <h3 className="font-serif font-bold text-base text-white">Désactiver la protection A2F</h3>
            <p className="text-xs text-[#9E9B94]">
              Entrez votre code Authenticator actuel pour confirmer la désactivation :
            </p>

            <form onSubmit={handleDisable2Fa} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                className="w-full text-center tracking-widest text-lg font-mono rounded bg-[#222222] border border-[#333333] px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                required
                autoFocus
              />

              <ErrorBox message={modalError} />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={modalBusy || disableCode.length !== 6}
                  className="px-4 py-2 text-xs font-semibold bg-red-800 text-white hover:bg-red-900 disabled:opacity-50 cursor-pointer"
                >
                  {modalBusy ? "Désactivation…" : "Désactiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des commandes & Billets */}
      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#ECEAE6] rounded-xl p-8 space-y-3">
          <Ticket className="w-12 h-12 text-[#9E9B94] mx-auto opacity-40" />
          <h2 className="font-serif text-lg font-bold text-[#111111]">Aucun billet trouvé</h2>
          <p className="text-xs text-[#66625B] max-w-md mx-auto">
            Aucune réservation ou billet n'est associé à cette adresse e-mail.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#641C2D] text-white text-xs font-semibold rounded hover:bg-[#4E1422]"
          >
            <span>Découvrir les concerts à l'affiche</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((o) => {
            const isAccepted = o.status === "ACCEPTED";
            const isPaid = o.payment_status === "PAID";
            return (
              <div
                key={o.id}
                className="bg-white border border-[#ECEAE6] rounded-xl overflow-hidden shadow-xs"
              >
                <div className="p-5 sm:p-6 border-b border-[#ECEAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F6]">
                  <div>
                    <span className="text-[10px] font-mono text-[#66625B] uppercase block">
                      Réf : {o.reference}
                    </span>
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-[#111111]">
                      {o.concert_name}
                    </h2>
                    <p className="text-xs text-[#66625B] flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#641C2D]" />
                        {formatDateTime(o.concert_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#641C2D]" />
                        {o.concert_venue}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={isAccepted ? "green" : o.status === "REJECTED" ? "red" : "amber"}>
                      {isAccepted ? "Validé" : o.status === "REJECTED" ? "Refusé" : "En attente"}
                    </Badge>
                    <Badge tone={isPaid ? "green" : "gray"}>
                      {isPaid ? "Payé" : "À régler"}
                    </Badge>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#444444] pb-4 border-b border-[#ECEAE6]">
                    <div>
                      <span>Catégorie : </span>
                      <strong className="text-[#111111]">{o.ticket_type_name}</strong> &bull;{" "}
                      <span>{o.quantity} billet(s)</span>
                    </div>
                    <div>
                      <span>Total : </span>
                      <strong className="text-sm font-bold text-[#641C2D] font-mono">
                        {formatAr(o.total_amount)}
                      </strong>
                    </div>
                  </div>

                  {/* QR Codes des billets */}
                  {isAccepted && o.tickets.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#641C2D] flex items-center gap-1.5">
                          <QrCode className="w-4 h-4" />
                          <span>Vos billets d'accès officiels ({o.tickets.length})</span>
                        </h4>
                        <button
                          onClick={() => handleResend(o.id)}
                          disabled={resendingId === o.id}
                          className="text-[11px] text-[#641C2D] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Mail className="w-3 h-3" />
                          <span>{resendingId === o.id ? "Envoi…" : "Renvoyer par e-mail"}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                        {o.tickets.map((t, idx) => (
                          <div
                            key={t.number || idx}
                            className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-5 text-center space-y-3 shadow-xs hover:border-[#641C2D]"
                          >
                            <div className="border-b border-[#ECEAE6] pb-2">
                              <span className="text-[10px] uppercase font-bold text-[#641C2D] tracking-wider block">
                                {o.ticket_type_name}
                              </span>
                              <span className="font-mono text-xs font-bold text-[#111111] tracking-wider block mt-0.5">
                                {t.number}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] inline-block shadow-xs">
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
