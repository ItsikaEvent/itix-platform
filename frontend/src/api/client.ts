import axios, { AxiosError } from "axios";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const TOKEN_KEY = "admin_token";
export const CLIENT_TOKEN_KEY = "itix_client_token";
export const CLIENT_USER_KEY = "client_user_session";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (config.url?.startsWith("/api/client")) {
    const clientToken = localStorage.getItem(CLIENT_TOKEN_KEY);
    if (clientToken) config.headers.Authorization = `Bearer ${clientToken}`;
  } else {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      if (err.config?.url?.startsWith("/api/client")) {
        localStorage.removeItem(CLIENT_TOKEN_KEY);
        localStorage.removeItem(CLIENT_USER_KEY);
      } else if (localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(err);
  },
);

export const fileUrl = (path: string | null) => (path ? `${API_URL}${path}` : null);

export function errorMessage(e: unknown, fallback = "Une erreur est survenue. Réessayez."): string {
  const detail = (e as AxiosError<{ detail?: unknown }>)?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return `Données invalides : ${detail[0].msg}`;
  if ((e as AxiosError)?.code === "ERR_NETWORK") return "Serveur injoignable.";
  return fallback;
}
