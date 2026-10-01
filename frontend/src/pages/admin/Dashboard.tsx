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
import type { Concert, Dashboard as Dash } from "../../types";
import { formatAr } from "../../utils/format";

export default function Dashboard() {
  const nav = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [concertId, setConcertId] = useState("");
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Concert[]>("/api/concerts")
      .then((r) => setConcerts(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .get<Dash>("/api/admin/dashboard", {
        params: { concert_id: concertId || undefined },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [concertId]);

  const go = (extra: Record<string, string>, cid = concertId) => {
    const p = new URLSearchParams(extra);
    if (cid) p.set("concert_id", cid);
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
      {/* Header with event filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DCD0] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B]">
            Supervision Générale
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Tableau de Bord ITIX
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Suivi des réservations, recettes billetterie et jauges en temps réel
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <select
            className={`${inputCls} sm:w-64 text-xs`}
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

      <ErrorBox message={error} />
      {!data && !error && <Spinner />}

      {t && (
        <>
          {/* Revenue Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#66625B]">
                  Recettes billetterie encaissées
                </span>
                <Coins className="h-5 w-5 text-[#2E6F40]" />
              </div>
              <p className="mt-3 font-serif text-3xl font-bold text-[#2E6F40]">
                {formatAr(t.revenue_paid)}
              </p>
              <p className="mt-1 text-xs text-[#66625B]">
                Paiements validés et titres confirmés
              </p>
            </div>

            <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#66625B]">
                  Montant en attente / sur place
                </span>
                <Clock className="h-5 w-5 text-[#B47818]" />
              </div>
              <p className="mt-3 font-serif text-3xl font-bold text-[#B47818]">
                {formatAr(t.revenue_pending)}
              </p>
              <p className="mt-1 text-xs text-[#66625B]">
                Réservations directes ou paiements en cours de vérification
              </p>
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map(([label, value, color, Icon, iconColor, onClick]) => (
              <button
                key={label}
                disabled={!onClick}
                onClick={onClick ?? undefined}
                className={`border border-[#E4DCD0] bg-[#FFFFFF] p-5 text-left ${
                  onClick
                    ? "hover:border-[#C6A15B] cursor-pointer"
                    : "cursor-default"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#66625B]">{label}</span>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <p className={`font-serif text-2xl font-bold ${color}`}>{value}</p>
                {onClick && (
                  <p className="mt-2 text-[11px] font-semibold text-[#641C2D] flex items-center gap-1">
                    <span>Voir les commandes</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Table Breakdown */}
          <div className="border border-[#E4DCD0] bg-[#FFFFFF] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#E4DCD0] bg-[#FAF8F3]">
              <h2 className="font-serif text-base font-bold text-[#111111]">
                Bilan analytique par concert
              </h2>
              <p className="text-xs text-[#66625B] mt-0.5">
                Capacités, volume de ventes et recettes par représentation
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="itix-table text-xs">
                <thead>
                  <tr>
                    <th>Concert / Récital</th>
                    <th>Jauge</th>
                    <th>Commandes</th>
                    <th>Payées</th>
                    <th>Sur place</th>
                    <th>Recettes Encaissées</th>
                    <th>En attente</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.per_concert.map((r) => (
                    <tr key={r.id}>
                      <td className="font-serif font-bold text-[#111111]">{r.name}</td>
                      <td className="text-[#66625B]">{r.total_seats}</td>
                      <td>
                        <button
                          className="font-semibold text-[#641C2D] hover:underline"
                          onClick={() => go({ status: "ACTIVE" }, String(r.id))}
                        >
                          {r.ordered}
                        </button>
                      </td>
                      <td>
                        <button
                          className="font-semibold text-[#2E6F40] hover:underline"
                          onClick={() =>
                            go({ payment: "PAID", status: "ACTIVE" }, String(r.id))
                          }
                        >
                          {r.paid}
                        </button>
                      </td>
                      <td>
                        <button
                          className="font-semibold text-[#B47818] hover:underline"
                          onClick={() =>
                            go({ payment: "NOT_PAID", status: "ACTIVE" }, String(r.id))
                          }
                        >
                          {r.unpaid}
                        </button>
                      </td>
                      <td className="font-serif font-bold text-[#2E6F40]">
                        {formatAr(r.revenue_paid)}
                      </td>
                      <td className="font-serif font-bold text-[#B47818]">
                        {formatAr(r.revenue_pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data!.per_concert.length === 0 && (
              <p className="p-6 text-center text-xs text-[#8C877E]">
                Aucun événement configuré pour le moment.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
