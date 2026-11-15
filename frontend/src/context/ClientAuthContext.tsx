import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CLIENT_TOKEN_KEY, CLIENT_USER_KEY } from "../api/client";

export interface ClientUser {
  email: string;
  name: string;
}

interface ClientAuthContextType {
  clientUser: ClientUser | null;
  clientToken: string | null;
  isClientAuth: boolean;
  loginClient: (token: string, user: ClientUser) => void;
  logoutClient: () => void;
}

const ClientAuthContext = createContext<ClientAuthContextType>(null!);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [clientToken, setClientToken] = useState<string | null>(() => {
    return localStorage.getItem(CLIENT_TOKEN_KEY);
  });

  const [clientUser, setClientUser] = useState<ClientUser | null>(() => {
    const raw = localStorage.getItem(CLIENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ClientUser;
    } catch {
      return null;
    }
  });

  const loginClient = (token: string, user: ClientUser) => {
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
    setClientToken(token);
    setClientUser(user);
  };

  const logoutClient = () => {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem(CLIENT_USER_KEY);
    setClientToken(null);
    setClientUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem(CLIENT_TOKEN_KEY);
    const raw = localStorage.getItem(CLIENT_USER_KEY);
    if (token && raw) {
      try {
        setClientToken(token);
        setClientUser(JSON.parse(raw));
      } catch {}
    }
  }, []);

  return (
    <ClientAuthContext.Provider
      value={{
        clientUser,
        clientToken,
        isClientAuth: !!(clientToken && clientUser),
        loginClient,
        logoutClient,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export const useClientAuth = () => useContext(ClientAuthContext);
