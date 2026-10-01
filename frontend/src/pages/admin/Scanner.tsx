import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ScanLine,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox } from "../../components/ui";
import type { ScanResult } from "../../types";
import { formatDate, formatDateTime, formatTime } from "../../utils/format";

const STYLE: Record<ScanResult["result"], [string, string, typeof CheckCircle2]> = {
  VALID: [
    "border-emerald-300 bg-emerald-50 text-emerald-950",
    "BILLET VALIDE (PAIEMENT CONFIRMÉ)",
    CheckCircle2,
  ],
  RESERVATION: [
    "border-amber-300 bg-amber-50 text-amber-950",
    "RÉSERVATION (RÈGLEMENT SUR PLACE)",
    AlertTriangle,
  ],
  ALREADY_USED: [
    "border-red-300 bg-red-50 text-red-950",
    "BILLET DÉJÀ UTILISÉ / COMPTABILISÉ",
    XCircle,
  ],
  NOT_PAID: [
    "border-amber-300 bg-amber-50 text-amber-950",
    "PAIEMENT EN ATTENTE DE CONFIRMATION",
    AlertTriangle,
  ],
  INVALID: [
    "border-red-300 bg-red-50 text-red-950",
    "TITRE D'ACCÈS INVALIDE OU INTROUVABLE",
    XCircle,
  ],
};

export default function Scanner() {
  const scanner = useRef<Html5Qrcode | null>(null);
  const busy = useRef(false);
  const markUsedRef = useRef(true);
  const [running, setRunning] = useState(false);
  const [markUsed, setMarkUsed] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    markUsedRef.current = markUsed;
  }, [markUsed]);

  useEffect(() => {
    const s = new Html5Qrcode("qr-reader");
    scanner.current = s;
    return () => {
      if (s.isScanning) s.stop().then(() => s.clear()).catch(() => {});
    };
  }, []);

  const verify = async (token: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { data } = await api.post<ScanResult>("/api/admin/scan", {
        token,
        mark_used: markUsedRef.current,
      });
      setResult(data);
    } catch (e) {
      setError(errorMessage(e));
      busy.current = false;
    }
  };

  const start = async () => {
    setError("");
    try {
      await scanner.current!.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        verify,
        () => {}
      );
      setRunning(true);
    } catch {
      setError(
        "Impossible d'activer la caméra. Vérifiez les autorisations de votre navigateur ou importez un fichier image."
      );
    }
  };

  const stop = async () => {
    await scanner.current?.stop().catch(() => {});
    setRunning(false);
  };

  const fromPhoto = async (file: File | null) => {
    if (!file) return;
    setError("");
    try {
      if (scanner.current?.isScanning) await stop();
      const text = await scanner.current!.scanFile(file, false);
      busy.current = false;
      await verify(text);
    } catch {
      setError("Aucun QR Code exploitable détecté sur cette image.");
    }
  };

  const next = () => {
    setResult(null);
    busy.current = false;
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="border-b border-[#E4DCD0] pb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B]">
          Poste de Contrôle
        </span>
        <h1 className="font-serif text-2xl font-bold text-[#111111] mt-0.5">
          Scanner & Validation des Billets
        </h1>
        <p className="text-xs text-[#66625B] mt-1">
          Contrôle d'accès officiel des spectateurs en entrée de salle
        </p>
      </div>

      {/* Camera Viewer with HUD frame */}
      <div className="border border-[#D4C9BA] bg-[#111111] p-2">
        <div
          id="qr-reader"
          className="bg-black"
          style={{ minHeight: running ? 280 : 0 }}
        />
        {!running && (
          <div className="bg-[#181818] p-10 text-center text-[#9E9B94] space-y-3 border border-[#2A2A2A]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center bg-[#111111] text-[#F7F3EA] border border-[#C6A15B]">
              <ScanLine className="h-6 w-6 text-[#C6A15B]" />
            </div>
            <p className="font-serif text-sm font-semibold text-[#FFFFFF]">
              Capteur optique en attente
            </p>
            <p className="text-xs text-[#9E9B94] max-w-xs mx-auto">
              Lancez le flux vidéo pour scanner les QR Codes à l'accueil ou chargez une photo de billet.
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {!running ? (
          <Button
            onClick={start}
            variant="primary"
            className="flex-1 justify-center py-2.5 text-xs font-semibold"
          >
            <Camera className="h-4 w-4 mr-1.5" />
            <span>Activer la caméra</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={stop}
            className="flex-1 justify-center py-2.5 text-xs font-semibold"
          >
            <span>Désactiver la caméra</span>
          </Button>
        )}

        <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 border border-[#D4C9BA] bg-[#FFFFFF] px-4 py-2.5 text-xs font-semibold text-[#111111] hover:bg-[#FAF8F3] text-center">
          <Upload className="h-4 w-4 text-[#641C2D]" />
          <span>Charger une photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              fromPhoto(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-3.5">
        <label className="flex items-center gap-2.5 text-xs text-[#303030] cursor-pointer">
          <input
            type="checkbox"
            checked={markUsed}
            onChange={(e) => setMarkUsed(e.target.checked)}
            className="accent-[#641C2D] h-4 w-4"
          />
          <span>
            Comptabiliser et invalider le billet immédiatement après validation
          </span>
        </label>
      </div>

      <ErrorBox message={error} />

      {result && (
        <div
          className={`space-y-3 border p-6 shadow-sm ${STYLE[result.result][0]}`}
        >
          <div className="flex items-center justify-between border-b border-black/10 pb-2">
            <p className="font-serif text-base font-bold tracking-tight">
              {STYLE[result.result][1]}
            </p>
          </div>
          <p className="text-xs">{result.message}</p>

          {result.ticket && (
            <div className="border border-black/10 bg-white/70 p-4 text-xs space-y-1.5">
              <p className="font-serif text-sm font-bold text-[#111111]">
                {result.ticket.customer_name}
              </p>
              <p className="font-mono font-semibold text-[#641C2D]">
                {result.ticket.ticket_type} &bull; {result.ticket.number}
              </p>
              <p className="text-[#303030]">
                {result.ticket.concert_name} — {formatDate(result.ticket.concert_date)}{" "}
                {formatTime(result.ticket.concert_date)}
              </p>
              <p className="text-[#55524B]">
                Statut paiement :{" "}
                <strong>
                  {result.ticket.payment_status === "PAID" ? "RÉGLÉ" : "NON RÉGLÉ"}
                </strong>
              </p>
              {result.ticket.used_at && (
                <p className="text-red-700 font-semibold">
                  Déjà utilisé le {formatDateTime(result.ticket.used_at)}
                </p>
              )}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full justify-center text-xs font-semibold py-2 mt-2 bg-white"
            onClick={next}
          >
            <span>Contrôler le billet suivant</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
