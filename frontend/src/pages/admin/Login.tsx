import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Lock, ArrowLeft } from "../../components/icons";
import { errorMessage } from "../../api/client";
import { ErrorBox } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { ItixLogo } from "../../components/Layouts";

export default function Login() {
  const { isAuth, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuth) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      nav("/admin");
    } catch (err) {
      setError(errorMessage(err, "Identifiants invalides."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#111111] text-[#F7F3EA]">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 border border-[#2A2A2A] bg-[#181818] p-8 shadow-xl"
      >
        <div className="text-center space-y-3 pb-2 border-b border-[#2A2A2A]">
          <div className="flex justify-center mb-1">
            <ItixLogo size="default" variant="light" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C6A15B] block">
              Espace Gestionnaire
            </span>
            <h1 className="font-serif text-lg font-bold text-[#FFFFFF]">
              Connexion Administration
            </h1>
          </div>
        </div>

        <div className="space-y-4 pt-1">
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

        <div className="pt-2 text-center border-t border-[#2A2A2A]">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#9E9B94] hover:text-[#C6A15B]"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Retour au portail billetterie</span>
          </Link>
        </div>
      </form>
    </div>
  );
}
