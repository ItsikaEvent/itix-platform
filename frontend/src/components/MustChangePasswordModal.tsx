import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { KeyRound, CheckCircle2 } from "./icons";
import { Button, ErrorBox } from "./ui";
import { errorMessage } from "../api/client";

export function MustChangePasswordModal() {
  const { user, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!user || !user.must_change_password) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err, "Impossible de modifier le mot de passe."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl border border-[#ECEAE6] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#641C2D] text-white flex items-center justify-center shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#111111]">
              Définir votre mot de passe permanent
            </h3>
            <p className="text-xs text-[#666666]">
              Action de sécurité obligatoire requise lors de votre première connexion.
            </p>
          </div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-3 rounded-xl text-xs text-[#555555]">
          Bienvenue sur votre espace gestionnaire <strong>{user.name}</strong>. Veuillez choisir un nouveau mot de passe sécurisé pour remplacer le mot de passe temporaire qui vous a été attribué.
        </div>

        <ErrorBox message={error} />

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>Votre mot de passe a été mis à jour avec succès ! Redirection en cours...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">
                Nouveau mot de passe (min. 8 caractères) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">
                Confirmez le nouveau mot de passe *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enregistrement..." : "Enregistrer mon mot de passe et continuer"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
