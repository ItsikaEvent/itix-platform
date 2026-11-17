import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "../../components/icons";
import { usePageSeo } from "../../utils/seo";

export default function TermsOfSale() {
  usePageSeo({
    title: "Conditions Générales de Vente",
    description: "Conditions Générales de Vente (CGV) régissant la réservation et l'achat de billets sur la plateforme ITIX.",
    url: "https://itix.mg/conditions-generales-de-vente",
  });
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Back button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#666666] hover:text-[#641C2D] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour à l'accueil</span>
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-[#ECEAE6] pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#ECEAE6] text-xs font-semibold text-[#641C2D] mb-3">
          <Scale className="h-3.5 w-3.5" />
          <span>Cadre Contractuel de Vente</span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#111111]">
          Conditions Générales de Vente (CGV)
        </h1>
        <p className="text-sm text-[#555555] mt-2">
          Applicables à toute commande de billets effectuée sur la plateforme ITIX (I-Tsika Events).
        </p>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none text-[#333333] space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">1. Objet & Rôle de la Plateforme</h2>
          <p className="text-sm leading-relaxed">
            La plateforme <strong>ITIX</strong> est une solution technique d'intermédiation de billetterie électronique permettant aux organisateurs d'événements de publier leurs représentations et aux spectateurs d'acheter ou de réserver des titres d'accès sécurisés.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">2. Tarifs & Devises</h2>
          <p className="text-sm leading-relaxed">
            Tous les tarifs des billets sont exprimés en <strong>Ariary malgache (MGA)</strong>, toutes taxes et droits compris. L'organisateur se réserve le droit de modifier les tarifs de ses représentations à tout moment, mais les billets sont facturés sur la base des tarifs en vigueur au moment de l'enregistrement de la commande.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">3. Processus de Commande & Quotas</h2>
          <p className="text-sm leading-relaxed">
            Afin de prévenir toute tentative de spéculation ou revente illicite (« scalping »), les commandes sont limitées à un maximum de <strong>10 billets par transaction</strong>.
          </p>
          <p className="text-sm leading-relaxed">
            Deux modes d'obtention sont proposés :
          </p>
          <ul className="list-disc pl-5 text-sm space-y-2 text-[#444444]">
            <li>
              <strong>Paiement immédiat (Mobile Money) :</strong> L'acheteur effectue son transfert via MVola, Orange Money ou Airtel Money vers les coordonnées indiquées, puis transmet impérativement la capture d'écran de confirmation lors de la validation.
            </li>
            <li>
              <strong>Réservation (Paiement sur place) :</strong> L'acheteur réserve ses places et effectue le règlement physique aux guichets le jour du concert.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">4. Validation, Émission & E-Billets</h2>
          <p className="text-sm leading-relaxed">
            Après vérification par l'organisateur, toute commande acceptée donne lieu à l'émission de billets dématérialisés dotés d'un <strong>QR Code cryptographique unique et inviolable</strong>. Les billets sont téléchargeables immédiatement sur l'espace « Mes Billets » et expédiés à l'adresse e-mail renseignée.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">5. Contrôle d'Accès & Sécurité</h2>
          <p className="text-sm leading-relaxed">
            Chaque billet ne permet qu'une seule et unique entrée. Le premier billet scanné avec succès et enregistré par le serveur invalide automatiquement toute tentative de présentation ultérieure. L'acheteur est seul responsable de la garde de son QR Code. La duplication ou reproduction non autorisée est strictement interdite.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">6. Annulation, Report & Remboursements</h2>
          <p className="text-sm leading-relaxed">
            Conformément aux usages du spectacle vivant :
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1 text-[#444444]">
            <li>En cas d'<strong>annulation définitive</strong> d'un concert du fait de l'organisateur, le remboursement des sommes versées est pris en charge selon les modalités annoncées par ce dernier.</li>
            <li>En cas de <strong>report</strong> de la date, les billets restent automatiquement valables pour la nouvelle séance.</li>
            <li>Du fait de l'acheteur, les billets confirmés ne sont ni repris, ni échangés, ni remboursés.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">7. Droit Applicable & Juridiction</h2>
          <p className="text-sm leading-relaxed">
            Les présentes CGV sont soumises à la législation en vigueur en République de Madagascar. Tout différend relatif à leur validité, interprétation ou exécution sera soumis aux tribunaux compétents d'Antananarivo.
          </p>
        </section>
      </div>
    </div>
  );
}
