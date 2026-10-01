export const formatAr = (n: number) => `${n.toLocaleString("fr-FR")} Ar`;
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
// valeur pour <input type="datetime-local">
export const toInputDate = (iso: string) => iso.slice(0, 16);
