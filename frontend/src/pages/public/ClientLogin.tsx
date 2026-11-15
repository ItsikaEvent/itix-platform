import { useState, type FormEvent } from "react";
import { Ticket, ArrowRight, ArrowLeft, Info, Shield, KeyRound, QrCode, Copy, Check } from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { useClientAuth } from "../../context/ClientAuthContext";
import { Button, ErrorBox, inputCls } from "../../components/ui";

interface ClientLoginProps {
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

type AuthStep = "EMAIL" | "SETUP_QR" | "ENTER_CODE";

export default function ClientLogin({
  onSuccess,
  title,
  subtitle,
}: ClientLoginProps) {
  const { loginClient } = useClientAuth();
  const [step, setStep] = useState<AuthStep>("EMAIL");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Données de configuration TOTP (pour la première configuration)
  const [setupData, setSetupData] = useState<{
    secret: string;
    uri: string;
    qr_code: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Étape 1 : Vérifier le statut du compte
  const handleCheckEmail = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post<{
        has_account: boolean;
        is_verified: boolean;
        name: string;
      }>("/api/client/auth/check", { email: cleanEmail });

      if (data.name && !name) {
        setName(data.name);
      }

      if (data.has_account && data.is_verified) {
        // Le compte existe et a déjà été configuré avec Google Authenticator
        setStep("ENTER_CODE");
      } else {
        // Le compte doit configurer son application d'authentification
        await triggerSetup(cleanEmail, name || data.name || "Spectateur");
      }
    } catch (err) {
      setError(errorMessage(err, "Impossible de vérifier ce compte."));
    } finally {
      setLoading(false);
    }
  };

  // Déclencher la génération du QR Code TOTP
  const triggerSetup = async (targetEmail: string, targetName: string) => {
    const { data } = await api.post<{
      secret: string;
      uri: string;
      qr_code: string;
    }>("/api/client/auth/setup", {
      email: targetEmail,
      name: targetName || "Spectateur",
    });
    setSetupData(data);
    setStep("SETUP_QR");
  };

  // Étape 2 ou 3 : Vérifier le code TOTP à 6 chiffres
  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setError("Le code doit comporter 6 chiffres.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post<{
        access_token: string;
        user: { name: string; email: string };
      }>("/api/client/auth/verify", {
        email: email.trim().toLowerCase(),
        code: cleanCode,
      });

      loginClient(data.access_token, data.user);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Code invalide. Vérifiez l'heure de votre appareil."));
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-md border border-[#ECEAE6] bg-[#FFFFFF] p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center bg-[#FAF9F6] text-[#641C2D] border border-[#ECEAE6] rounded-xl mb-3">
          {step === "SETUP_QR" ? (
            <QrCode className="h-6 w-6 text-[#641C2D]" />
          ) : step === "ENTER_CODE" ? (
            <KeyRound className="h-6 w-6 text-[#641C2D]" />
          ) : (
            <Ticket className="h-6 w-6 text-[#641C2D]" />
          )}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#641C2D] block mb-1">
          Espace Sécurisé Client
        </span>
        <h2 className="font-serif text-2xl font-bold text-[#111111]">
          {step === "SETUP_QR"
            ? "Lier votre Authentificateur"
            : step === "ENTER_CODE"
            ? "Code d'Accès Sécurisé"
            : title || "Espace Client ITIX"}
        </h2>
        <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
          {step === "SETUP_QR"
            ? "Scannez ce QR Code dans Google Authenticator, Microsoft Authenticator ou FreeOTP."
            : step === "ENTER_CODE"
            ? `Entrez le code à 6 chiffres affiché sur votre application pour ${email}.`
            : subtitle ||
              "Identifiez-vous pour consulter vos billets et QR Codes certifiés en toute sécurité."}
        </p>
      </div>

      <ErrorBox message={error} />

      {/* Étape 1 : Saisie de l'e-mail */}
      {step === "EMAIL" && (
        <form onSubmit={handleCheckEmail} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555555] uppercase tracking-wider mb-1.5">
              Votre Prénom / Nom
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Jean Dupont"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555555] uppercase tracking-wider mb-1.5">
              Votre adresse e-mail
            </label>
            <input
              type="email"
              required
              placeholder="jean@example.com"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-[#777777] mt-1.5 flex items-center gap-1.5">
              <Info className="h-3 w-3 text-[#641C2D] shrink-0" />
              <span>Indiquez l'e-mail utilisé lors de votre réservation de billets.</span>
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !email.trim() || !name.trim()}
              className="w-full justify-center py-2.5 text-xs font-semibold"
            >
              <span>{loading ? "Vérification…" : "Continuer"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      )}

      {/* Étape 2 : Configuration QR Code TOTP */}
      {step === "SETUP_QR" && setupData && (
        <form onSubmit={handleVerifyCode} className="space-y-5 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-4 text-center space-y-3">
            <div className="mx-auto w-48 h-48 bg-white p-2 rounded-lg border border-[#ECEAE6] shadow-sm flex items-center justify-center">
              <img
                src={setupData.qr_code}
                alt="QR Code d'authentification Google Authenticator"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#111111]">
                Application d'authentification compatible :
              </p>
              <p className="text-[11px] text-[#666666]">
                Google Authenticator, Microsoft Authenticator, FreeOTP ou Apple Keychain.
              </p>
            </div>

            {/* Secret Manuel */}
            <div className="pt-2 border-t border-[#ECEAE6] flex items-center justify-between text-[11px]">
              <span className="text-[#666666] font-mono truncate max-w-[200px]">
                Clé : {setupData.secret}
              </span>
              <button
                type="button"
                onClick={copySecret}
                className="inline-flex items-center gap-1 text-[#641C2D] hover:underline font-semibold"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copié !" : "Copier"}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555555] uppercase tracking-wider mb-1.5 text-center">
              Code à 6 chiffres affiché sur l'application
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className={`${inputCls} text-center tracking-[0.35em] text-lg font-mono font-bold`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              disabled={loading || code.trim().length !== 6}
              className="w-full justify-center py-2.5 text-xs font-semibold"
            >
              <Shield className="h-3.5 w-3.5 mr-1" />
              <span>{loading ? "Validation en cours…" : "Valider et ouvrir mes billets"}</span>
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("EMAIL");
                setCode("");
                setError("");
              }}
              className="w-full text-center text-xs text-[#666666] hover:text-[#111111] py-1 flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Changer d'adresse e-mail</span>
            </button>
          </div>
        </form>
      )}

      {/* Étape 3 : Saisie directe du code TOTP */}
      {step === "ENTER_CODE" && (
        <form onSubmit={handleVerifyCode} className="space-y-5 animate-in fade-in duration-200">
          <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#111111]">
              <Shield className="h-4 w-4 text-[#641C2D]" />
              <span>Protection 2FA Active</span>
            </div>
            <p className="text-[11px] text-[#666666]">
              Ouvrez votre application d'authentification mobile et saisissez le code actuel pour <strong>{email}</strong>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555555] uppercase tracking-wider mb-1.5 text-center">
              Code à 6 chiffres
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className={`${inputCls} text-center tracking-[0.35em] text-xl font-mono font-bold`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              disabled={loading || code.trim().length !== 6}
              className="w-full justify-center py-2.5 text-xs font-semibold"
            >
              <Shield className="h-3.5 w-3.5 mr-1" />
              <span>{loading ? "Vérification…" : "Déverrouiller mes billets"}</span>
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("EMAIL");
                setCode("");
                setError("");
              }}
              className="w-full text-center text-xs text-[#666666] hover:text-[#111111] py-1 flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Utiliser une autre adresse e-mail</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
