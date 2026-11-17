import { useState, type FormEvent } from "react";
import { Ticket, ArrowRight, ArrowLeft, Shield, KeyRound, Sparkles } from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { useClientAuth } from "../../context/ClientAuthContext";
import { Button, ErrorBox, inputCls } from "../../components/ui";

interface ClientLoginProps {
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

type AuthStep = "EMAIL" | "ENTER_CODE";

export default function ClientLogin({
  onSuccess,
  title,
  subtitle,
}: ClientLoginProps) {
  const { loginClient } = useClientAuth();
  const [step, setStep] = useState<AuthStep>("EMAIL");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setError("");
    setLoading(true);

    try {
      // 1. Vérification du statut A2F du compte
      const { data: checkData } = await api.post<{
        has_account: boolean;
        totp_enabled: boolean;
        name: string;
      }>("/api/client/auth/check", { email: cleanEmail });

      if (checkData.totp_enabled) {
        // Le spectateur a activé l'A2F : demander le code à 6 chiffres
        setStep("ENTER_CODE");
        setLoading(false);
        return;
      }

      // 2. Par défaut : connexion directe et simple avec l'adresse e-mail
      const { data: loginData } = await api.post<{
        access_token: string;
        user: { name: string; email: string; totp_enabled?: boolean };
      }>("/api/client/auth/login-simple", { email: cleanEmail });

      loginClient(loginData.access_token, loginData.user);
      onSuccess?.();
    } catch (err) {
      setError(errorMessage(err, "Impossible de vous connecter. Vérifiez votre adresse e-mail."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotpSubmit = async (e: FormEvent) => {
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
        user: { name: string; email: string; totp_enabled?: boolean };
      }>("/api/client/auth/verify", {
        email: email.trim().toLowerCase(),
        code: cleanCode,
      });

      loginClient(data.access_token, { ...data.user, totp_enabled: true });
      onSuccess?.();
    } catch (err) {
      setError(errorMessage(err, "Code de sécurité incorrect. Vérifiez votre application."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#181818] border border-[#2A2A2A] p-6 sm:p-8 rounded-none shadow-2xl">
      {/* En-tête */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#641C2D]/20 border border-[#641C2D] text-[#C6A15B] mb-3">
          {step === "ENTER_CODE" ? <Shield className="w-6 h-6" /> : <Ticket className="w-6 h-6" />}
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#F7F3EA]">
          {title || (step === "ENTER_CODE" ? "Vérification en deux étapes" : "Espace Spectateur")}
        </h2>
        <p className="text-xs text-[#9E9B94] mt-1.5 leading-relaxed">
          {subtitle ||
            (step === "ENTER_CODE"
              ? `Saisissez le code de validation pour ${email}`
              : "Accédez instantanément à vos billets et réservations avec votre e-mail.")}
        </p>
      </div>

      <ErrorBox message={error} />

      {/* Étape 1 : Connexion simple par e-mail */}
      {step === "EMAIL" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#9E9B94] uppercase tracking-wider mb-1.5">
              Adresse e-mail
            </label>
            <input
              type="email"
              className={inputCls}
              placeholder="votre.email@exemple.mg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="bg-[#222222] border border-[#333333] p-3 text-[11px] text-[#A8A49E] flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#C6A15B] shrink-0 mt-0.5" />
            <span>
              Accès simplifié sans mot de passe complexe. Vous pourrez optionnellement activer la protection A2F dans votre espace.
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full flex items-center justify-center gap-2 cursor-pointer py-3 text-sm"
            disabled={loading}
          >
            <span>{loading ? "Vérification…" : "Accéder à mes billets"}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      )}

      {/* Étape 2 : Vérification TOTP (si le client a activé l'A2F) */}
      {step === "ENTER_CODE" && (
        <form onSubmit={handleVerifyTotpSubmit} className="space-y-5">
          <div className="bg-[#222222] border border-[#333333] p-3 text-xs text-[#C6A15B] flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Protection A2F active</p>
              <p className="text-[11px] text-[#A8A49E] mt-0.5">
                Ouvrez votre application (Google Authenticator) et saisissez le code temporaire.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9E9B94] uppercase tracking-wider mb-2 text-center">
              Code à 6 chiffres
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 rounded-none bg-[#222222] border border-[#333333] text-white focus:border-[#C6A15B] focus:outline-none"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full flex items-center justify-center gap-2 cursor-pointer py-3 text-sm"
            disabled={loading || code.length !== 6}
          >
            <span>{loading ? "Vérification…" : "Valider mon code"}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep("EMAIL");
              setCode("");
              setError("");
            }}
            className="w-full text-center text-xs text-[#9E9B94] hover:text-[#F7F3EA] flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Changer d'adresse e-mail</span>
          </button>
        </form>
      )}
    </div>
  );
}
