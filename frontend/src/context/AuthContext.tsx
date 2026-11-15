import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, TOKEN_KEY } from "../api/client";
import type { AdminUser } from "../types";

const USER_KEY = "itix_admin_user";

interface AuthContextType {
  user: AdminUser | null;
  isAuth: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ must_change_password: boolean }>;
  logout: () => void;
  changePassword: (newPassword: string, oldPassword?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminUser;
    } catch {
      return null;
    }
  });

  const refreshUser = async () => {
    try {
      const { data } = await api.get<AdminUser>("/api/auth/me");
      setUser(data);
      localStorage.setItem(USER_KEY, JSON.stringify(data));
    } catch {
      logout();
    }
  };

  useEffect(() => {
    if (token && !user) {
      refreshUser();
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);

    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return { must_change_password: data.user.must_change_password };
    }
    await refreshUser();
    return { must_change_password: false };
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const changePassword = async (newPassword: string, oldPassword?: string) => {
    await api.post("/api/auth/change-password", {
      new_password: newPassword,
      old_password: oldPassword || undefined,
    });
    if (user) {
      const updated = { ...user, must_change_password: false };
      setUser(updated);
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!token,
        isSuperAdmin: user?.role === "SUPER_ADMIN",
        login,
        logout,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
