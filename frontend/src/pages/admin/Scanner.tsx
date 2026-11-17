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
  Download,
  RefreshCw,
} from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import type { Concert, OfflineManifest, ScanResult } from "../../types";
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
  WRONG_ORGANIZER: [
    "border-rose-400 bg-rose-50 text-rose-950",
    "ACCÈS REFUSÉ (ÉVÉNEMENT D'UN AUTRE ORGANISATEUR)",
    XCircle,
  ],
};

export default function Scanner() {
  const { user } = useAuth();
  const scanner = useRef<Html5Qrcode | null>(null);
  const busy = useRef(false);
  const markUsedRef = useRef(true);
  const [running, setRunning] = useState(false);
  const [markUsed, setMarkUsed] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Concerts & Mode Hors-ligne
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [selectedConcertId, setSelectedConcertId] = useState<number | "">("");
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [offlineManifest, setOfflineManifest] = useState<OfflineManifest | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<{ token: string; scanned_at: string }[]>([]);
  const [downloadingManifest, setDownloadingManifest] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);

  useEffect(() => {
    markUsedRef.current = markUsed;
  }, [markUsed]);

  // Écouter les changements d'état du réseau
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Charger la liste des concerts disponibles
  useEffect(() => {
    api.get<Concert[]>("/api/admin/concerts")
      .then(({ data }) => {
        setConcerts(data);
        if (user?.assigned_concert_id) {
          setSelectedConcertId(user.assigned_concert_id);
        } else if (data.length > 0 && !selectedConcertId) {
          setSelectedConcertId(data[0].id);
        }
      })
      .catch(() => {});
  }, [user?.assigned_concert_id]);

  // Charger le manifest et la file d'attente hors-ligne locaux du concert sélectionné
  useEffect(() => {
    if (!selectedConcertId) return;
    const manifestKey = `itix_offline_manifest_${selectedConcertId}`;
    const queueKey = `itix_offline_queue_${selectedConcertId}`;

    const savedManifest = localStorage.getItem(manifestKey);
    if (savedManifest) {
      try {
        setOfflineManifest(JSON.parse(savedManifest));
      } catch {
        setOfflineManifest(null);
      }
    } else {
      setOfflineManifest(null);
    }

    const savedQueue = localStorage.getItem(queueKey);
    if (savedQueue) {
      try {
        setOfflineQueue(JSON.parse(savedQueue));
      } catch {
        setOfflineQueue([]);
      }
    } else {
      setOfflineQueue([]);
    }
  }, [selectedConcertId]);

  useEffect(() => {
    const s = new Html5Qrcode("qr-reader");
    scanner.current = s;
    return () => {
      if (s.isScanning) s.stop().then(() => s.clear()).catch(() => {});
    };
  }, []);

  // Télécharger le manifest pour l'utilisation hors-ligne
  const handleDownloadManifest = async () => {
    if (!selectedConcertId) return;
    setDownloadingManifest(true);
    setError("");
    setSyncMessage(null);
    try {
      const { data } = await api.get<OfflineManifest>(`/api/admin/scanner/manifest?concert_id=${selectedConcertId}`);
      setOfflineManifest(data);
      localStorage.setItem(`itix_offline_manifest_${selectedConcertId}`, JSON.stringify(data));
      setSyncMessage(`Manifest téléchargé : ${data.total_tickets} billets enregistrés pour le scan hors-ligne.`);
    } catch (e) {
      setError(errorMessage(e, "Échec du téléchargement du manifest hors-ligne."));
    } finally {
      setDownloadingManifest(false);
    }
  };

  // Synchroniser les scans hors-ligne vers le backend
  const handleSyncOfflineScans = async () => {
    if (!selectedConcertId || offlineQueue.length === 0) return;
    setSyncingOffline(true);
    setError("");
    setSyncMessage(null);
    try {
      const { data } = await api.post<{ message: string; synced: number; already_used: number }>(
        "/api/admin/scanner/sync-offline",
        {
          concert_id: selectedConcertId,
          scans: offlineQueue,
        }
      );

      // Vider la file d'attente
      localStorage.removeItem(`itix_offline_queue_${selectedConcertId}`);
      setOfflineQueue([]);
      setSyncMessage(data.message || `${data.synced} billet(s) synchronisé(s) avec succès !`);

      // Rafraîchir le manifest
      handleDownloadManifest();
    } catch (e) {
      setError(errorMessage(e, "Échec de la synchronisation des scans."));
    } finally {
      setSyncingOffline(false);
    }
  };

  const verifyOffline = (token: string): ScanResult => {
    if (!offlineManifest) {
      return {
        result: "INVALID",
        message: "Aucun manifest hors-ligne téléchargé. Veuillez vous connecter au réseau pour télécharger les billets de cet événement.",
        ticket: null,
      };
    }

    const t = offlineManifest.tickets.find((item) => item.token === token);
    if (!t) {
      return {
        result: "INVALID",
        message: "Ce QR Code ne correspond à aucun billet de ce concert.",
        ticket: null,
      };
    }

    const ticketInfo = {
      number: t.ticket_number,
      customer_name: t.customer_name,
      ticket_type: t.ticket_type,
      unit_price: t.unit_price,
      concert_name: offlineManifest.concert_name,
      concert_date: offlineManifest.concert_date,
      payment_status: t.payment_status,
      used_at: t.used_at,
    };

    if (t.status === "USED") {
      return {
        result: "ALREADY_USED",
        message: "Ce billet a déjà été validé et composté (vérification hors-ligne).",
        ticket: ticketInfo,
      };
    }

    if (t.payment_status !== "PAID") {
      return {
        result: "RESERVATION",
        message: `🎟️ Réservation valide — À encaisser sur place : ${t.unit_price.toLocaleString("fr-FR")} Ar`,
        ticket: ticketInfo,
      };
    }

    if (markUsedRef.current) {
      // Marquer localement comme utilisé
      const nowIso = new Date().toISOString();
      t.status = "USED";
      t.used_at = nowIso;
      ticketInfo.used_at = nowIso;

      // Enregistrer le manifest mis à jour
      localStorage.setItem(`itix_offline_manifest_${selectedConcertId}`, JSON.stringify(offlineManifest));

      // Ajouter à la file d'attente de synchronisation
      const newQueue = [...offlineQueue, { token, scanned_at: nowIso }];
      setOfflineQueue(newQueue);
      localStorage.setItem(`itix_offline_queue_${selectedConcertId}`, JSON.stringify(newQueue));
    }

    return {
      result: "VALID",
      message: "✓ Billet valide : entrée autorisée (Mode Hors-ligne).",
      ticket: ticketInfo,
    };
  };

  const verify = async (token: string) => {
    if (busy.current) return;
    busy.current = true;

    // Si on est en mode hors-ligne forcé ou réseau coupé
    if (isOfflineMode || !navigator.onLine) {
      const res = verifyOffline(token);
      setResult(res);
      return;
    }

    try {
      const { data } = await api.post<ScanResult>("/api/admin/scan", {
        token,
        mark_used: markUsedRef.current,
      });
      setResult(data);
    } catch (e) {
      // Fallback automatique sur le manifest hors-ligne si la requête réseau échoue
      if (offlineManifest) {
        const res = verifyOffline(token);
        setResult(res);
      } else {
        setError(errorMessage(e));
        busy.current = false;
      }
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
    <div className="mx-auto max-w-lg space-y-5">
      <div className="border-b border-[#ECEAE6] pb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#641C2D]">
            Poste de Contrôle d'Accès
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#111111] mt-0.5">
            Contrôle & Validation QR
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isOfflineMode ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"
          }`}>
            {isOfflineMode ? "HORS-LIGNE" : "EN LIGNE"}
          </span>
        </div>
      </div>

      {/* Sélecteur de concert & Téléchargement Hors-ligne */}
      <div className="bg-[#FAF9F6] border border-[#ECEAE6] p-4 rounded-xl space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#444444] mb-1">
            Événement en cours de contrôle :
          </label>
          <select
            className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
            value={selectedConcertId}
            disabled={Boolean(user?.assigned_concert_id)}
            onChange={(e) => setSelectedConcertId(Number(e.target.value))}
          >
            {concerts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({new Date(c.date).toLocaleDateString("fr-FR")})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#ECEAE6]">
          <div className="text-[11px] text-[#666666]">
            {offlineManifest ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{offlineManifest.total_tickets} billets en cache</span>
              </span>
            ) : (
              <span className="text-amber-700">Aucun cache hors-ligne</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadManifest}
            disabled={downloadingManifest || !selectedConcertId}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#641C2D] bg-white border border-[#641C2D]/30 rounded hover:bg-[#ECEAE6] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingManifest ? "Téléchargement…" : "Télécharger pour hors-ligne"}</span>
          </button>
        </div>

        {/* File d'attente hors-ligne & synchronisation */}
        {offlineQueue.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between">
            <span className="text-xs text-amber-900 font-semibold">
              {offlineQueue.length} scan(s) hors-ligne à envoyer
            </span>
            <Button
              variant="primary"
              onClick={handleSyncOfflineScans}
              disabled={syncingOffline}
              className="cursor-pointer text-xs py-1.5 px-3"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncingOffline ? "animate-spin" : ""}`} />
              <span>{syncingOffline ? "Envoi…" : "Synchroniser"}</span>
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-[#666666] pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isOfflineMode}
              onChange={(e) => setIsOfflineMode(e.target.checked)}
              className="accent-[#641C2D] h-3.5 w-3.5"
            />
            <span>Forcer le mode hors-ligne</span>
          </label>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Camera Viewer */}
      <div className="border border-[#D4C9BA] bg-[#111111] p-2 rounded-xl overflow-hidden">
        <div
          id="qr-reader"
          className="bg-black rounded-lg overflow-hidden"
          style={{ minHeight: running ? 280 : 0 }}
        />
        {!running && (
          <div className="bg-[#181818] p-10 text-center text-[#9E9B94] space-y-3 border border-[#2A2A2A] rounded-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center bg-[#111111] text-[#F7F3EA] border border-[#C6A15B] rounded-full">
              <ScanLine className="h-6 w-6 text-[#C6A15B]" />
            </div>
            <p className="font-serif text-sm font-semibold text-[#FFFFFF]">
              Caméra en attente d'activation
            </p>
            <p className="text-xs text-[#9E9B94] max-w-xs mx-auto">
              Lancez le flux vidéo pour scanner les QR Codes à l'entrée ou chargez une photo de billet.
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
            className="flex-1 justify-center py-2.5 text-xs font-semibold cursor-pointer"
          >
            <Camera className="h-4 w-4 mr-1.5" />
            <span>Activer la caméra</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={stop}
            className="flex-1 justify-center py-2.5 text-xs font-semibold cursor-pointer"
          >
            <span>Désactiver la caméra</span>
          </Button>
        )}

        <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 border border-[#D4C9BA] bg-[#FFFFFF] px-4 py-2.5 text-xs font-semibold text-[#111111] hover:bg-[#FAF8F3] text-center rounded-lg">
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

      <div className="border border-[#E4DCD0] bg-[#FFFFFF] p-3 rounded-lg">
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
          className={`space-y-3 border p-5 rounded-xl shadow-xs ${STYLE[result.result][0]}`}
        >
          <div className="flex items-center justify-between border-b border-black/10 pb-2">
            <p className="font-serif text-sm sm:text-base font-bold tracking-tight">
              {STYLE[result.result][1]}
            </p>
          </div>
          <p className="text-xs">{result.message}</p>

          {result.ticket && (
            <div className="border border-black/10 bg-white/80 rounded-lg p-3.5 text-xs space-y-1">
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
                  Validé le {formatDateTime(result.ticket.used_at)}
                </p>
              )}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full justify-center text-xs font-semibold py-2 mt-2 bg-white cursor-pointer"
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
