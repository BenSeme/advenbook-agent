# Consigne pour le développement AdvenBook (à coller à Claude côté AdvenBook)

> **FAIT — mis en production côté AdvenBook, branché côté agent.**
> Le MCP expose désormais `get_my_books({connection_id, language})` et
> `add_to_adventure_book({strava_connection_id, book_id, activities})`
> (ajout seul : ne retire rien, n'écrase aucun texte existant, erreur
> `book_already_ordered` sur un livre commandé). Côté agent : appel de
> `get_my_books` juste après la connexion Strava (parcours bouton
> déterministe et parcours modèle), carte « Je retrouve votre livre
> <titre> (<n> sorties). On continue celui-ci, ou on en commence un
> nouveau ? », continuation convertie de façon déterministe en
> `add_to_adventure_book` (même si le modèle appelle la création), et
> carte livre finale avec `editorUrl` (Ouvrir mon livre) et `orderUrl`
> (Commander mon livre). Le reste de cette note est conservé comme
> historique de la demande.

*Objet : permettre à l'agent conversationnel (advenbook-agent) de savoir
d'où vient l'utilisateur — compte existant ou non, livre existant ou
non — et de modifier un livre existant. Aujourd'hui impossible : le MCP
public ne sait que créer. L'agent ne doit ni gérer les comptes ni
stocker d'identifiants : toute l'identité reste chez AdvenBook.*

## Le problème, vu de l'agent

Trois utilisateurs différents arrivent dans la même conversation :

1. **Déjà client, compte créé via Strava, livre en cours.** Il veut
   continuer ou modifier SON livre. L'agent ne peut ni le retrouver ni
   l'ouvrir : il ne peut que créer un brouillon neuf à côté.
2. **Déjà client, compte e-mail, pas de Strava.** L'agent le traite en
   anonyme ; le rattachement ne se fait qu'au moment de commander.
3. **Nouveau venu.** Tout fonctionne déjà (anonyme → livre → compte en
   un clic à la commande).

Il manque donc deux choses côté MCP : **identifier** et **modifier**.

## Ce qu'il faut ajouter au MCP public

### 1. Identifier : enrichir `connect_strava` (ou nouvel outil `get_account_context`)

Après connexion Strava, l'agent doit savoir qui est en face. Au choix :

- soit `connect_strava` renvoie en plus :
  ```json
  {
    "account": { "exists": true, "athlete_name": "…" },
    "books": [
      { "bookId": "…", "title": "Été 2026", "status": "draft|ordered",
        "activities": 32, "updated_at": "2026-10-20",
        "editorUrl": "https://www.advenbook.com/fr/my-book/creer?bookId=…",
        "orderUrl": "…" }
    ]
  }
  ```
- soit un outil dédié `get_account_context({ connection_id })` avec la
  même réponse.

Règle d'identité : l'athlète Strava est l'ancre. Même Strava = même
compte AdvenBook, jamais de doublon. `books` ne contient que les livres
de ce compte. Aucun e-mail ni donnée personnelle au-delà du nom public
de l'athlète.

### 2. Modifier : un outil `update_adventure_book`

```json
{
  "bookId": "…",
  "strava_connection_id": "…",
  "add_activities": [ /* même schéma que create_adventure_book.activities */ ],
  "remove_strava_activity_ids": ["…"],
  "stories": { "<strava_activity_id>": "texte…" }
}
→ { "bookId", "claimUrl", "orderUrl", "estimatedPages", "price", "activities" }
```

- Seul le propriétaire (même `connection_id` / même compte) peut
  modifier ; sinon erreur claire.
- Un livre **déjà commandé/payé** n'est plus modifiable par l'agent :
  renvoyer une erreur explicite (`book_already_ordered`) pour que
  l'agent propose un nouveau volume.
- Même logique de photos et de tracés que la création (Strava ajoute
  cartes et photos via `strava_activity_id`).

### 3. Rattachement des livres anonymes (déjà presque là)

Le flux actuel crée des brouillons sans compte, rattachés à la commande
(`orderUrl`, compte en un clic). À confirmer côté AdvenBook : si
l'utilisateur est **déjà connecté à son compte existant** quand il ouvre
le `claimUrl`/`orderUrl`, le brouillon doit rejoindre CE compte, ne pas
en créer un second.

## Ce que fera l'agent dès que c'est disponible

1. Après `connect_strava`, lire le contexte : si des livres existent,
   demander en une phrase : « Je retrouve votre livre "Été 2026"
   (32 sorties). Je continue dedans, ou on en commence un nouveau ? »
2. « Continuer » → modifications via `update_adventure_book`, bouton
   « Ouvrir mon livre » sur l'éditeur du livre existant.
3. Aucun livre / nouveau venu → parcours actuel, inchangé.
4. Livre déjà commandé → proposer un Volume 2, jamais modifier l'original.

## En attendant (déjà en place côté agent)

Le prompt de l'agent dit la vérité : reconnecter le même Strava = même
compte ; l'agent crée un brouillon neuf à côté ; le livre existant se
continue dans l'éditeur AdvenBook ; il n'affirme jamais avoir rouvert
ou modifié un livre existant.

## Critères d'acceptation (à tester côté AdvenBook)

1. Un compte avec un livre en brouillon se connecte via Strava :
   le contexte renvoie ce livre (titre, nombre de sorties, liens).
2. `update_adventure_book` ajoute 3 sorties au livre : total +3,
   prix/pages recalculés, mêmes `claimUrl`/`orderUrl` valides.
3. Un autre `connection_id` tente de modifier ce livre : refus.
4. Livre commandé : `update_adventure_book` → `book_already_ordered`.
5. Brouillon anonyme ouvert en étant connecté à un compte existant :
   il apparaît dans ce compte, aucun doublon créé.
