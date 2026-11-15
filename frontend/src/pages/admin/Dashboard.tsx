import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Coins,
  Clock,
  Ticket,
  CheckCircle2,
  Receipt,
  ScanLine,
  Users,
  AlertCircle,
  ArrowUpRight,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { ErrorBox, Spinner, inputCls } from "../../components/ui";
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
          {/* Super Admin: Organizer Filter */}
          {isSuperAdmin && organizers.length > 0 && (
            <div className="w-full sm:w-56">
              <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                Organisateur
              </label>
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
          <div className="w-full sm:w-64">
            <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
              Événement
            </label>
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
          {/* Revenue KPI Highlight */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#66625B]">
                  Recettes Encaissées (Paiements Validés)
                </span>
                <Coins className="h-5 w-5 text-[#2E6F40]" />
              </div>
              <p className="font-serif text-3xl font-extrabold text-[#2E6F40] mt-2">
                {formatAr(data.totals.revenue_paid)}
              </p>
              <p className="text-[11px] text-[#8C877E] mt-1">
                Paiements mobiles confirmés et reçus vérifiés
              </p>
            </div>

            <div className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#66625B]">
                  Potentiel à Encaisser (Sur Place)
                </span>
                <Clock className="h-5 w-5 text-[#B47818]" />
              </div>
              <p className="font-serif text-3xl font-extrabold text-[#B47818] mt-2">
                {formatAr(data.totals.revenue_pending)}
              </p>
              <p className="text-[11px] text-[#8C877E] mt-1">
                Réservations valides avec règlement aux guichets
              </p>
            </div>
          </div>

          {/* Operational Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map(([lbl, val, col, Icon, iconCol, action], i) => (
              <div
                key={i}
                onClick={action ?? undefined}
                className={`relative rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-4 shadow-sm transition-all ${
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
          <div className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] shadow-sm overflow-hidden">
            <div className="border-b border-[#ECEAE6] px-5 py-4 bg-[#FAF9F6] flex items-center justify-between">
              <h2 className="font-serif font-bold text-[#111111] text-sm">
                Récapitulatif Financier par Événement
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#ECEAE6] bg-[#FAF9F6] text-[#555555]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Concert / Récital</th>
                    {isSuperAdmin && <th className="px-4 py-3 font-semibold">Organisateur</th>}
                    <th className="px-4 py-3 font-semibold">Jauge</th>
                    <th className="px-4 py-3 font-semibold">Commandes</th>
                    <th className="px-4 py-3 font-semibold">Payées</th>
                    <th className="px-4 py-3 font-semibold">Sur place</th>
                    <th className="px-4 py-3 font-semibold">Recettes Encaissées</th>
                    <th className="px-5 py-3 font-semibold">En attente</th>
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
                      <td className="px-4 py-3.5 text-[#66625B]">{r.total_seats}</td>
                      <td className="px-4 py-3.5">
                        <button
                          className="font-semibold text-[#641C2D] hover:underline"
                          onClick={() => go({ status: "ACTIVE" }, String(r.id))}
                        >
                          {r.ordered}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          className="font-semibold text-[#2E6F40] hover:underline"
                          onClick={() => go({ payment: "PAID", status: "ACTIVE" }, String(r.id))}
                        >
                          {r.paid}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          className="font-semibold text-[#B47818] hover:underline"
                          onClick={() => go({ payment: "NOT_PAID", status: "ACTIVE" }, String(r.id))}
                        >
                          {r.unpaid}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 font-serif font-bold text-[#2E6F40]">
                        {formatAr(r.revenue_paid)}
                      </td>
                      <td className="px-5 py-3.5 font-serif font-bold text-[#B47818]">
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
