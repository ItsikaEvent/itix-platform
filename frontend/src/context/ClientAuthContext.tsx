import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface ClientUser {
  email: string;
  name: string;
}

interface ClientAuthContextType {
  clientUser: ClientUser | null;
  isClientAuth: boolean;
  loginClient: (name: string, email: string) => void;
  logoutClient: () => void;
}

const CLIENT_USER_KEY = "client_user_session";

const ClientAuthContext = createContext<ClientAuthContextType>(null!);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [clientUser, setClientUser] = useState<ClientUser | null>(() => {
    const raw = localStorage.getItem(CLIENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ClientUser;
    } catch {
      return null;
    }
  });

  const loginClient = (name: string, email: string) => {
    const user = { name: name.trim(), email: email.trim().toLowerCase() };
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
    setClientUser(user);
  };

  const logoutClient = () => {
    localStorage.removeItem(CLIENT_USER_KEY);
    setClientUser(null);
  };

  useEffect(() => {
    // Si l'utilisateur est stocké, synchroniser
    const raw = localStorage.getItem(CLIENT_USER_KEY);
    if (raw) {
      try {
        setClientUser(JSON.parse(raw));
      } catch {}
    }
  }, []);

  return (
    <ClientAuthContext.Provider
      value={{
        clientUser,
        isClientAuth: !!clientUser,
        loginClient,
        logoutClient,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export const useClientAuth = () => useContext(ClientAuthContext);
