import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  CheckCircle2,
  CreditCard,
  Building2,
  Info,
  Music,
  AlertTriangle,
} from "../../components/icons";
import { api, errorMessage, fileUrl } from "../../api/client";
import { useClientAuth } from "../../context/ClientAuthContext";
import {
  Badge,
  Button,
  CONCERT_STATUS,
  ErrorBox,
  Field,
  Modal,
  Spinner,
  inputCls,
} from "../../components/ui";
import type { Concert } from "../../types";
import { formatAr, formatDate, formatTime } from "../../utils/format";

const MAX_MB = 4;

export default function ConcertPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { clientUser, loginClient } = useClientAuth();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [loadError, setLoadError] = useState("");
  const [instructions, setInstructions] = useState("");

  const [name, setName] = useState(clientUser?.name || "");
  const [email, setEmail] = useState(clientUser?.email || "");
  const [typeId, setTypeId] = useState<number | "">("");
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"PAY_NOW" | "RESERVE">("RESERVE");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    quantity: number;
    email: string;
    reference: string;
  } | null>(null);

  const load = () =>
    api
      .get<Concert>(`/api/concerts/${id}`)
      .then((r) => {
        setConcert(r.data);
        setTypeId(
          (cur) => cur || r.data.ticket_types.find((t) => t.remaining > 0)?.id || ""
        );
      })
      .catch((e) => setLoadError(errorMessage(e, "Événement introuvable.")));

  useEffect(() => {
    load();
    api
      .get("/api/config")
      .then((r) => setInstructions(r.data.payment_instructions))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const type = concert?.ticket_types.find((t) => t.id === typeId);
  const maxQty = Math.max(1, Math.min(10, type?.remaining ?? 1));
  const total = (type?.price ?? 0) * qty;
  const proofPreview = useMemo(() => (proof ? URL.createObjectURL(proof) : null), [proof]);

  if (loadError)
    return (
      <div className="p-8 max-w-lg mx-auto">
        <ErrorBox message={loadError} />
      </div>
    );
  if (!concert) return <Spinner />;
  const [label, tone] = CONCERT_STATUS[concert.status];
  const closed = concert.status === "FINISHED" || concert.status === "SOLD_OUT";

  const onProof = (f: File | null) => {
    setError("");
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setError(`Le fichier envoyé est trop volumineux (max ${MAX_MB} Mo).`);
      return;
    }
    if (f && !["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Format accepté : JPG, PNG ou WEBP.");
      return;
    }
    setProof(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!type) return setError("Choisissez un type de billet.");
    if (mode === "PAY_NOW" && !proof)
      return setError("Ajoutez la capture de votre transaction.");
    const fd = new FormData();
    fd.append("concert_id", String(concert.id));
    fd.append("ticket_type_id", String(type.id));
    fd.append("quantity", String(qty));
    fd.append("customer_name", name);
    fd.append("customer_email", email);
    fd.append("pay_mode", mode);
    if (mode === "PAY_NOW" && proof) fd.append("proof", proof);
    setBusy(true);
    try {
      const { data } = await api.post("/api/orders", fd);
      loginClient(name, email);
      setDone({
        quantity: data.quantity,
        email: data.customer_email,
        reference: data.reference,
      });
      setQty(1);
      setProof(null);
      setMode("RESERVE");
      load();
    } catch (err) {
      setError(errorMessage(err));
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        to="/billetterie"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#555555] hover:text-[#641C2D]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Retour à la billetterie</span>
      </Link>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left column: Poster & Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-[#ECEAE6] bg-[#111111] overflow-hidden relative shadow-sm">
            <div className="aspect-[4/5] bg-[#111111]">
              {concert.poster_url ? (
                <img
                  src={fileUrl(concert.poster_url)!}
                  alt={`Affiche ${concert.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#666666]">
                  <Music className="h-16 w-16 text-[#641C2D]" />
                </div>
              )}
            </div>
            <div className="absolute top-4 right-4">
              <Badge tone={tone}>{label}</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 space-y-3.5 shadow-sm">
            <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider border-b border-[#ECEAE6] pb-2.5">
              Informations Pratiques
            </h3>
            <div className="space-y-3 text-xs text-[#303030]">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#ECEAE6] shrink-0">
                  <Calendar className="h-4 w-4 text-[#641C2D]" />
                </div>
                <div>
                  <span className="font-semibold text-[#111111] block">Date & Heure</span>
                  <p className="text-[#555555]">
                    {formatDate(concert.date)} à {formatTime(concert.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#ECEAE6] shrink-0">
                  <MapPin className="h-4 w-4 text-[#641C2D]" />
                </div>
                <div>
                  <span className="font-semibold text-[#111111] block">Lieu / Salle</span>
                  <p className="text-[#555555]">{concert.venue}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#ECEAE6] shrink-0">
                  <Ticket className="h-4 w-4 text-[#641C2D]" />
                </div>
                <div>
                  <span className="font-semibold text-[#111111] block">Disponibilité</span>
                  <p className="text-[#555555]">{concert.remaining} places restantes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Description & Order Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3 border-b border-[#ECEAE6] pb-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
              Représentation
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#111111] leading-tight">
              {concert.name}
            </h1>
            {concert.description && (
              <p className="whitespace-pre-line text-sm text-[#555555] leading-relaxed">
                {concert.description}
              </p>
            )}
          </div>

          {closed ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-amber-700 mx-auto" />
              <h4 className="font-serif text-base font-bold text-amber-900">
                {concert.status === "FINISHED"
                  ? "Cet événement est désormais terminé"
                  : "Cet événement affiche complet"}
              </h4>
              <p className="text-xs text-amber-800">
                Les réservations pour cette représentation sont closes.
              </p>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 md:p-8 space-y-6 shadow-sm"
            >
              <div className="border-b border-[#ECEAE6] pb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#111111]">
                    Réservation Officielle
                  </h2>
                  <p className="text-xs text-[#555555]">
                    Sélectionnez vos catégories de billets et votre mode de règlement
                  </p>
                </div>
                <Ticket className="h-6 w-6 text-[#641C2D]" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Votre Nom / Prénom">
                  <input
                    className={inputCls}
                    value={name}
                    placeholder="Ex: Jean Dupont"
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </Field>
                <Field label="Adresse E-mail de réception">
                  <input
                    type="email"
                    className={inputCls}
                    value={email}
                    placeholder="jean@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Catégorie de Billet">
                    <select
                      className={inputCls}
                      value={typeId}
                      onChange={(e) => {
                        setTypeId(Number(e.target.value));
                        setQty(1);
                      }}
                    >
                      {concert.ticket_types.map((t) => (
                        <option
                          key={t.id}
                          value={t.id}
                          disabled={t.remaining === 0}
                        >
                          {t.name} — {formatAr(t.price)} (
                          {t.remaining === 0 ? "épuisé" : `${t.remaining} dispo.`})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Quantité">
                  <input
                    type="number"
                    min={1}
                    max={maxQty}
                    className={inputCls}
                    value={qty}
                    onChange={(e) =>
                      setQty(
                        Math.min(maxQty, Math.max(1, Number(e.target.value) || 1))
                      )
                    }
                  />
                </Field>
              </div>

              {/* Total Card */}
              <div className="flex items-center justify-between rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-4">
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-[#888888] tracking-wider">
                    Montant total
                  </span>
                  <span className="text-xs text-[#555555]">
                    {qty} billet{qty > 1 ? "s" : ""} &bull; {type?.name}
                  </span>
                </div>
                <span className="font-serif text-2xl font-bold text-[#641C2D]">
                  {formatAr(total)}
                </span>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#555555]">
                  Option de règlement
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${
                      mode === "PAY_NOW"
                        ? "border-[#641C2D] bg-[#641C2D]/5"
                        : "border-[#ECEAE6] bg-[#FFFFFF] hover:border-[#641C2D]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "PAY_NOW"}
                      onChange={() => setMode("PAY_NOW")}
                      className="mt-0.5 accent-[#641C2D]"
                    />
                    <div className="text-left space-y-0.5">
                      <span className="block text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-[#641C2D]" />
                        Payer maintenant
                      </span>
                      <span className="block text-[11px] text-[#555555]">
                        Mobile Money & envoi du reçu
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${
                      mode === "RESERVE"
                        ? "border-[#641C2D] bg-[#641C2D]/5"
                        : "border-[#ECEAE6] bg-[#FFFFFF] hover:border-[#641C2D]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "RESERVE"}
                      onChange={() => setMode("RESERVE")}
                      className="mt-0.5 accent-[#641C2D]"
                    />
                    <div className="text-left space-y-0.5">
                      <span className="block text-xs font-bold text-[#111111] flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-[#641C2D]" />
                        Réserver sans payer
                      </span>
                      <span className="block text-[11px] text-[#555555]">
                        Règlement directement sur place à l'accueil
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Payment Proof Section */}
              {mode === "PAY_NOW" && (
                <div className="space-y-3 rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-4 text-xs">
                  {instructions && (
                    <div className="flex items-start gap-2 text-[#444444]">
                      <Info className="h-4 w-4 text-[#641C2D] shrink-0 mt-0.5" />
                      <p className="whitespace-pre-line leading-relaxed">
                        {instructions}
                      </p>
                    </div>
                  )}
                  <Field
                    label={`Preuve de transaction (JPG, PNG, WEBP — max ${MAX_MB} Mo)`}
                  >
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => onProof(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs text-[#555555] file:mr-3 file:rounded-lg file:border file:border-[#DCD9D3] file:bg-[#FFFFFF] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#111111] hover:file:bg-[#FAF9F6]"
                      />
                    </div>
                  </Field>
                  {proofPreview && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-[#ECEAE6] bg-[#FFFFFF] p-2">
                      <img
                        src={proofPreview}
                        alt="Aperçu du reçu"
                        className="max-h-40 w-auto object-contain mx-auto rounded"
                      />
                    </div>
                  )}
                </div>
              )}

              <ErrorBox message={error} />

              <Button
                type="submit"
                disabled={busy || !type}
                className="w-full justify-center py-3 text-sm font-semibold"
              >
                {busy ? "Enregistrement de la commande…" : "Confirmer la réservation"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {done && (
        <Modal title="Réservation Confirmée" onClose={() => setDone(null)}>
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-[#111111]">
                {done.quantity} billet{done.quantity > 1 ? "s" : ""} réservé
                {done.quantity > 1 ? "s" : ""} avec succès
              </h3>
              <p className="text-xs text-[#555555]">
                Votre réservation a été transmise à notre système de billetterie.
              </p>
            </div>

            <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-4 text-left">
              <span className="block text-[10px] uppercase font-semibold text-[#888888] tracking-wider">
                Référence de commande
              </span>
              <span className="font-mono text-base font-bold text-[#641C2D]">
                {done.reference}
              </span>
              <p className="text-[11px] text-[#555555] mt-1">
                E-mail destinataire : <strong className="text-[#111111]">{done.email}</strong>
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => {
                  setDone(null);
                  nav("/mes-billets");
                }}
              >
                <Ticket className="h-4 w-4 mr-1.5" />
                <span>Accéder à mes Billets & QR Codes</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setDone(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
