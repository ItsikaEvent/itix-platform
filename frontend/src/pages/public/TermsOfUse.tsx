import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "../../components/icons";
import { usePageSeo } from "../../utils/seo";

export default function TermsOfUse() {
  usePageSeo({
    title: "Conditions Générales d'Utilisation",
    description: "Conditions Générales d'Utilisation (CGU) régissant l'accès et l'utilisation de la plateforme ITIX.",
    url: "https://itix.mg/conditions-generales-d-utilisation",
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
          <FileText className="h-3.5 w-3.5" />
          <span>Règles d'Utilisation du Service</span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#111111]">
          Conditions Générales d'Utilisation (CGU)
        </h1>
        <p className="text-sm text-[#555555] mt-2">
          Règles régissant la navigation et l'utilisation de la plateforme logicielle ITIX.
        </p>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none text-[#333333] space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">1. Présentation du Service</h2>
          <p className="text-sm leading-relaxed">
            Le site <strong>ITIX</strong> est une plateforme logicielle développée par I-Tsika Events fournissant aux utilisateurs des outils de découverte culturelle, de réservation et d'accès aux concerts et événements artistiques.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">2. Accès au Site & Disponibilité</h2>
          <p className="text-sm leading-relaxed">
            Le service est accessible 24h/24 et 7j/7, sous réserve des éventuelles interruptions de maintenance technique ou des cas de force majeure inhérents au réseau Internet.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">3. Obligations de l'Utilisateur</h2>
          <p className="text-sm leading-relaxed">
            Tout utilisateur s'engage à utiliser le site dans le respect des lois en vigueur et s'interdit notamment :
          </p>
          <ul className="list-disc pl-5 text-sm space-y-2 text-[#444444]">
            <li>De falsifier, contourner ou tenter de déchiffrer les jetons cryptographiques contenus dans les QR Codes de billetterie.</li>
            <li>De fournir de fausses preuves de virement Mobile Money lors de la validation d'une commande.</li>
            <li>D'effectuer des requêtes automatisées abusives (scraping, attaques par déni de service).</li>
            <li>D'usurper l'identité d'un tiers ou d'un gestionnaire d'événement.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">4. Espace d'Administration & Gestionnaires</h2>
          <p className="text-sm leading-relaxed">
            L'accès à l'espace d'administration (« Accès Gestionnaire ») est strictement réservé aux organisateurs accrédités par ITIX. Les identifiants sont strictement personnels et confidentiels. Tout organisateur accédant pour la première fois avec un mot de passe temporaire a l'obligation de le renouveler immédiatement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">5. Propriété Intellectuelle</h2>
          <p className="text-sm leading-relaxed">
            Les marques, logos, chartes graphiques, codes sources et algorithmes de la plateforme ITIX demeurent la propriété exclusive de leurs auteurs. Les affiches et contenus des concerts restent la propriété des artistes et organisateurs respectifs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">6. Contact & Réclamations</h2>
          <p className="text-sm leading-relaxed">
            Pour toute question ou réclamation relative au fonctionnement de la plateforme, vous pouvez contacter l'équipe via le formulaire disponible dans la rubrique « Assistance & Messages ».
          </p>
        </section>
      </div>
    </div>
  );
}
