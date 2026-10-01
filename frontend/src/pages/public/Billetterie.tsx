import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  Music,
} from "../../components/icons";
import { api, errorMessage, fileUrl } from "../../api/client";
import { Badge, CONCERT_STATUS, ErrorBox, Spinner } from "../../components/ui";
import type { Concert } from "../../types";
import { formatAr, formatDate, formatTime } from "../../utils/format";

export default function Billetterie() {
  const [concerts, setConcerts] = useState<Concert[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Concert[]>("/api/concerts")
      .then((r) => setConcerts(r.data))
      .catch((e) => setError(errorMessage(e, "Impossible de charger les concerts.")));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Page Header — Clean & Crisp on Pure White */}
      <div className="border-b border-[#ECEAE6] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Programmation Officielle
          </span>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
            Billetterie & Événements
          </h1>
          <p className="text-xs text-[#555555] mt-1">
            Sélectionnez votre concert et choisissez votre catégorie de place
          </p>
        </div>
        {concerts && (
          <span className="text-xs font-medium text-[#666666]">
            {concerts.length} événement{concerts.length > 1 ? "s" : ""} disponible{concerts.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <ErrorBox message={error} />
      {!concerts && !error && <Spinner />}

      {concerts?.length === 0 && (
        <div className="rounded-xl border border-[#ECEAE6] bg-[#FAF9F6] p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFFFFF] border border-[#ECEAE6] text-[#666666] mb-3">
            <Music className="h-6 w-6 text-[#641C2D]" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-[#111111]">
            Aucune date ouverte aux réservations actuellement
          </h3>
          <p className="text-xs text-[#666666] mt-1">
            Les prochaines représentations seront publiées sous peu.
          </p>
        </div>
      )}

      {/* Concerts Grid with Ticket Motifs */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {concerts?.map((c) => {
          const [label, tone] = CONCERT_STATUS[c.status];
          const closed = c.status === "FINISHED" || c.status === "SOLD_OUT";

          return (
            <Link
              key={c.id}
              to={`/concerts/${c.id}`}
              className={`group flex flex-col rounded-xl bg-[#FFFFFF] border border-[#ECEAE6] overflow-hidden shadow-sm hover:border-[#641C2D] ${
                c.status === "FINISHED" ? "opacity-60" : ""
              }`}
            >
              {/* Poster image container */}
              <div className="aspect-[16/10] w-full overflow-hidden bg-[#111111] relative">
                {c.poster_url ? (
                  <img
                    src={fileUrl(c.poster_url)!}
                    alt={`Affiche ${c.name}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#666666]">
                    <Music className="h-10 w-10 text-[#641C2D]" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge tone={tone}>{label}</Badge>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#111111] group-hover:text-[#641C2D] line-clamp-2 leading-snug">
                    {c.name}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-[#555555]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-[#641C2D] shrink-0" />
                      <span>
                        {formatDate(c.date)} &bull; {formatTime(c.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-[#641C2D] shrink-0" />
                      <span className="truncate">{c.venue}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-[#ECEAE6] pt-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-[#888888] tracking-wider">
                        Tarif à partir de
                      </span>
                      <span className="font-serif text-base font-bold text-[#111111]">
                        {c.min_price !== null ? formatAr(c.min_price) : "Gratuit"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] uppercase font-semibold text-[#888888] tracking-wider">
                        Disponibilité
                      </span>
                      <span className="text-xs font-medium text-[#555555]">
                        {c.remaining} place{c.remaining > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold tracking-wide border ${
                      closed
                        ? "bg-[#FAF9F6] text-[#888888] border-[#ECEAE6]"
                        : "bg-[#641C2D] text-[#FFFFFF] border-[#641C2D] group-hover:bg-[#4E1422]"
                    }`}
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    <span>{closed ? "Consulter le programme" : "Réserver des places"}</span>
                    {!closed && <ArrowRight className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
