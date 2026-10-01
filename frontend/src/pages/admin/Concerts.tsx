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
import type { Concert } from "../../types";
import { formatAr, formatDateTime, toInputDate } from "../../utils/format";

interface TypeRow {
  id?: number;
  name: string;
  price: string;
  quantity: string;
}

function ConcertForm({
  concert,
  onClose,
  onSaved,
}: {
  concert: Concert | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(concert?.name ?? "");
  const [venue, setVenue] = useState(concert?.venue ?? "");
  const [description, setDescription] = useState(concert?.description ?? "");
  const [date, setDate] = useState(concert ? toInputDate(concert.date) : "");
  const [seats, setSeats] = useState(String(concert?.total_seats ?? ""));
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

        <div className="space-y-3 border border-[#E4DCD0] bg-[#FAF8F3] p-4">
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
                placeholder="Quota places"
                value={t.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
                required
              />
              <button
                type="button"
                disabled={types.length === 1}
                onClick={() => setTypes((r) => r.filter((_, j) => j !== i))}
                className="flex h-9 w-9 items-center justify-center border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-30 cursor-pointer"
                aria-label="Supprimer"
              >
                <X className="h-4 w-4" />
              </button>
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement en cours…" : "Valider l'événement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Concerts() {
  const [list, setList] = useState<Concert[] | null>(null);
  const [editing, setEditing] = useState<Concert | null | undefined>(undefined);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get<Concert[]>("/api/concerts")
      .then((r) => setList(r.data))
      .catch((e) => setError(errorMessage(e)));

  useEffect(() => {
    load();
  }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DCD0] pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B]">
            Catalogue d'événements
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Gestion des Concerts & Représentations
          </h1>
          <p className="text-xs text-[#66625B] mt-1">
            Création, mise à jour des programmes et répartition des quotas
          </p>
        </div>

        <Button
          onClick={() => setEditing(null)}
          variant="primary"
          className="text-xs self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>Créer un Événement</span>
        </Button>
      </div>

      <ErrorBox message={error} />
      {!list && <Spinner />}

      <div className="grid gap-4 md:grid-cols-2">
        {list?.map((c) => (
          <div
            key={c.id}
            className="flex gap-4 border border-[#E4DCD0] bg-[#FFFFFF] p-5 shadow-sm hover:border-[#C6A15B]"
          >
            <div className="h-32 w-24 shrink-0 overflow-hidden bg-[#111111] border border-[#E4DCD0]">
              {c.poster_url ? (
                <img
                  src={fileUrl(c.poster_url)!}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#66625B]">
                  <Music className="h-8 w-8 text-[#C6A15B]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="truncate font-serif font-bold text-[#111111] text-base">
                  {c.name}
                </h2>

                <div className="mt-1 space-y-1 text-xs text-[#66625B]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#641C2D]" />
                    <span>{formatDateTime(c.date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#C6A15B]" />
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
                      className="inline-block border border-[#E4DCD0] bg-[#FAF8F3] px-2 py-0.5 text-[10px] text-[#55524B]"
                    >
                      {t.name} {formatAr(t.price)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex gap-2 pt-2 border-t border-[#EFE9DC]">
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
        <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-12 text-center text-[#66625B]">
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
