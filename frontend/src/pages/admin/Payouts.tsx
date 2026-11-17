import { useEffect, useState } from "react";
import { Coins, Plus, RefreshCw, CheckCircle2 } from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Spinner, inputCls } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { Organizer, Payout } from "../../types";
import { formatAr, formatDateTime } from "../../utils/format";

export default function Payouts() {
  const { isSuperAdmin } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Modal création reversement (Super Admin)
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOrgId, setFormOrgId] = useState<number | "">("");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formMethod, setFormMethod] = useState("MVOLA");
  const [formRef, setFormRef] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [payoutsRes, orgsRes] = await Promise.all([
        api.get<Payout[]>("/api/admin/payouts"),
        isSuperAdmin ? api.get<Organizer[]>("/api/admin/organizers") : Promise.resolve({ data: [] }),
      ]);
      setPayouts(payoutsRes.data);
      if (isSuperAdmin) {
        setOrganizers(orgsRes.data.filter((o) => o.role === "ORGANIZER"));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isSuperAdmin]);

  const handleCreatePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOrgId || !formAmount || !formRef.trim()) return;

    setSaving(true);
    setError("");
    setSuccess(null);

    try {
      const { data } = await api.post("/api/admin/payouts", {
        organizer_id: Number(formOrgId),
        amount: Number(formAmount),
        payment_method: formMethod,
        reference: formRef.trim(),
        notes: formNotes.trim() || undefined,
      });

      setSuccess(data.message || "Reversement enregistré avec succès.");
      setShowModal(false);
      setFormOrgId("");
      setFormAmount("");
      setFormRef("");
      setFormNotes("");
      loadData();
    } catch (e) {
      setError(errorMessage(e, "Échec de l'enregistrement du reversement."));
    } finally {
      setSaving(false);
    }
  };

  const totalPayouts = payouts.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECEAE6] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Modèle Économique ITIX
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#111111] mt-0.5">
            Reversements aux Organisateurs (Payouts)
          </h1>
          <p className="text-xs text-[#666666] mt-1">
            Traçabilité des fonds encaissés, déduction des commissions plateforme et reversements effectués.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
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
              <span>Nouveau reversement</span>
            </Button>
          )}

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider block">
            Total Reversé
          </span>
          <span className="font-mono text-2xl font-bold text-[#111111] mt-1 block">
            {formatAr(totalPayouts)}
          </span>
          <span className="text-[10px] text-[#888888] mt-0.5 block">
            Cumul des paiements effectués
          </span>
        </div>

        <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider block">
            Nombre de virements
          </span>
          <span className="font-mono text-2xl font-bold text-[#641C2D] mt-1 block">
            {payouts.length}
          </span>
          <span className="text-[10px] text-[#888888] mt-0.5 block">
            Transactions enregistrées
          </span>
        </div>

        <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider block">
            Modes de paiement
          </span>
          <span className="text-xs font-semibold text-[#333333] mt-2 block">
            Mobile Money (MVola, Orange, Airtel) & Virements
          </span>
          <span className="text-[10px] text-[#888888] mt-0.5 block">
            Comptes vérifiés
          </span>
        </div>
      </div>

      {/* Tableau des Reversements */}
      <div className="bg-white border border-[#ECEAE6] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#ECEAE6] bg-[#FAF9F6] flex items-center justify-between">
          <h2 className="font-serif font-bold text-sm text-[#111111] flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#641C2D]" />
            <span>Historique des versements</span>
          </h2>
          <span className="text-xs text-[#777777]">
            {payouts.length} versement(s)
          </span>
        </div>

        {loading && payouts.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-12 p-4 text-xs text-[#777777]">
            Aucun versement n'a encore été enregistré.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] text-[#555555] uppercase text-[10px] tracking-wider border-b border-[#ECEAE6]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Organisateur</th>
                  <th className="px-4 py-3">Opérateur / Moyen</th>
                  <th className="px-4 py-3">Référence transaction</th>
                  <th className="px-4 py-3 text-right">Montant reversé</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE6]">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 text-[#555555] whitespace-nowrap">
                      {formatDateTime(p.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#111111] whitespace-nowrap">
                      {p.organizer_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ECEAE6] text-[#333333]">
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#444444]">
                      {p.reference}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-sm text-[#641C2D] text-right whitespace-nowrap">
                      {formatAr(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#777777] max-w-xs truncate">
                      {p.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Enregistrement Reversement (Super Admin) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-[#ECEAE6] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECEAE6] pb-3">
              <h3 className="font-serif font-bold text-base text-[#111111] flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#641C2D]" />
                <span>Enregistrer un reversement</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Organisateur bénéficiaire *
                </label>
                <select
                  className={inputCls}
                  value={formOrgId}
                  onChange={(e) => setFormOrgId(e.target.value ? Number(e.target.value) : "")}
                  required
                >
                  <option value="">-- Choisir un organisateur --</option>
                  {organizers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} (Solde dû : {formatAr(o.balance_due)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Montant reversé (en Ariary) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  className={inputCls}
                  placeholder="Ex : 500000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value ? Number(e.target.value) : "")}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Moyen de paiement *
                  </label>
                  <select
                    className={inputCls}
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    required
                  >
                    <option value="MVOLA">MVOLA</option>
                    <option value="ORANGE_MONEY">ORANGE MONEY</option>
                    <option value="AIRTEL_MONEY">AIRTEL MONEY</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CASH">Espèces</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1">
                    Référence transaction *
                  </label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Ex: MV-202611-1234"
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1">
                  Notes / Détails internes
                </label>
                <textarea
                  className={inputCls}
                  rows={2}
                  placeholder="Ex: Acompte sur billetterie du concert Festival..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
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
                  {saving ? "Enregistrement…" : "Confirmer le versement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
