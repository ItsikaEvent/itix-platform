import { useState, type FormEvent } from "react";
import { Ticket, ArrowRight, Info } from "../../components/icons";
import { useClientAuth } from "../../context/ClientAuthContext";
import { Button, inputCls } from "../../components/ui";

interface ClientLoginProps {
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export default function ClientLogin({
  onSuccess,
  title,
  subtitle,
}: ClientLoginProps) {
  const { loginClient } = useClientAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    loginClient(name, email);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="mx-auto max-w-md border border-[#D4C9BA] bg-[#FFFFFF] p-6 sm:p-8 shadow-sm">
      <div className="text-center mb-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center bg-[#111111] text-[#F7F3EA] border border-[#C6A15B] mb-3">
          <Ticket className="h-6 w-6 text-[#C6A15B]" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C6A15B] block mb-1">
          Accès Auditeur
        </span>
        <h2 className="font-serif text-xl font-bold text-[#111111]">
          {title || "Espace Client ITIX"}
        </h2>
        <p className="text-xs text-[#66625B] mt-1.5 leading-relaxed">
          {subtitle ||
            "Identifiez-vous pour consulter vos billets, QR Codes et échanger avec le support."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#66625B] uppercase tracking-wider mb-1.5">
            Votre Prénom / Nom
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="Ex: Jean Dupont"
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#66625B] uppercase tracking-wider mb-1.5">
            Votre adresse e-mail
          </label>
          <div className="relative">
            <input
              type="email"
              required
              placeholder="jean@example.com"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-[#8C877E] mt-1.5 flex items-center gap-1.5">
            <Info className="h-3 w-3 text-[#C6A15B] shrink-0" />
            <span>Indiquez l'e-mail utilisé lors de votre réservation.</span>
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center py-2.5 text-xs font-semibold mt-2"
        >
          <span>Accéder à mes réservations</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
