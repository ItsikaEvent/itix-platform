import { createContext, useContext, useState, type ReactNode } from "react";
import { api, TOKEN_KEY } from "../api/client";

interface Auth { isAuth: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void }
const Ctx = createContext<Auth>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const login = async (email: string, password: string) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
  };
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };
  return <Ctx.Provider value={{ isAuth: !!token, login, logout }}>{children}</Ctx.Provider>;
}
