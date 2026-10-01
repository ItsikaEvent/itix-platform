import { useEffect, useState, type FormEvent } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  HelpCircle,
  Info,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Spinner, inputCls } from "../../components/ui";

interface EmailStatus {
  configured: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_from: string;
  smtp_username: string;
  has_password: boolean;
}

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  hint?: string;
  details?: {
    smtp_host: string;
    smtp_port: number;
    smtp_from: string;
    smtp_username: string;
    recipient: string;
  };
}

export default function EmailSettings() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("itsikaevent.mdg@gmail.com");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<EmailStatus>("/api/admin/email/status");
      setStatus(data);
      if (data.smtp_username && recipient === "itsikaevent.mdg@gmail.com") {
        setRecipient(data.smtp_username);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) return;

    setSending(true);
    setResult(null);
    setError("");

    try {
      const { data } = await api.post<TestResult>("/api/admin/email/test", {
        recipient: recipient.trim(),
      });
      setResult(data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { detail?: TestResult | string } };
      };
      const detail = axiosErr.response?.data?.detail;
      if (typeof detail === "object" && detail !== null && "success" in detail) {
        setResult(detail as TestResult);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DCD0] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B]">
            Infrastructure & Communications
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Passerelle SMTP & Diagnostic E-mail
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Supervision du service d'envoi automatique des e-billets ITIX
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadStatus}
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          <span>Actualiser le statut</span>
        </Button>
      </div>

      <ErrorBox message={error} />

      {loading && !status && <Spinner />}

      {status && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* État de la configuration */}
          <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#EFE9DC] pb-3">
              <h2 className="font-serif text-base font-bold text-[#111111]">
                Paramètres SMTP Actuels
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${
                  status.configured
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : "bg-amber-50 text-amber-800 border border-amber-300"
                }`}
              >
                {status.configured ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                )}
                <span>{status.configured ? "Opérationnel" : "Configuration Incomplète"}</span>
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-[#FAF8F3] pb-2">
                <span className="text-[#8C877E]">Serveur hôte (SMTP_HOST) :</span>
                <span className="font-mono text-[#111111] font-semibold">
                  {status.smtp_host || "(non défini)"}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#FAF8F3] pb-2">
                <span className="text-[#8C877E]">Port (SMTP_PORT) :</span>
                <span className="font-mono text-[#111111] font-semibold">
                  {status.smtp_port}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#FAF8F3] pb-2">
                <span className="text-[#8C877E]">Expéditeur (SMTP_FROM) :</span>
                <span className="text-[#111111] font-medium">
                  {status.smtp_from || "(non défini)"}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#FAF8F3] pb-2">
                <span className="text-[#8C877E]">Utilisateur (SMTP_USERNAME) :</span>
                <span className="text-[#111111] font-medium">
                  {status.smtp_username || "(aucun)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8C877E]">Mot de passe (SMTP_PASSWORD) :</span>
                <span
                  className={`font-semibold ${
                    status.has_password ? "text-[#2E6F40]" : "text-[#9E2A2B]"
                  }`}
                >
                  {status.has_password ? "Renseigné (.env)" : "Non configuré"}
                </span>
              </div>
            </div>

            <div className="border border-[#E4DCD0] bg-[#FAF8F3] p-3 text-xs text-[#55524B] flex items-start gap-2">
              <Info className="h-4 w-4 text-[#C6A15B] shrink-0 mt-0.5" />
              <span>
                Les paramètres de connexion SMTP sont gérés de manière sécurisée dans le fichier <code>.env</code>.
              </span>
            </div>
          </div>

          {/* Formulaire de test d'envoi */}
          <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-6 shadow-sm space-y-5">
            <div className="border-b border-[#EFE9DC] pb-3">
              <h2 className="font-serif text-base font-bold text-[#111111]">
                Test de Délivrabilité
              </h2>
              <p className="text-xs text-[#66625B] mt-0.5">
                Vérifiez la transmission immédiate des e-mails vers une adresse réelle.
              </p>
            </div>

            <form onSubmit={handleTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#66625B] uppercase tracking-wider mb-1.5">
                  Adresse e-mail destinataire
                </label>
                <input
                  type="email"
                  required
                  placeholder="nom@exemple.com"
                  className={inputCls}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={sending}
                className="w-full justify-center py-2.5 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                <span>
                  {sending
                    ? "Connexion SMTP & Envoi en cours…"
                    : "Envoyer un e-mail de test"}
                </span>
              </Button>
            </form>

            {/* Résultat du test */}
            {result && (
              <div
                className={`p-4 text-xs border ${
                  result.success
                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                    : "border-red-300 bg-red-50 text-red-950"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-700 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <p className="font-serif font-bold text-sm">
                      {result.success
                        ? "E-mail transmis avec succès !"
                        : "Échec de l'envoi SMTP"}
                    </p>
                    <p className="opacity-90 leading-relaxed">
                      {result.success ? result.message : result.error}
                    </p>
                    {result.hint && (
                      <div className="mt-2 border border-red-200 bg-white/70 p-3 text-xs text-[#303030]">
                        <strong className="text-amber-800">Conseil :</strong>{" "}
                        {result.hint}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guide de configuration Gmail */}
      <div className="border border-[#E4DCD0] bg-[#FAF8F3] p-6 space-y-3">
        <h3 className="font-serif text-sm font-bold text-[#111111] flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[#C6A15B]" />
          <span>Procédure de Configuration Gmail SMTP (Mot de passe d'application)</span>
        </h3>
        <p className="text-xs text-[#55524B] leading-relaxed">
          Google requiert un mot de passe d'application dédié pour autoriser les envois SMTP :
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#55524B] ml-1">
          <li>
            Accédez à la gestion de votre compte Google sur{" "}
            <a
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#641C2D] underline"
            >
              myaccount.google.com/security
            </a>.
          </li>
          <li>Activez la Validation en deux étapes si ce n'est pas déjà fait.</li>
          <li>
            Rendez-vous dans la section <b>Mots de passe d'application</b> (ou sur{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#641C2D] underline"
            >
              https://myaccount.google.com/apppasswords
            </a>
            ).
          </li>
          <li>Créez une application nommée <code>ITIX Platform</code>.</li>
          <li>Copiez le mot de passe de 16 caractères et reportez-le dans le fichier <code>.env</code>.</li>
        </ol>
      </div>
    </div>
  );
}
