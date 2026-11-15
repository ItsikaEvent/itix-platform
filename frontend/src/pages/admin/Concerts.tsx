import { useEffect, useState, type FormEvent } from "react";
import {
  Music,
  Plus,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  X,
  Users,
} from "../../components/icons";
import { api, errorMessage, fileUrl } from "../../api/client";
import { Button, ErrorBox, Field, Modal, Spinner, inputCls } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { Concert, Organizer } from "../../types";
import { formatAr, formatDateTime, toInputDate } from "../../utils/format";

interface TypeRow {
  id?: number;
  name: string;
  price: string;
  quantity: string;
}

function ConcertForm({
  concert,
  organizers,
  isSuperAdmin,
  onClose,
  onSaved,
}: {
  concert: Concert | null;
  organizers: Organizer[];
  isSuperAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(concert?.name ?? "");
  const [venue, setVenue] = useState(concert?.venue ?? "");
  const [description, setDescription] = useState(concert?.description ?? "");
  const [date, setDate] = useState(concert ? toInputDate(concert.date) : "");
  const [seats, setSeats] = useState(String(concert?.total_seats ?? ""));
  const [organizerId, setOrganizerId] = useState<number | "">(concert?.organizer_id ?? "");
  const [poster, setPoster] = useState<File | null>(null);
  const [types, setTypes] = useState<TypeRow[]>(
    concert?.ticket_types.map((t) => ({
      id: t.id,
      name: t.name,
      price: String(t.price),
      quantity: String(t.quantity),
    })) ?? [{ name: "Standard", price: "", quantity: "" }]
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<TypeRow>) =>
    setTypes((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.append("name", name);
    fd.append("venue", venue);
    fd.append("description", description);
    fd.append("date", date);
    fd.append("total_seats", seats);
    if (isSuperAdmin && organizerId) {
      fd.append("organizer_id", String(organizerId));
    }
    fd.append(
      "ticket_types",
      JSON.stringify(
        types.map((t) => ({
          id: t.id ?? null,
          name: t.name,
          price: Number(t.price),
          quantity: Number(t.quantity),
        }))
      )
    );
    if (poster) fd.append("poster", poster);
    setBusy(true);
    try {
      if (concert) await api.put(`/api/admin/concerts/${concert.id}`, fd);
      else await api.post("/api/admin/concerts", fd);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const allocated = types.reduce((s, t) => s + (Number(t.quantity) || 0), 0);

  return (
    <Modal
      title={concert ? "Modifier la représentation" : "Nouveau Concert ITIX"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        {isSuperAdmin && (
          <Field label="Organisateur propriétaire (Super Admin)">
            <select
              className={inputCls}
              value={organizerId}
              onChange={(e) => setOrganizerId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">-- Assigner à vous-même (Super Admin) --</option>
              {organizers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.email})
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre du Concert / Récital">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Lieu / Salle de concert">
            <input
              className={inputCls}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
            />
          </Field>
          <Field label="Date et heure de début">
            <input
              type="datetime-local"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Jauge totale (nombre de places)">
            <input
              type="number"
              min={1}
              className={inputCls}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Présentation & Programme musical">
          <textarea
            rows={3}
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field
          label={`Visuel d'affiche (JPG, PNG, WEBP)${
            concert?.poster_url ? " — laisser vide pour conserver l'actuelle" : ""
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#66625B] file:mr-3 file:border file:border-[#D4C9BA] file:bg-[#FFFFFF] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#111111] hover:file:bg-[#FAF8F3]"
          />
        </Field>

        <div className="space-y-3 border border-[#E4DCD0] bg-[#FAF8F3] p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Catégories & Tarification
            </p>
            <span
              className={`text-[11px] font-semibold ${
                allocated === Number(seats) ? "text-[#2E6F40]" : "text-[#B47818]"
              }`}
            >
              {allocated}/{seats || 0} places réparties
            </span>
          </div>

          {types.map((t, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"
            >
              <input
                className={inputCls}
                placeholder="Catégorie (VIP, Carré Or…)"
                value={t.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                required
              />
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="Prix (Ar)"
                value={t.price}
                onChange={(e) => setRow(i, { price: e.target.value })}
                required
              />
              <input
                type="number"
                min={1}
                className={inputCls}
                placeholder="Quantité"
                value={t.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
                required
              />
              {types.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTypes((r) => r.filter((_, j) => j !== i))}
                  className="mb-1 p-2 text-[#888888] hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="text-xs"
            onClick={() => setTypes((r) => [...r, { name: "", price: "", quantity: "" }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            <span>Ajouter une catégorie</span>
          </Button>
        </div>

        <ErrorBox message={error} />

        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#666666] hover:text-[#111111]"
          >
            Annuler
          </button>
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : concert ? "Mettre à jour" : "Créer le concert"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Concerts() {
  const { isSuperAdmin } = useAuth();
  const [list, setList] = useState<Concert[] | null>(null);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<number | "">("");
  const [editing, setEditing] = useState<Concert | null | undefined>(undefined);
  const [error, setError] = useState("");

  const load = () => {
    const url = selectedOrgFilter
      ? `/api/admin/concerts?organizer_id=${selectedOrgFilter}`
      : "/api/admin/concerts";
    api
      .get<Concert[]>(url)
      .then((r) => setList(r.data))
      .catch((e) => setError(errorMessage(e)));
  };

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Organizer[]>("/api/admin/organizers").then((r) => setOrganizers(r.data)).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    load();
  }, [selectedOrgFilter]);

  const remove = async (c: Concert) => {
    if (!confirm(`Supprimer définitivement la fiche « ${c.name} » ?`)) return;
    setError("");
    try {
      await api.delete(`/api/admin/concerts/${c.id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECEAE6] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Catalogue d'événements
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Gestion des Concerts & Représentations
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Création, mise à jour des programmes et gestion des jauges
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && organizers.length > 0 && (
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
            >
              <option value="">Tous les organisateurs</option>
              {organizers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}

          <Button
            onClick={() => setEditing(null)}
            variant="primary"
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            <span>Créer un Événement</span>
          </Button>
        </div>
      </div>

      <ErrorBox message={error} />
      {!list && <Spinner />}

      <div className="grid gap-4 md:grid-cols-2">
        {list?.map((c) => (
          <div
            key={c.id}
            className="flex gap-4 border border-[#ECEAE6] bg-[#FFFFFF] p-5 rounded-2xl shadow-sm hover:border-[#641C2D] transition-colors"
          >
            <div className="h-32 w-24 shrink-0 overflow-hidden bg-[#111111] border border-[#ECEAE6] rounded-xl">
              {c.poster_url ? (
                <img
                  src={fileUrl(c.poster_url)!}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#66625B]">
                  <Music className="h-8 w-8 text-[#641C2D]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div>
                {c.organizer_name && (
                  <span className="inline-block text-[11px] font-semibold text-[#641C2D] mb-1">
                    {c.organizer_name}
                  </span>
                )}
                <h2 className="truncate font-serif font-bold text-[#111111] text-base">
                  {c.name}
                </h2>

                <div className="mt-1 space-y-1 text-xs text-[#66625B]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#641C2D]" />
                    <span>{formatDateTime(c.date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#641C2D]" />
                    <span className="truncate">{c.venue}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#111111]">
                    <Users className="h-3.5 w-3.5 text-[#66625B]" />
                    <span>
                      <strong>{c.total_seats}</strong> places &bull;{" "}
                      <span className="text-[#2E6F40] font-semibold">{c.remaining} dispo</span>
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {c.ticket_types.map((t) => (
                    <span
                      key={t.id}
                      className="inline-block border border-[#ECEAE6] bg-[#FAF8F3] px-2 py-0.5 text-[10px] text-[#55524B] rounded"
                    >
                      {t.name} {formatAr(t.price)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex gap-2 pt-2 border-t border-[#F2F0EC]">
                <Button
                  variant="outline"
                  className="text-xs py-1 px-3"
                  onClick={() => setEditing(c)}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  <span>Modifier</span>
                </Button>
                <Button
                  variant="danger"
                  className="text-xs py-1 px-3"
                  onClick={() => remove(c)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  <span>Supprimer</span>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {list?.length === 0 && (
        <div className="border border-[#ECEAE6] bg-[#FFFFFF] p-12 text-center text-[#66625B] rounded-2xl shadow-sm">
          <Music className="h-10 w-10 text-[#641C2D] mx-auto mb-2" />
          <p className="font-serif text-base font-semibold text-[#111111]">
            Aucun événement configuré
          </p>
          <p className="text-xs mt-1">
            Cliquez sur « Créer un Événement » pour programmer votre première représentation.
          </p>
        </div>
      )}

      {editing !== undefined && (
        <ConcertForm
          concert={editing}
          organizers={organizers}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
