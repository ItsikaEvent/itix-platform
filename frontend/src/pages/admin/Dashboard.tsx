import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Ticket,
  CheckCircle2,
  Receipt,
  ScanLine,
  Users,
  AlertCircle,
  ArrowUpRight,
  Download,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox, Spinner, inputCls } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { Concert, Dashboard as Dash, Organizer } from "../../types";
import { formatAr } from "../../utils/format";

export default function Dashboard() {
  const nav = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [concertId, setConcertId] = useState("");
  const [organizerId, setOrganizerId] = useState<number | "">("");
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Organizer[]>("/api/admin/organizers").then((r) => setOrganizers(r.data)).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const url = isSuperAdmin && organizerId
      ? `/api/admin/concerts?organizer_id=${organizerId}`
      : "/api/admin/concerts";
    api
      .get<Concert[]>(url)
      .then((r) => setConcerts(r.data))
      .catch(() => {});
  }, [isSuperAdmin, organizerId]);

  useEffect(() => {
    setData(null);
    const params: Record<string, any> = {};
    if (concertId) params.concert_id = concertId;
    if (isSuperAdmin && organizerId) params.organizer_id = organizerId;

    api
      .get<Dash>("/api/admin/dashboard", { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [concertId, organizerId]);

  const go = (extra: Record<string, string>, cid = concertId) => {
    const p = new URLSearchParams(extra);
    if (cid) p.set("concert_id", cid);
    if (isSuperAdmin && organizerId) p.set("organizer_id", String(organizerId));
    nav(`/admin/orders?${p}`);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const params: Record<string, any> = {};
      if (concertId) params.concert_id = concertId;
      if (isSuperAdmin && organizerId) params.organizer_id = organizerId;
      const res = await api.get("/api/admin/orders/export-csv", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `commandes_itix_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e, "Échec du téléchargement du fichier CSV."));
    } finally {
      setExporting(false);
    }
  };

  const t = data?.totals;
  const cards: [
    string,
    string | number,
    string,
    typeof Ticket,
    string,
    (() => void) | null
  ][] = t
    ? [
        ["Places totales", t.total_seats, "text-[#111111]", Users, "text-[#66625B]", null],
        ["Commandées", t.ordered, "text-[#641C2D]", Receipt, "text-[#641C2D]", () => go({ status: "ACTIVE" })],
        ["Payées validées", t.paid, "text-[#2E6F40]", CheckCircle2, "text-[#2E6F40]", () => go({ payment: "PAID", status: "ACTIVE" })],
        ["Règlement sur place", t.unpaid, "text-[#B47818]", Clock, "text-[#B47818]", () => go({ payment: "NOT_PAID", status: "ACTIVE" })],
        ["Places disponibles", t.remaining, "text-[#303030]", Ticket, "text-[#C6A15B]", null],
        ["En attente validation", t.orders_pending, "text-[#641C2D]", AlertCircle, "text-[#641C2D]", () => go({ status: "PENDING" })],
        ["E-Billets émis", t.tickets_generated, "text-[#303030]", Ticket, "text-[#C6A15B]", () => go({ status: "ACCEPTED" })],
        ["Billets scannés", t.tickets_used, "text-[#2E6F40]", ScanLine, "text-[#2E6F40]", null],
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with event and organizer filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECEAE6] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            {isSuperAdmin ? "Supervision Globale de la Plateforme" : "Supervision de vos Événements"}
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Tableau de Bord ITIX
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Indicateurs de ventes, réservations et suivi des recettes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Export CSV Button */}
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={exporting || !data}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#641C2D]" />
            <span>{exporting ? "Exportation…" : "Exporter en CSV"}</span>
          </Button>

          {/* Super Admin: Organizer Filter */}
          {isSuperAdmin && organizers.length > 0 && (
            <div className="w-full sm:w-52">
              <select
                className={inputCls}
                value={organizerId}
                onChange={(e) => {
                  setOrganizerId(e.target.value ? Number(e.target.value) : "");
                  setConcertId("");
                }}
              >
                <option value="">Tous les organisateurs</option>
                {organizers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Concert Filter */}
          <div className="w-full sm:w-60">
            <select
              className={inputCls}
              value={concertId}
              onChange={(e) => setConcertId(e.target.value)}
            >
              <option value="">Tous les événements</option>
              {concerts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ErrorBox message={error} />
      {!data && !error && <Spinner />}

      {data && (
        <>
          {/* Modèle Économique : Synthèse Financière */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#66625B] block">
                Ventes Brutes Encaissées
              </span>
              <p className="font-serif text-xl font-bold text-[#111111] mt-1">
                {formatAr(data.totals.revenue_paid)}
              </p>
              <span className="text-[10px] text-[#888888] mt-0.5 block">Total encaissé</span>
            </div>

            <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#641C2D] block">
                Commission ITIX
              </span>
              <p className="font-serif text-xl font-bold text-[#641C2D] mt-1">
                {formatAr(data.totals.commission_amount ?? 0)}
              </p>
              <span className="text-[10px] text-[#888888] mt-0.5 block">Part plateforme</span>
            </div>

            <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2E6F40] block">
                Net Organisateur
              </span>
              <p className="font-serif text-xl font-bold text-[#2E6F40] mt-1">
                {formatAr(data.totals.net_revenue ?? 0)}
              </p>
              <span className="text-[10px] text-[#888888] mt-0.5 block">Brut - Commission</span>
            </div>

            <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#66625B] block">
                Déjà Reversé
              </span>
              <p className="font-serif text-xl font-bold text-[#111111] mt-1">
                {formatAr(data.totals.payouts_total ?? 0)}
              </p>
              <span className="text-[10px] text-[#888888] mt-0.5 block">Virements effectués</span>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 block">
                Solde Restant Dû
              </span>
              <p className="font-serif text-xl font-bold text-amber-900 mt-1">
                {formatAr(data.totals.balance_due ?? 0)}
              </p>
              <span className="text-[10px] text-amber-700 mt-0.5 block">À verser à l'organisateur</span>
            </div>
          </div>

          {/* Jauges de Présence & Remplissage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#ECEAE6] bg-white p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111111] flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-[#641C2D]" />
                  <span>Taux de remplissage global</span>
                </span>
                <span className="font-mono font-bold text-sm text-[#641C2D]">
                  {data.totals.overall_fill_rate ?? 0}%
                </span>
              </div>
              <div className="w-full bg-[#FAF9F6] border border-[#ECEAE6] rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#641C2D] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.totals.overall_fill_rate ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#777777]">
                {data.totals.ordered} places commandées sur {data.totals.total_seats} disponibles.
              </p>
            </div>

            <div className="rounded-xl border border-[#ECEAE6] bg-white p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111111] flex items-center gap-1.5">
                  <ScanLine className="w-4 h-4 text-[#2E6F40]" />
                  <span>Taux de présence & émargement</span>
                </span>
                <span className="font-mono font-bold text-sm text-[#2E6F40]">
                  {data.totals.overall_attendance_rate ?? 0}%
                </span>
              </div>
              <div className="w-full bg-[#FAF9F6] border border-[#ECEAE6] rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#2E6F40] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.totals.overall_attendance_rate ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#777777]">
                {data.totals.tickets_used} billets scannés à l'entrée sur {data.totals.tickets_generated} émis.
              </p>
            </div>
          </div>

          {/* Operational Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map(([lbl, val, col, Icon, iconCol, action], i) => (
              <div
                key={i}
                onClick={action ?? undefined}
                className={`relative rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 shadow-xs transition-all ${
                  action
                    ? "cursor-pointer hover:border-[#641C2D] hover:shadow-md"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#66625B] line-clamp-1">
                    {lbl}
                  </span>
                  <Icon className={`h-4 w-4 ${iconCol}`} />
                </div>
                <p className={`font-serif text-2xl font-bold mt-2 ${col}`}>{val}</p>
                {action && (
                  <span className="absolute bottom-2 right-2 text-[10px] text-[#641C2D] font-semibold flex items-center">
                    Détail <ArrowUpRight className="h-3 w-3 ml-0.5" />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Per-Concert Breakdown */}
          <div className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] shadow-xs overflow-hidden">
            <div className="border-b border-[#ECEAE6] px-5 py-4 bg-[#FAF9F6] flex items-center justify-between">
              <h2 className="font-serif font-bold text-[#111111] text-sm">
                Récapitulatif Détaillé par Événement
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#ECEAE6] bg-[#FAF9F6] text-[#555555]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Concert / Événement</th>
                    {isSuperAdmin && <th className="px-4 py-3 font-semibold">Organisateur</th>}
                    <th className="px-4 py-3 font-semibold">Remplissage</th>
                    <th className="px-4 py-3 font-semibold">Présence</th>
                    <th className="px-4 py-3 font-semibold">Recettes Brutes</th>
                    <th className="px-4 py-3 font-semibold">Commission</th>
                    <th className="px-4 py-3 font-semibold">Net Organisateur</th>
                    <th className="px-5 py-3 font-semibold">Sur place</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F0EC]">
                  {data.per_concert.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="px-5 py-3.5 font-serif font-bold text-[#111111]">{r.name}</td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3.5 text-[#641C2D] font-semibold">
                          {r.organizer_name || "ITIX"}
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#111111]">{r.fill_rate ?? 0}%</span>
                          <span className="text-[10px] text-[#777777]">({r.ordered}/{r.total_seats})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#2E6F40]">{r.attendance_rate ?? 0}%</span>
                          <span className="text-[10px] text-[#777777]">({r.tickets_used ?? 0}/{r.tickets_generated ?? 0})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#111111]">
                        {formatAr(r.revenue_paid)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[#641C2D]">
                        {formatAr(r.commission_amount ?? 0)}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#2E6F40]">
                        {formatAr(r.net_revenue ?? (r.revenue_paid - (r.commission_amount ?? 0)))}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[#B47818]">
                        {formatAr(r.revenue_pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.per_concert.length === 0 && (
              <p className="p-8 text-center text-xs text-[#8C877E]">
                Aucun événement configuré pour le moment.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
