import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Lock, ArrowLeft, ShieldCheck, KeyRound } from "../../components/icons";
import { errorMessage } from "../../api/client";
import { ErrorBox } from "../../components/ui";
import { useAuth, type LoginResult } from "../../context/AuthContext";
import { ItixLogo } from "../../components/Layouts";

type LoginStep = "credentials" | "totp_setup" | "totp_verify";

export default function Login() {
  const { isAuth, user, login, verifyTotp } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingLogin, setPendingLogin] = useState<LoginResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuth) {
    if (user?.role === "STAFF_SCANNER") {
      return <Navigate to="/admin/scanner" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await login(email, password);
      if (res.requires_totp_setup) {
        setPendingLogin(res);
        setStep("totp_setup");
      } else if (res.requires_totp) {
        setPendingLogin(res);
        setStep("totp_verify");
      } else {
        if (res.role === "STAFF_SCANNER") {
          nav("/admin/scanner");
        } else {
          nav("/admin");
        }
      }
    } catch (err) {
      setError(errorMessage(err, "Identifiants invalides ou compte inactif."));
    } finally {
      setBusy(false);
    }
  };

  const handleTotpVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingLogin) return;
    setBusy(true);
    setError("");

    const targetToken = pendingLogin.setup_token || pendingLogin.auth_token;
    if (!targetToken) {
      setError("Session A2F expirée. Veuillez vous reconnecter.");
      setBusy(false);
      return;
    }

    try {
      const res = await verifyTotp(targetToken, totpCode.trim());
      if (res.role === "STAFF_SCANNER") {
        nav("/admin/scanner");
      } else {
        nav("/admin");
      }
    } catch (err) {
      setError(errorMessage(err, "Code A2F incorrect. Vérifiez l'heure de votre appareil."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#111111] text-[#F7F3EA]">
      <div className="w-full max-w-sm space-y-5 border border-[#2A2A2A] bg-[#181818] p-8 shadow-xl">
        <div className="text-center space-y-3 pb-2 border-b border-[#2A2A2A]">
          <div className="flex justify-center mb-1">
            <ItixLogo size="default" variant="light" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C6A15B] block">
              Espace Gestionnaire
            </span>
            <h1 className="font-serif text-lg font-bold text-[#FFFFFF]">
              {step === "totp_setup"
                ? "Configuration A2F Obligatoire"
                : step === "totp_verify"
                ? "Vérification en deux étapes"
                : "Connexion Administration"}
            </h1>
          </div>
        </div>

        {step === "credentials" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[#9E9B94] uppercase tracking-wider mb-1.5">
                Adresse E-mail
              </label>
              <input
                type="email"
                className="w-full rounded bg-[#222222] border border-[#333333] px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#66625B] focus:border-[#C6A15B] focus:outline-none"
                value={email}
                placeholder="admin@itix.mg"
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9E9B94] uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                className="w-full rounded bg-[#222222] border border-[#333333] px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#66625B] focus:border-[#C6A15B] focus:outline-none"
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <ErrorBox message={error} />

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-[#641C2D] text-[#F7F3EA] hover:bg-[#4E1422] py-2.5 text-xs font-semibold border border-[#641C2D] disabled:opacity-50 cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5 text-[#C6A15B]" />
              <span>{busy ? "Vérification…" : "Se connecter"}</span>
            </button>
          </form>
        )}

        {step === "totp_setup" && (
          <form onSubmit={handleTotpVerifySubmit} className="space-y-4 pt-1">
            <div className="bg-[#222222] border border-[#333333] p-3 rounded text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs text-[#C6A15B] font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Sécurité renforcée requise</span>
              </div>
              <p className="text-[11px] text-[#9E9B94] leading-relaxed">
                Scannez ce QR Code avec <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong> :
              </p>
              {pendingLogin?.qr_code && (
                <div className="flex justify-center p-2 bg-white rounded my-2 inline-block">
                  <img
                    src={pendingLogin.qr_code}
                    alt="QR Code TOTP 2FA"
                    className="w-40 h-40 object-contain mx-auto"
                  />
                </div>
              )}
              {pendingLogin?.secret && (
                <div className="text-[10px] text-[#A8A49E] font-mono select-all bg-[#181818] p-1.5 rounded border border-[#2A2A2A]">
                  Clé manuelle : <span className="text-[#C6A15B]">{pendingLogin.secret}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9E9B94] uppercase tracking-wider mb-1.5">
                Code de validation à 6 chiffres
              </label>
              <input
                type="text"
                maxLength={6}
                pattern="[0-9]{6}"
                className="w-full text-center tracking-[0.5em] text-lg font-mono rounded bg-[#222222] border border-[#333333] px-3 py-2 text-[#FFFFFF] focus:border-[#C6A15B] focus:outline-none"
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
            </div>

            <ErrorBox message={error} />

            <button
              type="submit"
              disabled={busy || totpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-[#641C2D] text-[#F7F3EA] hover:bg-[#4E1422] py-2.5 text-xs font-semibold border border-[#641C2D] disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#C6A15B]" />
              <span>{busy ? "Validation…" : "Activer & Accéder"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setPendingLogin(null);
                setTotpCode("");
                setError("");
              }}
              className="w-full text-center text-xs text-[#9E9B94] hover:text-[#F7F3EA]"
            >
              Annuler et retourner
            </button>
          </form>
        )}

        {step === "totp_verify" && (
          <form onSubmit={handleTotpVerifySubmit} className="space-y-4 pt-1">
            <div className="text-center space-y-1">
              <div className="flex justify-center text-[#C6A15B] mb-1">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <p className="text-xs text-[#9E9B94]">
                Entrez le code à 6 chiffres affiché sur votre application d'authentification pour <strong>{pendingLogin?.email}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9E9B94] uppercase tracking-wider mb-1.5 text-center">
                Code Authenticator (TOTP)
              </label>
              <input
                type="text"
                maxLength={6}
                pattern="[0-9]{6}"
                className="w-full text-center tracking-[0.5em] text-xl font-mono rounded bg-[#222222] border border-[#333333] px-3 py-2 text-[#FFFFFF] focus:border-[#C6A15B] focus:outline-none"
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
            </div>

            <ErrorBox message={error} />

            <button
              type="submit"
              disabled={busy || totpCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-[#641C2D] text-[#F7F3EA] hover:bg-[#4E1422] py-2.5 text-xs font-semibold border border-[#641C2D] disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#C6A15B]" />
              <span>{busy ? "Vérification…" : "Confirmer la connexion"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setPendingLogin(null);
                setTotpCode("");
                setError("");
              }}
              className="w-full text-center text-xs text-[#9E9B94] hover:text-[#F7F3EA]"
            >
              Annuler et retourner
            </button>
          </form>
        )}

        <div className="pt-2 text-center border-t border-[#2A2A2A]">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#9E9B94] hover:text-[#C6A15B]"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Retour au site public</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
