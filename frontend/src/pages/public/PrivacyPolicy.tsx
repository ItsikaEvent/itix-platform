import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, CheckCircle2, ArrowLeft, Send } from "../../components/icons";
import { api, errorMessage } from "../../api/client";
import { Button, ErrorBox } from "../../components/ui";
import { usePageSeo } from "../../utils/seo";

export default function PrivacyPolicy() {
  usePageSeo({
    title: "Politique de Confidentialité",
    description: "Protection des données personnelles conformément à la Loi n° 2014-038 (CMIL Madagascar) et au RGPD européen sur la plateforme ITIX.",
    url: "https://itix.mg/politique-de-confidentialite",
  });

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    request_type: "ACCESS" as "ACCESS" | "RECTIFICATION" | "DELETION" | "OPPOSITION",
    details: "",
  });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await api.post("/api/privacy/request", form);
      setSuccessMsg(res.data.message || "Votre demande a bien été enregistrée.");
      setForm({ customer_name: "", customer_email: "", request_type: "ACCESS", details: "" });
    } catch (err) {
      setErrorMsg(errorMessage(err, "Erreur lors de l'envoi de votre demande."));
    } finally {
      setLoading(false);
    }
  };

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
          <Shield className="h-3.5 w-3.5" />
          <span>Conformité RGPD & Loi n° 2014-038 (CMIL Madagascar)</span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#111111]">
          Politique de Confidentialité & Protection des Données
        </h1>
        <p className="text-sm text-[#555555] mt-2">
          Dernière mise à jour : 15 novembre 2026. La plateforme ITIX (I-Tsika Events) s'engage à protéger l'intégrité et la confidentialité de vos informations personnelles.
        </p>
      </div>

      {/* Main Content */}
      <div className="prose prose-sm max-w-none text-[#333333] space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">1. Cadre Juridique Applicable</h2>
          <p className="text-sm leading-relaxed">
            La présente politique est régie par la <strong>Loi n° 2014-038 du 9 janvier 2015</strong> sur la protection des données à caractère personnel à Madagascar, supervisée par la <strong>Commission Malgache de l'Informatique et des Libertés (CMIL)</strong>, ainsi que par les normes internationales équivalentes de protection des données (notamment le <strong>Règlement Général sur la Protection des Données - RGPD UE 2016/679</strong>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">2. Données Personnelles Collectées</h2>
          <p className="text-sm leading-relaxed">
            Dans le cadre strict de l'émission, de la réservation et du contrôle d'accès des billets, nous collectons les données suivantes :
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1 text-[#444444]">
            <li><strong>Identité :</strong> Nom et prénom du porteur ou de l'acheteur.</li>
            <li><strong>Contact :</strong> Adresse e-mail (utilisée pour l'envoi des billets, des QR codes et les communications d'urgence relatives au spectacle).</li>
            <li><strong>Preuve de transaction financière :</strong> Capture d'écran ou référence du transfert mobile (MVola, Orange Money, Airtel Money) transmise en cas d'achat immédiat.</li>
            <li><strong>Données techniques de contrôle :</strong> Horodatage et statut d'utilisation du billet lors du scan aux entrées.</li>
          </ul>
          <p className="text-xs text-[#777777] bg-[#FAF9F6] p-3 rounded-lg border border-[#ECEAE6]">
            ℹ️ <em>Important : ITIX ne conserve aucune coordonnée bancaire sensible (code PIN, code secret Mobile Money). Les transactions sont effectuées directement entre vous et les opérateurs télécoms agréés.</em>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">3. Finalités & Bases Légales</h2>
          <p className="text-sm leading-relaxed">Vos données sont traitées pour :</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[#ECEAE6] bg-[#FFFFFF]">
              <h3 className="font-semibold text-sm text-[#111111]">Exécution contractuelle</h3>
              <p className="text-xs text-[#666666] mt-1">Génération des titres d'accès uniques, vérification de paiement, livraison par e-mail et validation physique à la porte.</p>
            </div>
            <div className="p-4 rounded-xl border border-[#ECEAE6] bg-[#FFFFFF]">
              <h3 className="font-semibold text-sm text-[#111111]">Sécurité & Prévention des fraudes</h3>
              <p className="text-xs text-[#666666] mt-1">Garantie anti-duplication des billets grâce aux jetons QR chiffrés et vérification atomique lors du contrôle d'accès.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">4. Cloisonnement Multi-Organisateurs</h2>
          <p className="text-sm leading-relaxed">
            Chaque organisateur d'événement disposant d'un compte sur la plateforme ITIX n'a strictement accès <strong>qu'aux données des acheteurs ayant commandé des billets pour ses propres spectacles</strong>. Aucun organisateur ne peut consulter, exporter ou manipuler les commandes d'un autre organisateur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">5. Sécurité & Chiffrement</h2>
          <p className="text-sm leading-relaxed">
            Nous appliquons les meilleures pratiques de sécurité de l'industrie :
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1 text-[#444444]">
            <li>Chiffrement cryptographique symétrique <strong>Fernet (AES-128-CBC + HMAC-SHA256)</strong> pour tous les QR codes émis : le QR ne contient aucune donnée personnelle en clair.</li>
            <li>Hachage irréversible des mots de passe administrateurs via <strong>Argon2id</strong>.</li>
            <li>Stockage sécurisé des preuves de paiement avec contrôle d'accès strict.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">6. Durée de Conservation</h2>
          <p className="text-sm leading-relaxed">
            Les données de réservation et preuves de paiement sont conservées pendant la durée nécessaire à l'organisation de l'événement et aux obligations comptables et fiscales légales, après quoi elles sont supprimées ou anonymisées.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#111111] font-serif">7. Vos Droits (RGPD & CMIL)</h2>
          <p className="text-sm leading-relaxed">
            Conformément aux lois applicables, vous bénéficiez à tout moment :
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1 text-[#444444]">
            <li>Du <strong>droit d'accès</strong> à vos données personnelles.</li>
            <li>Du <strong>droit de rectification</strong> en cas d'erreur sur votre nom ou e-mail.</li>
            <li>Du <strong>droit à l'effacement</strong> (« droit à l'oubli ») sous réserve des obligations de justificatif d'entrée.</li>
            <li>Du <strong>droit d'opposition</strong> au traitement.</li>
          </ul>
        </section>
      </div>

      {/* Interactive Form for Exercising Rights */}
      <div className="rounded-2xl border border-[#ECEAE6] bg-[#FAF9F6] p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#641C2D] text-white flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#111111]">
              Exercer vos droits sur vos données personnelles
            </h3>
            <p className="text-xs text-[#666666]">
              Transmettez votre demande directement à notre équipe de conformité (réponse garantie sous 30 jours).
            </p>
          </div>
        </div>

        <ErrorBox message={errorMsg} />

        {successMsg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-medium">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1">
                  Votre nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Jean Dupont"
                  className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1">
                  Votre adresse e-mail *
                </label>
                <input
                  type="email"
                  required
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  placeholder="jean@example.com"
                  className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">
                Type de demande *
              </label>
              <select
                value={form.request_type}
                onChange={(e) => setForm({ ...form, request_type: e.target.value as any })}
                className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
              >
                <option value="ACCESS">Droit d'accès (obtenir une copie de mes données enregistrées)</option>
                <option value="RECTIFICATION">Droit de rectification (corriger mes informations)</option>
                <option value="DELETION">Droit à l'effacement / suppression de mes données</option>
                <option value="OPPOSITION">Droit d'opposition au traitement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">
                Détails de votre demande *
              </label>
              <textarea
                required
                rows={3}
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="Précisez votre demande, éventuellement vos numéros de commande associés..."
                className="w-full rounded-lg border border-[#DCD9D3] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111111] focus:border-[#641C2D] focus:outline-none"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              <Send className="h-3.5 w-3.5 mr-2" />
              <span>{loading ? "Envoi en cours..." : "Soumettre ma demande de droits"}</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
