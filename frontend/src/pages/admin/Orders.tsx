import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import {
  Badge,
  Button,
  ErrorBox,
  Modal,
  ORDER_STATUS,
  PAY_STATUS,
  Spinner,
  inputCls,
} from "../../components/ui";
import type { Concert, Delivery, Order } from "../../types";
import { formatAr, formatDateTime } from "../../utils/format";

function OrderModal({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "accept" | "reject">("view");
  const [markPaid, setMarkPaid] = useState(false);
  const [reason, setReason] = useState("");
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<Order>(`/api/admin/orders/${orderId}`);
      setOrder(data);
      setMarkPaid(data.payment_status !== "UNPAID");
      if (data.has_proof && !proofUrl) {
        const r = await api.get(`/api/admin/orders/${orderId}/proof`, {
          responseType: "blob",
        });
        setProofUrl(URL.createObjectURL(r.data));
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = () =>
    act(async () => {
      const { data } = await api.post<Delivery>(
        `/api/admin/orders/${orderId}/accept`,
        { mark_paid: markPaid }
      );
      setDelivery(data);
      setMode("view");
    });

  const reject = (e: FormEvent) => {
    e.preventDefault();
    act(async () => {
      await api.post(`/api/admin/orders/${orderId}/reject`, { reason });
      setMode("view");
    });
  };

  const pay = () =>
    act(async () => {
      await api.post(`/api/admin/orders/${orderId}/mark-paid`);
    });

  const resend = () =>
    act(async () => {
      const { data } = await api.post<Delivery>(
        `/api/admin/orders/${orderId}/resend`
      );
      setDelivery(data);
    });

  if (!order)
    return (
      <Modal title="Détail de la commande" onClose={onClose}>
        {error ? <ErrorBox message={error} /> : <Spinner />}
      </Modal>
    );

  const [sl, st] = ORDER_STATUS[order.status];
  const [pl, pt] = PAY_STATUS[order.payment_status];

  return (
    <Modal title={`Commande Réf. ${order.reference}`} onClose={onClose} wide>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3 text-xs text-[#303030]">
          <div className="border border-[#E4DCD0] bg-[#FAF8F3] p-4 space-y-2">
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Auditeur / Client
              </span>
              <strong className="text-[#111111] text-sm">{order.customer_name}</strong>
            </p>
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Adresse de contact
              </span>
              <span className="text-[#641C2D] font-medium">{order.customer_email}</span>
            </p>
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Représentation
              </span>
              <strong className="text-[#111111]">{order.concert_name}</strong>
            </p>
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Catégorie & Places
              </span>
              <span>
                {order.quantity} × {order.ticket_type_name} ({formatAr(order.unit_price)})
              </span>
            </p>
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Montant total
              </span>
              <strong className="font-serif text-base text-[#111111]">
                {formatAr(order.total_amount)}
              </strong>
            </p>
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Option choisie
              </span>
              <span>
                {order.pay_mode === "PAY_NOW"
                  ? "Paiement en ligne immédiat"
                  : "Réservation avec règlement sur place"}
              </span>
            </p>
            <p>
              <span className="text-[#8C877E] uppercase tracking-wider font-semibold block text-[10px]">
                Date d'enregistrement
              </span>
              <span>{formatDateTime(order.created_at)}</span>
            </p>
            <div className="flex gap-2 pt-2 border-t border-[#E4DCD0]">
              <Badge tone={st}>{sl}</Badge>
              <Badge tone={pt}>{pl}</Badge>
            </div>
          </div>

          {order.reject_reason && (
            <div className="border border-red-300 bg-red-50 p-3 text-red-900 text-xs">
              <strong>Motif du refus :</strong> {order.reject_reason}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-[#111111] uppercase tracking-wider">
            Reçu ou Preuve de paiement
          </p>
          {proofUrl ? (
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="block border border-[#D4C9BA] bg-[#FAF8F3] p-2"
            >
              <img
                src={proofUrl}
                alt="Preuve de paiement"
                className="max-h-56 object-contain mx-auto"
              />
            </a>
          ) : (
            <div className="flex h-40 items-center justify-center border border-dashed border-[#D4C9BA] bg-[#FAF8F3] text-xs text-[#8C877E]">
              {order.has_proof
                ? "Chargement du reçu…"
                : "Aucun document joint à cette réservation."}
            </div>
          )}
        </div>
      </div>

      {order.tickets.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-[#E4DCD0] pt-4">
          <p className="text-xs font-bold text-[#111111] uppercase tracking-wider">
            Titres d'accès officiels ({order.tickets.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {order.tickets.map((t) => (
              <Badge
                key={t.number}
                tone={t.status === "USED" ? "gray" : "green"}
              >
                {t.number} &bull;{" "}
                {t.status === "USED" ? "scanné à l'entrée" : "valide"}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {delivery && (
        <div className="mt-5 border border-emerald-300 bg-emerald-50 p-4 space-y-3">
          <p className="text-xs font-bold text-emerald-900">
            {delivery.tickets.length} QR Code(s) unique(s) généré(s).{" "}
            {delivery.email_status === "queued"
              ? `E-mail transmis à ${order.customer_email}.`
              : "Notification : e-mail en attente d'envoi."}
          </p>
          <div className="flex flex-wrap gap-3">
            {delivery.tickets.map((t) => (
              <figure
                key={t.number}
                className="text-center border border-emerald-200 bg-[#FFFFFF] p-2"
              >
                <img
                  src={t.qr_image}
                  alt={`QR ${t.number}`}
                  className="h-28 w-28 object-contain"
                />
                <figcaption className="text-[10px] font-mono font-bold mt-1 text-[#111111]">
                  {t.number}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <ErrorBox message={error} />
      </div>

      {mode === "accept" && (
        <div className="mt-4 space-y-3 border border-[#C6A15B] bg-[#FAF8F3] p-4">
          <p className="font-serif text-xs font-bold text-[#111111]">
            Validation & Émission des E-Billets
          </p>
          <p className="text-xs text-[#55524B]">
            {order.quantity} QR Code(s) officiels vont être générés pour{" "}
            <strong className="text-[#111111]">{order.customer_email}</strong>.
          </p>
          <label className="flex items-center gap-2 text-xs text-[#303030] cursor-pointer">
            <input
              type="checkbox"
              checked={markPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
              className="accent-[#641C2D]"
            />
            Confirmer que le règlement est perçu / encaissé
          </label>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setMode("view")}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={accept}
              className="text-xs"
            >
              {busy ? "Génération en cours…" : "Valider & Émettre les billets"}
            </Button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <form
          onSubmit={reject}
          className="mt-4 space-y-3 border border-red-300 bg-red-50 p-4"
        >
          <p className="font-serif text-xs font-bold text-red-900">
            Motif de non-validation
          </p>
          <textarea
            className={inputCls}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            placeholder="Ex: Paiement non perçu, montant erroné…"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("view")}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={busy}
              className="text-xs"
            >
              Confirmer le refus
            </Button>
          </div>
        </form>
      )}

      {mode === "view" && (
        <div className="mt-6 flex flex-wrap gap-2 pt-3 border-t border-[#E4DCD0]">
          {order.status === "PENDING" && (
            <>
              <Button
                variant="primary"
                onClick={() => setMode("accept")}
                className="text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                <span>Accepter la commande</span>
              </Button>
              <Button
                variant="danger"
                onClick={() => setMode("reject")}
                className="text-xs"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                <span>Refuser</span>
              </Button>
            </>
          )}
          {order.status === "ACCEPTED" && order.payment_status !== "PAID" && (
            <Button
              variant="gold"
              disabled={busy}
              onClick={pay}
              className="text-xs"
            >
              Marquer comme payé
            </Button>
          )}
          {order.status === "ACCEPTED" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={resend}
              className="text-xs"
            >
              <Mail className="h-3.5 w-3.5 mr-1" />
              <span>Renvoyer les e-billets</span>
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const concertId = params.get("concert_id") ?? "";
  const status = params.get("status") ?? "";
  const payment = params.get("payment") ?? "";
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);

  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [search, setSearch] = useState(q);
  const [data, setData] = useState<{
    items: Order[];
    total: number;
    page_size: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k !== "page") p.delete("page");
    setParams(p);
  };

  useEffect(() => {
    api
      .get<Concert[]>("/api/concerts")
      .then((r) => setConcerts(r.data))
      .catch(() => {});
  }, []);

  const load = () =>
    api
      .get("/api/admin/orders", {
        params: {
          concert_id: concertId || undefined,
          status: status || undefined,
          payment: payment || undefined,
          q: q || undefined,
          page,
          page_size: 15,
        },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertId, status, payment, q, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DCD0] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B]">
            Registre des Ventes
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Commandes & Réservations de Billetterie
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Validation des accès, contrôle des paiements et gestion des envois
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          className={inputCls}
          value={concertId}
          onChange={(e) => setParam("concert_id", e.target.value)}
        >
          <option value="">Tous les événements</option>
          {concerts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className={inputCls}
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="">Tous les statuts de commande</option>
          <option value="ACTIVE">Commandes actives (hors refus)</option>
          <option value="PENDING">En attente de validation</option>
          <option value="ACCEPTED">Commandes validées</option>
          <option value="REJECTED">Commandes refusées</option>
        </select>

        <select
          className={inputCls}
          value={payment}
          onChange={(e) => setParam("payment", e.target.value)}
        >
          <option value="">Tous les statuts de paiement</option>
          <option value="PAID">Paiements validés</option>
          <option value="NOT_PAID">Règlement sur place</option>
          <option value="PROOF_SUBMITTED">Reçu transmis</option>
        </select>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", search.trim());
          }}
          className="flex gap-2"
        >
          <input
            className={inputCls}
            placeholder="Nom, e-mail, réf…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="outline" className="px-3">
            <Search className="h-4 w-4 text-[#641C2D]" />
          </Button>
        </form>
      </div>

      <ErrorBox message={error} />
      {!data && !error && <Spinner />}

      {data && (
        <div className="border border-[#E4DCD0] bg-[#FFFFFF] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="itix-table text-xs">
              <thead>
                <tr>
                  <th>Réf.</th>
                  <th>Auditeur / Contact</th>
                  <th>Concert</th>
                  <th>Places</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Paiement</th>
                  <th>Date</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => {
                  const [sl, st] = ORDER_STATUS[o.status];
                  const [pl, pt] = PAY_STATUS[o.payment_status];

                  return (
                    <tr key={o.id}>
                      <td className="font-mono font-bold text-[#641C2D]">
                        {o.reference}
                      </td>
                      <td>
                        <strong className="text-[#111111] block">{o.customer_name}</strong>
                        <span className="text-[11px] text-[#66625B]">
                          {o.customer_email}
                        </span>
                      </td>
                      <td className="font-serif text-[#111111] font-medium">
                        {o.concert_name}
                      </td>
                      <td className="whitespace-nowrap text-[#55524B]">
                        {o.quantity} × {o.ticket_type_name}
                      </td>
                      <td className="whitespace-nowrap font-serif font-bold text-[#111111]">
                        {formatAr(o.total_amount)}
                      </td>
                      <td>
                        <Badge tone={st}>{sl}</Badge>
                      </td>
                      <td>
                        <Badge tone={pt}>{pl}</Badge>
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-[#66625B]">
                        {formatDateTime(o.created_at)}
                      </td>
                      <td className="text-right">
                        <Button
                          variant="outline"
                          className="text-xs py-1 px-3"
                          onClick={() => setOpenId(o.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span>Consulter</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.items.length === 0 && (
            <p className="p-8 text-center text-xs text-[#8C877E]">
              Aucune commande ne correspond aux filtres sélectionnés.
            </p>
          )}
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setParam("page", String(page - 1))}
            className="text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            <span>Précédent</span>
          </Button>
          <span className="text-xs font-semibold text-[#66625B]">
            Page {page} sur {pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= pages}
            onClick={() => setParam("page", String(page + 1))}
            className="text-xs"
          >
            <span>Suivant</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}

      {openId !== null && (
        <OrderModal
          orderId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
