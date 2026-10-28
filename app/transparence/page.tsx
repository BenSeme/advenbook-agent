import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transparence et données — AdvenBook Agent",
  description:
    "Ce que l'agent fait de vos conversations, photos et données Strava, en langage simple.",
};

export default function TransparencePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 48px", lineHeight: 1.65 }}>
      <p><a href="/">← Retour à l’agent</a></p>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Transparence : vos données, en langage simple</h1>

      <h2>Ce que fait cet agent</h2>
      <p>
        Vous décrivez le livre que vous voulez. L’agent vous aide à choisir vos sorties,
        vous pose quelques questions, puis crée un <strong>brouillon de livre</strong> chez
        AdvenBook. Rien n’est commandé ni payé tant que vous n’avez pas terminé la commande
        sur advenbook.com.
      </p>

      <h2>Vos conversations et votre voix</h2>
      <p>
        Vos messages écrits et vos enregistrements vocaux sont envoyés aux modèles d’IA de
        Meta (Muse Spark pour la conversation, Muse Voice pour transcrire la voix) afin de
        vous répondre. <strong>N’envoyez pas de contenu sensible</strong> : comme pour tout
        service d’IA, le fournisseur peut traiter les contenus transmis selon ses propres
        conditions. La conversation reste affichée dans votre navigateur ; notre serveur ne
        conserve pas vos messages.
      </p>

      <h2>Vos photos</h2>
      <ul>
        <li>La date et le lieu éventuels d’une photo (EXIF) sont lus <strong>dans votre navigateur</strong>, sur votre appareil.</li>
        <li>Si vous demandez à l’IA de choisir et recadrer vos photos, elles sont envoyées aux modèles Meta (sélection visuelle et recadrage SAM).</li>
        <li>Les photos gardées sont téléversées vers un stockage temporaire public (Vercel Blob), le temps qu’AdvenBook les copie dans votre livre. <strong>Après une création réussie, nos copies sont supprimées.</strong> En cas d’échec, elles sont conservées pour permettre un nouvel essai.</li>
        <li>Les photos déjà présentes sur votre Strava sont ajoutées par AdvenBook lui-même : elles ne passent pas par cet agent.</li>
      </ul>

      <h2>Strava, compte et paiement</h2>
      <ul>
        <li>La connexion Strava se fait sur les pages d’AdvenBook et de Strava. Cet agent ne voit jamais votre mot de passe Strava.</li>
        <li>Aucun compte n’est créé chez l’agent, et <strong>aucune carte bancaire ni adresse ne vous sera jamais demandée dans la conversation</strong>.</li>
        <li>Le bouton « Commander mon livre » crée votre compte AdvenBook en un clic, puis ouvre la page de paiement sécurisée Stripe d’AdvenBook. Le paiement et la livraison se font là-bas, uniquement là-bas.</li>
        <li>Sans Strava (fichiers GPX, photos, liste tapée), le même principe s’applique : anonyme pour créer, compte au moment de commander.</li>
      </ul>

      <h2>Le cookie anonyme</h2>
      <p>
        Un cookie nommé <code>ab-vid</code> contient un identifiant aléatoire signé, sans
        aucune donnée personnelle. Il sert uniquement à limiter l’usage par visiteur, pour
        éviter qu’un robot épuise le budget du service. Il dure 30 jours et ne suit personne
        d’un site à l’autre.
      </p>

      <h2>Ce que nous comptons</h2>
      <p>
        Des compteurs anonymes : nombre de conversations, de livres créés et de clics sur
        « Ouvrir » / « Commander ». Aucun contenu, aucun nom, aucun identifiant de livre.
        C’est tout.
      </p>

      <h2>Vos questions</h2>
      <p>
        Pour toute question sur vos données ou votre livre, contactez AdvenBook via{" "}
        <a href="https://www.advenbook.com" target="_blank" rel="noreferrer">advenbook.com</a>.
      </p>

      <hr />
      <h2>English summary</h2>
      <p>
        This agent turns your outings into an AdvenBook draft. Conversations, voice and
        photos you choose to analyse are processed by Meta AI models — do not send sensitive
        content. Photo dates are read locally in your browser; kept photos are temporarily
        uploaded so AdvenBook can copy them, then our copies are deleted after a successful
        creation. Strava login happens on AdvenBook/Strava pages; we never see your password.
        No account, card or address is ever requested in the chat: ordering happens through
        the “Order my book” button (one-click AdvenBook account, then secure Stripe payment
        on advenbook.com). A signed random cookie caps per-visitor usage, and we only keep
        anonymous counters (conversations, books created, button clicks).
      </p>
    </main>
  );
}
