# Idée : « Le film de ma saison »

*Note du 28 octobre 2026. Objectif : transformer les sorties, photos et
tracés déjà collectés par l'agent en un film de 45-60 secondes. Effet
waouh en démo, produit vendable ensuite.*

## Trois façons de faire un film (une seule est la bonne pour nous)

### A. Tout générer par IA vidéo — à éviter en produit

Veo 3.1, Runway Gen-4/4.5, Kling, Sora : on décrit, l'IA invente les
images. Prix publics vérifiés : **0,05 à 0,40 $ par seconde** (Veo Lite
0,05 ; Veo Fast ~0,10-0,12 ; Runway Turbo 0,05 ; Gen-4.5 0,12 ; Veo
Standard 0,40). Un film de 60 s coûterait **3 à 24 $ par client**, plus
les régénérations (×1,5 à 2 en pratique), par clips de 8-10 s à recoudre.

Surtout : **ce ne sont pas vos images**. L'IA invente un coureur, une
montagne, un tracé qui ne sont pas les vôtres. Pour un souvenir, c'est
un défaut fatal — et nos utilisateurs le verront.

### B. Monter automatiquement les vrais assets — recommandé

Un montage programmé, comme un éditeur vidéo automatique :

1. **Le tracé s'anime** : la polyline GPS se dessine progressivement
   sur la carte, le profil d'altitude se trace en dessous, les chiffres
   montent (distance, D+, durée). Nous avons déjà les polylines.
2. **Les photos défilent** en plein écran, recadrées 16:9 par SAM sans
   couper le sujet (déjà en place), avec de lents zooms (Ken Burns).
3. **Les titres racontent** : Muse Spark écrit le script du film à
   partir des données (chapitres, « le plus gros jour », « l'arrivée »),
   dans la langue de l'utilisateur. Aucun fait inventé : que ses données.
4. **La voix, c'est la sienne** : les réponses dictées pendant
   l'entretien deviennent la narration. Aucun concurrent ne peut
   copier ça, et ça ne coûte rien de plus — on l'enregistre déjà.
5. Rendu serveur (ffmpeg) en 720p/1080p, musique libre de droits fixe.

Coût par film : calcul + stockage ≈ **0,05 à 0,30 €**. Temps de rendu
d'un film de 60 s : quelques dizaines de secondes en tâche de fond.

### C. Hybride : B + un plan génératif d'ouverture

Un seul plan de 5 s où la photo du sommet **prend vie** (nuages qui
bougent, avancée de caméra) via Veo Fast ou Runway en image-to-video :
**~0,50 à 1 $ par film**. C'est le plan « magie » de la démo, le reste
du film reste 100 % réel.

## Et Meta là-dedans ?

Muse Video existe en aperçu dans les applis Meta, mais **n'est pas
dans l'API développeurs** (aucun endpoint, aucun prix public à ce
jour). Notre film garde donc la signature Meta autrement : Spark
réalisateur (script, choix des moments), SAM cadreur, Voice pour la
narration. Si Muse Video ouvre son API, le plan C bascule chez Meta
en changeant de fournisseur, comme le reste.

## Comment faire payer

- **Option à la commande (recommandé)** : « Ajouter le film de ma
  saison — 12 € » sur la page de commande AdvenBook. C'est un produit
  côté AdvenBook (même chantier que la modification de livres) :
  l'agent le propose, le paiement reste chez AdvenBook/Stripe.
- **QR code dans le livre** : le film est lié au livre ; un QR imprimé
  sur la dernière page ouvre le film sur le téléphone. Le livre papier
  devient la porte du film — et chaque film partagé recrute le
  prochain client.
- **Offert avec le format premium** : levier pour vendre le haut de
  gamme plutôt qu'en supplément.

Marge indicative à 12 € : coût réel < 1,30 € même en hybride, soit
> 85 % de marge avant frais de paiement.

## Découpage réaliste

1. **Démo hackathon (2-3 jours)** : montage B de 45 s, généré après la
   création du livre, lien « Voir mon film » à côté de « Ouvrir mon
   livre ». C'est le nouveau final de la vidéo jury.
2. **Produit (après)** : option payante à la commande + QR dans le
   livre (côté AdvenBook), plan d'ouverture génératif (C).

## Risques à connaître

- Rendu vidéo sur Vercel : les fonctions sont limitées en durée ;
  prévoir une file de tâches (le film arrive par lien quelques minutes
  après, comme une « première ») ou un petit service de rendu dédié.
- Musique : uniquement des titres libres de droits achetés une fois.
- Données : le film ne contient que les photos/tracés déjà envoyés
  pour le livre ; la page transparence doit le mentionner.
