import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Calendar,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Music,
  Phone,
  Shield,
} from "../../components/icons";
import { api, errorMessage, fileUrl } from "../../api/client";
import { Badge, CONCERT_STATUS, ErrorBox, Spinner } from "../../components/ui";
import type { Concert } from "../../types";
import { formatAr, formatDate, formatTime } from "../../utils/format";
import { usePageSeo } from "../../utils/seo";

interface PublicOrganizerData {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  concerts: Concert[];
}

export default function OrganizerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicOrganizerData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  usePageSeo({
    title: data ? `${data.name} — Événements & Spectacles` : "Organisateur",
    description: data
      ? `Retrouvez tous les concerts et spectacles officiels organisés par ${data.name} sur la plateforme ITIX.`
      : "Espace officiel de l'organisateur sur ITIX.",
    url: slug ? `https://itix.mg/organisateurs/${slug}` : undefined,
  });

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .get<PublicOrganizerData>(`/api/organizers/${slug}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e, "Impossible de charger cet organisateur.")))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner />;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link to="/billetterie" className="inline-flex items-center gap-2 text-xs font-semibold text-[#666666] hover:text-[#641C2D]">
          <ArrowLeft className="h-4 w-4" />
          <span>Retour à la billetterie</span>
        </Link>
        <ErrorBox message={error} />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Breadcrumb Navigation */}
      <div>
        <Link
          to="/billetterie"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#666666] hover:text-[#641C2D] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Toutes les programmations</span>
        </Link>
      </div>

      {/* Organizer Profile Banner */}
      <div className="rounded-2xl border border-[#ECEAE6] bg-[#FAF9F6] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[#641C2D] text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md shrink-0">
            {data.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
                Organisateur Partenaire
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Shield className="h-3 w-3" />
                <span>Certifié ITIX</span>
              </span>
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] mt-0.5">
              {data.name}
            </h1>
            {data.phone && (
              <p className="inline-flex items-center gap-1.5 text-xs text-[#666666] mt-1">
                <Phone className="h-3.5 w-3.5 text-[#641C2D]" />
                <span>Contact direct : {data.phone}</span>
              </p>
            )}
          </div>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-[#ECEAE6] pt-4 md:pt-0 md:pl-6 text-left md:text-right shrink-0">
          <span className="text-xs text-[#777777] block">Événements publiés</span>
          <span className="font-serif text-2xl font-bold text-[#111111]">
            {data.concerts.length} événement{data.concerts.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Concerts Grid */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-[#111111]">
          Représentations & Billetterie officielle
        </h2>

        {data.concerts.length === 0 ? (
          <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-12 text-center shadow-sm">
            <Music className="mx-auto h-8 w-8 text-[#999999] mb-2" />
            <p className="text-sm font-semibold text-[#111111]">
              Aucun événement en cours pour cet organisateur.
            </p>
            <p className="text-xs text-[#666666] mt-1">
              Revenez prochainement pour découvrir ses futures programmations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.concerts.map((c) => {
              const [statusLabel, statusTone] = CONCERT_STATUS[c.status];
              return (
                <div
                  key={c.id}
                  className="group flex flex-col justify-between rounded-2xl border border-[#ECEAE6] bg-[#FFFFFF] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Poster */}
                    <div className="relative aspect-[16/10] bg-[#111111] overflow-hidden">
                      {c.poster_url ? (
                        <img
                          src={fileUrl(c.poster_url)!}
                          alt={c.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#555555]">
                          <Music className="h-10 w-10 text-[#641C2D]" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <Badge tone={statusTone}>{statusLabel}</Badge>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5 space-y-3">
                      <h3 className="font-serif text-lg font-bold text-[#111111] line-clamp-1 group-hover:text-[#641C2D] transition-colors">
                        {c.name}
                      </h3>
                      <div className="space-y-1.5 text-xs text-[#555555]">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[#641C2D] shrink-0" />
                          <span>{formatDate(c.date)} à {formatTime(c.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[#641C2D] shrink-0" />
                          <span className="truncate">{c.venue}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Card */}
                  <div className="p-5 pt-0 border-t border-[#F2F0EC] mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[#777777] block">À partir de</span>
                      <span className="font-bold text-sm text-[#111111]">
                        {c.min_price != null ? formatAr(c.min_price) : "Gratuit"}
                      </span>
                    </div>
                    <Link
                      to={`/concerts/${c.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FAF9F6] border border-[#DCD9D3] text-[#111111] hover:bg-[#641C2D] hover:text-white hover:border-[#641C2D] rounded-lg transition-colors shadow-sm"
                    >
                      <span>Réserver</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
