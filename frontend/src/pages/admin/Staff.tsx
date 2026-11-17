import { useEffect, useState } from "react";
import { Users, Plus, RefreshCw, Trash2, ShieldCheck, CheckCircle2, ScanLine } from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Spinner, inputCls } from "../../components/ui";
import type { Concert, StaffMember } from "../../types";
import { formatDateTime } from "../../utils/format";

export default function Staff() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Modal création
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assignedConcertId, setAssignedConcertId] = useState<number | "">("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRes, concertsRes] = await Promise.all([
        api.get<StaffMember[]>("/api/admin/staff"),
        api.get<Concert[]>("/api/admin/concerts"),
      ]);
      setStaffList(staffRes.data);
      setConcerts(concertsRes.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setSaving(true);
    setError("");
    setSuccess(null);

    try {
      const { data } = await api.post("/api/admin/staff", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        assigned_concert_id: assignedConcertId ? Number(assignedConcertId) : null,
      });

      setSuccess(data.message || "Sous-compte contrôleur créé avec succès.");
      setShowModal(false);
      setName("");
      setEmail("");
      setPassword("");
      setAssignedConcertId("");
      loadData();
    } catch (e) {
      setError(errorMessage(e, "Échec de création du sous-compte contrôleur."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (staffId: number, staffName: string) => {
    if (!window.confirm(`Supprimer l'accès du contrôleur « ${staffName} » ?`)) return;

    setError("");
    setSuccess(null);
    try {
      await api.delete(`/api/admin/staff/${staffId}`);
      setSuccess(`Accès révoqué pour ${staffName}.`);
      loadData();
    } catch (e) {
      setError(errorMessage(e, "Échec de suppression."));
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECEAE6] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Équipe Terrain & Sécurité
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#111111] mt-0.5">
            Sous-comptes Contrôleurs (Staff Scanner)
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Déléguez le contrôle des billets à l'entrée de vos événements sans divulguer vos données financières.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setShowModal(true);
              setError("");
              setSuccess(null);
            }}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un contrôleur</span>
          </Button>

          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </Button>
        </div>
      </div>

      <ErrorBox message={error} />

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Info Card Sécurité */}
      <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-4 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#641C2D] shrink-0 mt-0.5" />
        <div className="text-xs text-[#555555] space-y-1">
          <p className="font-semibold text-[#111111]">
            Cloisonnement strict des accès pour votre personnel de sécurité
          </p>
          <p className="text-[11px] leading-relaxed">
            Les comptes <strong>STAFF_SCANNER</strong> ont un accès exclusivement restreint à la caméra de validation des billets (QR Code).
            Ils ne peuvent à aucun moment consulter vos statistiques de vente, vos finances, vos coordonnées bancaires ou la liste de vos spectateurs.
          </p>
        </div>
      </div>

      {/* Tableau des Contrôleurs */}
      <div className="bg-white border border-[#ECEAE6] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#ECEAE6] bg-[#FAF9F6] flex items-center justify-between">
          <h2 className="font-serif font-bold text-sm text-[#111111] flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-[#641C2D]" />
            <span>Contrôleurs enregistrés</span>
          </h2>
          <span className="text-xs text-[#777777]">
            {staffList.length} membre(s)
          </span>
        </div>

        {loading && staffList.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-12 p-4 text-xs text-[#777777]">
            Aucun sous-compte contrôleur n'a encore été créé. Cliquez sur « Ajouter un contrôleur » pour en créer un.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] text-[#555555] uppercase text-[10px] tracking-wider border-b border-[#ECEAE6]">
                <tr>
                  <th className="px-4 py-3">Nom du contrôleur</th>
                  <th className="px-4 py-3">E-mail de connexion</th>
                  <th className="px-4 py-3">Événement affecté</th>
                  <th className="px-4 py-3">Date création</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE6]">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 font-semibold text-[#111111]">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-[#555555] font-mono text-[11px]">
                      {s.email}
                    </td>
                    <td className="px-4 py-3">
                      {s.assigned_concert_name ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF9F6] border border-[#DCD9D3] text-[#111111]">
                          {s.assigned_concert_name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">
                          Tous vos événements
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#777777] whitespace-nowrap">
                      {formatDateTime(s.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteStaff(s.id, s.name)}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 cursor-pointer"
                        title="Révoquer l'accès"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Création Contrôleur */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#ECEAE6] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECEAE6] pb-3">
              <h3 className="font-serif font-bold text-base text-[#111111] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#641C2D]" />
                <span>Créer un sous-compte contrôleur</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Nom du contrôleur / Poste *
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Ex : Porte VIP - Andry"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Adresse e-mail de connexion *
                </label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="Ex : staff1@mon-organisation.mg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Mot de passe d'accès *
                </label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Affectation à un événement spécifique (optionnel)
                </label>
                <select
                  className={inputCls}
                  value={assignedConcertId}
                  onChange={(e) => setAssignedConcertId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Tous mes événements</option>
                  {concerts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({new Date(c.date).toLocaleDateString("fr-FR")})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Si sélectionné, le contrôleur ne pourra scanner que les billets de ce concert.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#ECEAE6]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Annuler
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="cursor-pointer"
                >
                  {saving ? "Création…" : "Créer le compte"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
