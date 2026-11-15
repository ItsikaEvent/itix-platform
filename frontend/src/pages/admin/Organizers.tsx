import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  KeyRound,
  Phone,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Modal, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { Organizer } from "../../types";
import { formatAr } from "../../utils/format";

export default function Organizers() {
  const { isSuperAdmin } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "", temp_password: "" });
  const [creating, setCreating] = useState(false);
  const [createSuccessData, setCreateSuccessData] = useState<{ email: string; temp: string } | null>(null);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<Organizer | null>(null);
  const [resetting, setResetting] = useState(false);
  const [newTempPass, setNewTempPass] = useState<string | null>(null);

  // Copied feedback
  const [copied, setCopied] = useState(false);

  const fetchOrganizers = () => {
    setLoading(true);
    api
      .get<Organizer[]>("/api/admin/organizers")
      .then((r) => setOrganizers(r.data))
      .catch((e) => setError(errorMessage(e, "Impossible de charger les organisateurs.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchOrganizers();
    }
  }, [isSuperAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await api.post("/api/admin/organizers", createForm);
      setCreateSuccessData({
        email: res.data.email,
        temp: res.data.temporary_password,
      });
      setCreateForm({ name: "", email: "", phone: "", temp_password: "" });
      fetchOrganizers();
    } catch (err) {
      setError(errorMessage(err, "Erreur lors de la création de l'organisateur."));
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (orgId: number) => {
    setResetting(true);
    setError("");
    try {
      const res = await api.post(`/api/admin/organizers/${orgId}/reset-password`);
      setNewTempPass(res.data.temporary_password);
      fetchOrganizers();
    } catch (err) {
      setError(errorMessage(err, "Erreur lors de la réinitialisation du mot de passe."));
    } finally {
      setResetting(false);
    }
  };

  const handleToggleActive = async (org: Organizer) => {
    try {
      await api.put(`/api/admin/organizers/${org.id}`, { is_active: !org.is_active });
      fetchOrganizers();
    } catch (err) {
      setError(errorMessage(err, "Erreur lors du changement de statut."));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isSuperAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h2 className="font-bold text-base">Accès Restreint</h2>
        <p className="text-xs mt-1">Seul le Super Administrateur peut gérer les comptes organisateurs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECEAE6] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Gestion Multi-Tenants & SaaS
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Organisateurs Partenaires
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Créez des accès indépendants et étanches pour chaque organisateur de spectacle.
          </p>
        </div>

        <Button onClick={() => { setCreateSuccessData(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          <span>Nouvel Organisateur</span>
        </Button>
      </div>

      <ErrorBox message={error} />
      {loading && !organizers && <Spinner />}

      {/* Organizers Table */}
      {organizers && (
        <div className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#ECEAE6] bg-[#FAF9F6] text-[#555555]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Organisateur / Contact</th>
                  <th className="px-4 py-3 font-semibold">Rôle & Page Publique</th>
                  <th className="px-4 py-3 font-semibold">Événements</th>
                  <th className="px-4 py-3 font-semibold">Ventes & Revenus</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0EC]">
                {organizers.map((org) => (
                  <tr key={org.id} className="hover:bg-[#FAF9F6] transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm text-[#111111]">{org.name}</div>
                      <div className="text-[#666666]">{org.email}</div>
                      {org.phone && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-[#888888] mt-0.5">
                          <Phone className="h-3 w-3" />
                          <span>{org.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          org.role === "SUPER_ADMIN"
                            ? "bg-purple-100 text-purple-900 border border-purple-200"
                            : "bg-[#F8F7F4] text-[#641C2D] border border-[#ECEAE6]"
                        }`}>
                          {org.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ORGANISATEUR"}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Link
                          to={`/organisateurs/${org.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#641C2D] hover:underline"
                        >
                          <span>Voir vitrine</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-semibold text-sm text-[#111111]">
                        {org.concerts_count}
                      </span>
                      <span className="text-[#777777] ml-1">concerts</span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-semibold text-xs text-[#111111]">
                        {formatAr(org.revenue_total)}
                      </div>
                      <div className="text-[11px] text-[#777777]">
                        {org.orders_count} commande{org.orders_count > 1 ? "s" : ""}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${org.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-xs font-medium text-[#444444]">
                          {org.is_active ? "Actif" : "Désactivé"}
                        </span>
                      </div>
                      {org.must_change_password && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-block">
                          Mot de passe temp.
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => { setResetTarget(org); setNewTempPass(null); }}
                        className="p-1.5 text-[#555555] hover:text-[#641C2D] hover:bg-[#FAF9F6] rounded-lg border border-[#ECEAE6] transition-colors"
                        title="Réinitialiser le mot de passe"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>

                      {org.role !== "SUPER_ADMIN" && (
                        <button
                          onClick={() => handleToggleActive(org)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                            org.is_active
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {org.is_active ? "Désactiver" : "Activer"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Création Organisateur */}
      {createOpen && (
        <Modal
          onClose={() => setCreateOpen(false)}
          title="Créer un nouveau compte Organisateur"
        >
          {createSuccessData ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Compte organisateur créé avec succès !</span>
                </div>
                <p className="text-xs mt-1 text-emerald-800">
                  Transmettez ces identifiants à l'organisateur. Il sera invité à modifier son mot de passe dès sa première connexion.
                </p>
              </div>

              <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-4 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-[#666666]">E-mail de connexion :</span>
                  <div className="font-mono font-bold text-sm text-[#111111]">{createSuccessData.email}</div>
                </div>
                <div>
                  <span className="text-[#666666]">Mot de passe temporaire :</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="font-mono font-bold text-sm bg-white px-3 py-1.5 rounded-lg border border-[#DCD9D3] text-[#641C2D]">
                      {createSuccessData.temp}
                    </div>
                    <button
                      onClick={() => copyToClipboard(createSuccessData.temp)}
                      className="p-2 text-xs font-semibold rounded-lg border border-[#DCD9D3] hover:bg-[#F2F0EC]"
                    >
                      {copied ? "Copié !" : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button onClick={() => setCreateOpen(false)} className="w-full">
                Fermer
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1">
                  Nom de l'organisateur ou de l'entité *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Ex. Live Nation Madagascar, Ivokolo..."
                  className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#333333] mb-1">
                    Adresse e-mail (identifiant) *
                  </label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="contact@organisateur.mg"
                    className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333333] mb-1">
                    Numéro de téléphone
                  </label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+261 34 00 000 00"
                    className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1">
                  Mot de passe temporaire (laisser vide pour auto-génération)
                </label>
                <input
                  type="text"
                  value={createForm.temp_password}
                  onChange={(e) => setCreateForm({ ...createForm, temp_password: e.target.value })}
                  placeholder="Généré automatiquement si vide"
                  className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-xs text-[#666666] hover:text-[#111111]"
                >
                  Annuler
                </button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Création en cours..." : "Créer le compte"}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Modal Réinitialiser Mot de passe */}
      {resetTarget && (
        <Modal
          onClose={() => setResetTarget(null)}
          title={`Réinitialiser le mot de passe de ${resetTarget.name}`}
        >
          {newTempPass ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 text-xs">
                <strong>Mot de passe réinitialisé !</strong>
                <p className="mt-1">
                  L'organisateur devra modifier ce mot de passe temporaire lors de sa prochaine connexion.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#FAF9F6] border border-[#ECEAE6] p-3 rounded-xl">
                <span className="font-mono font-bold text-sm text-[#641C2D] flex-1">
                  {newTempPass}
                </span>
                <button
                  onClick={() => copyToClipboard(newTempPass)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DCD9D3] hover:bg-[#F2F0EC]"
                >
                  {copied ? "Copié !" : "Copier"}
                </button>
              </div>

              <Button onClick={() => setResetTarget(null)} className="w-full">
                Terminé
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#555555]">
                Êtes-vous sûr de vouloir générer un nouveau mot de passe temporaire pour{" "}
                <strong>{resetTarget.email}</strong> ?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-xs text-[#666666] hover:text-[#111111]"
                >
                  Annuler
                </button>
                <Button
                  onClick={() => handleResetPassword(resetTarget.id)}
                  disabled={resetting}
                >
                  {resetting ? "Génération..." : "Générer un mot de passe temporaire"}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
