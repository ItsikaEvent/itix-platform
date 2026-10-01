import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  Music,
  Shield,
  QrCode,
  MessageSquare,
} from "../../components/icons";
import { api, errorMessage, fileUrl } from "../../api/client";
import { Badge, CONCERT_STATUS, ErrorBox, Spinner } from "../../components/ui";
import type { Concert } from "../../types";
import { formatAr, formatDate, formatTime } from "../../utils/format";

export default function Home() {
  const [concerts, setConcerts] = useState<Concert[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Concert[]>("/api/concerts")
      .then((r) => setConcerts(r.data))
      .catch((e) => setError(errorMessage(e, "Impossible de charger les concerts.")));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      {/* Index Hero Banner — Luminous White + Black & Bordeaux Accent */}
      <div className="rounded-2xl border border-[#ECEAE6] bg-[#FAF9F6] p-8 md:p-12 relative overflow-hidden">
        {/* Fine Bordeaux Accent Top Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#641C2D]" />

        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-8 space-y-5">
            <div className="inline-flex items-center gap-2 border border-[#641C2D]/30 bg-[#FFFFFF] px-3.5 py-1 text-xs font-semibold tracking-wider text-[#641C2D] uppercase rounded">
              <span>Saison Musicale & Événements d'Exception</span>
            </div>

            <h1 className="font-serif text-3xl md:text-5xl font-extrabold tracking-tight text-[#111111] leading-[1.18]">
              L'excellence des concerts & récitals de musique classique.
            </h1>

            <p className="font-sans text-sm md:text-base text-[#555555] leading-relaxed max-w-2xl">
              Réservez vos places officielles en toute sérénité. Billetterie sécurisée, accès instantané par e-billet avec QR code et service d'assistance dédié.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/billetterie"
                className="itix-btn-primary px-6 py-3 text-xs"
              >
                <Ticket className="h-4 w-4" />
                <span>Consulter la Billetterie</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>

              <Link
                to="/mes-billets"
                className="itix-btn-outline px-5 py-3 text-xs"
              >
                <QrCode className="h-4 w-4 text-[#641C2D]" />
                <span>Mes Billets & QR Codes</span>
              </Link>
            </div>
          </div>

          {/* Right Logo Presentation */}
          <div className="md:col-span-4 flex justify-center">
            <div className="border border-[#ECEAE6] bg-[#FFFFFF] p-6 rounded-2xl shadow-sm text-center max-w-[260px]">
              <img
                src="/logo.png"
                alt="I-Tix Official"
                className="h-32 w-auto mx-auto object-contain"
              />
              <div className="mt-3 pt-3 border-t border-[#F0EFEA]">
                <span className="font-mono text-[10px] font-bold text-[#641C2D] uppercase tracking-widest block">
                  Plateforme Officielle
                </span>
                <span className="text-[11px] text-[#888888] block mt-0.5">
                  E-Billetterie & Accès Live
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Pillars / Engagements — Clean White Cards with Bordeaux Details */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 space-y-3 shadow-sm hover:border-[#641C2D]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#ECEAE6]">
            <Shield className="h-5 w-5 text-[#641C2D]" />
          </div>
          <h3 className="font-serif text-base font-bold text-[#111111]">
            Billetterie Officielle
          </h3>
          <p className="text-xs text-[#555555] leading-relaxed">
            Réservation garantie directement auprès des organisateurs, paiements sécurisés et conditions claires.
          </p>
        </div>

        <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 space-y-3 shadow-sm hover:border-[#641C2D]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#ECEAE6]">
            <QrCode className="h-5 w-5 text-[#641C2D]" />
          </div>
          <h3 className="font-serif text-base font-bold text-[#111111]">
            E-Billet & QR Code Unique
          </h3>
          <p className="text-xs text-[#555555] leading-relaxed">
            Génération immédiate de vos titres d'accès sécurisés avec QR Code, consultables à tout moment sur votre smartphone.
          </p>
        </div>

        <div className="rounded-xl border border-[#ECEAE6] bg-[#FFFFFF] p-6 space-y-3 shadow-sm hover:border-[#641C2D]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FAF9F6] border border-[#ECEAE6]">
            <MessageSquare className="h-5 w-5 text-[#641C2D]" />
          </div>
          <h3 className="font-serif text-base font-bold text-[#111111]">
            Assistance Dédiée
          </h3>
          <p className="text-xs text-[#555555] leading-relaxed">
            Service de messagerie instantané intégré pour dialoguer directement avec la régie de l'événement.
          </p>
        </div>
      </div>

      {/* Featured Concerts Highlight */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#ECEAE6] pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
              À l'affiche
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#111111] mt-0.5">
              Sélection de la Programmation
            </h2>
          </div>
          <Link
            to="/billetterie"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#641C2D] hover:underline"
          >
            <span>Voir toute la billetterie</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ErrorBox message={error} />
        {!concerts && !error && <Spinner />}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {concerts?.slice(0, 3).map((c) => {
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

                {/* Card Details with ticket-inspired dashed line */}
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
    </div>
  );
}
