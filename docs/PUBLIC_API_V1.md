# API publique V1

Base : `/api/public/v1/{ludo}` où `{ludo}` est le slug stable de la ludothèque.

## Lieux et horaires

`GET /api/public/v1/{ludo}/sites`

La route retourne uniquement les lieux actifs lorsque le module **Site public** est activé. Un slug inconnu et un module désactivé produisent tous deux un `404`, afin de ne pas révéler l'existence d'un tenant privé.

```json
{
  "version": 1,
  "data": {
    "ludo": { "slug": "paquis-secheron", "name": "Pâquis-Sécheron" },
    "sites": [
      {
        "id": "uuid",
        "slug": "paquis",
        "name": "Pâquis",
        "address": "…",
        "postalCode": "1201",
        "city": "Genève",
        "phone": null,
        "email": null,
        "accessInfo": null,
        "latitude": null,
        "longitude": null,
        "isPrimary": true,
        "sortOrder": 0,
        "openingIntervals": [{ "dayOfWeek": 2, "opensAt": "14:00", "closesAt": "18:30" }]
      }
    ]
  }
}
```

`dayOfWeek` suit ISO-8601 : lundi vaut `1`, dimanche vaut `7`.

## Cache et origines

- Succès : `Cache-Control: public, max-age=30, s-maxage=60, must-revalidate`.
- Absence : `Cache-Control: no-store`.
- Les appels serveur-à-serveur sans en-tête `Origin` sont autorisés.
- Les appels navigateur sont limités à la liste séparée par des virgules dans `PUBLIC_API_ALLOWED_ORIGINS`.
- `OPTIONS` expose uniquement `GET, OPTIONS`.

Le CDN ne sert pas de réponse périmée au-delà de ce TTL court. Le site public peut conserver son dernier contenu valide comme repli contrôlé et doit prévoir un état vide lorsque la route retourne `404`.

## Annonces actives

`GET /api/public/v1/{ludo}/announcements`

Le filtre facultatif `?site={slug-du-lieu}` limite les annonces à un lieu actif. Sans filtre, la route retourne toutes les annonces actives qui concernent au moins un lieu encore actif. Une liste `sites` vide sur une annonce signifie « tous les lieux actifs ».

Seuls `id`, `title`, `message`, `publishedAt` et les lieux publics sont exposés. Les auteurs internes, états de brouillon et métadonnées d'audit ne quittent jamais LudoHub.

## Actualités

- `GET /api/public/v1/{ludo}/news` retourne une projection légère des actualités publiées, les plus récentes d'abord, sans leur corps Markdown.
- `GET /api/public/v1/{ludo}/news/{slug}` retourne une page de détail partageable.
- `?site={slug-du-lieu}` applique le même filtrage de lieu que les annonces.
- `?limit=3` sur la liste fournit le bloc d'accueil ; la limite vaut 20 par défaut et va de 1 à 50. Elle est appliquée directement en base.

Le détail expose `bodyMarkdown`. LudoHub refuse le HTML brut et les schémas de liens dangereux. Le consommateur doit tout de même rendre le Markdown avec HTML désactivé et n'autoriser que les liens `https:`, `http:` et `mailto:`. Une image est soit `null`, soit un objet `{ url, alt }` complet.

## Activités

- `GET /api/public/v1/{ludo}/activities` retourne les activités publiées actuelles.
- `GET /api/public/v1/{ludo}/activities/archive` retourne uniquement les activités publiées archivées.
- `GET /api/public/v1/{ludo}/activities/{slug}` retourne le détail d'une activité actuelle ou archivée.
- `?site={slug-du-lieu}` filtre sur un lieu actif ; `?limit={1..50}` vaut 20 par défaut sur les listes.

Les listes sont bornées en base et n'exposent ni auteurs, ni clés de stockage, ni futures inscriptions. Le corps `bodyMarkdown` n'apparaît que dans le détail. `lifecycle` vaut `active` ou `archived` ; les brouillons, contenus masqués et éléments en corbeille ne sont jamais publics.

Le payload indique `timeZone: "Europe/Zurich"`. Une liste ne contient qu'un aperçu des trois premières dates et aucun motif d'exception ; le détail porte le calendrier complet, borné à 366 dates et 366 exceptions. Les instants sont renvoyés en ISO-8601 : le consommateur les affiche dans ce fuseau, sans développer lui-même une récurrence. `schedule.type` vaut `one_off`, `recurring` ou `permanent`; une activité permanente n'a ni dates ni exceptions. Une RRULE récurrente est toujours bornée par `COUNT` (maximum 366) ou par `UNTIL` (au plus cinq ans après la première occurrence).

## Top 3

- `GET /api/public/v1/{ludo}/top-threes` retourne les sélections publiées ; `?site={slug}` et `?limit={1..50}` suivent les mêmes règles que les autres listes.
- `GET /api/public/v1/{ludo}/top-threes/{slug}` retourne une sélection publiée et ses descriptions.

Chaque sélection contient exactement trois jeux saisis directement. La liste ne projette que leur nom ; le détail ajoute la description facultative. Aucun identifiant de catalogue, membre interne, révision ou historique n'est exposé.

## FAQ

`GET /api/public/v1/{ludo}/faqs` retourne les questions publiées dans l'ordre manuel, puis par identifiant stable. `?site={slug}` filtre un lieu actif et `?limit={1..200}` vaut 100 par défaut. Les réponses sont exposées en `answerMarkdown`, avec HTML brut désactivé et liens filtrés.

## Documents institutionnels

- `GET /api/public/v1/{ludo}/documents` retourne une projection légère des documents publiés.
- `GET /api/public/v1/{ludo}/documents/{slug}` retourne le détail et le texte Markdown éventuel.

Un document est de type `mission`, `statutes`, `annual_report` ou `other`. L'année est présente uniquement pour un rapport annuel. Le contenu comporte un texte, un PDF public ou les deux. L'objet PDF expose uniquement `{ url, fileName }`; la clé de stockage, les auteurs internes et la révision restent privés.

## Galerie

`GET /api/public/v1/{ludo}/gallery` retourne une galerie simple, sans albums, dans l'ordre manuel. `?site={slug}` filtre un lieu actif et `?limit={1..100}` vaut 50 par défaut. Chaque entrée expose uniquement l'image publique, son texte alternatif, sa légende et son ordre.

## Équipe et comité

`GET /api/public/v1/{ludo}/profiles` retourne les profils publics ordonnés. `?section=team|committee` sélectionne une section ; `?site={slug}` et `?limit={1..200}` complètent le filtre. Le lien facultatif vers un membre LudoHub, les auteurs et les clés de stockage ne sont jamais exposés.

## Annuaire des ludothèques genevoises

`GET /api/public/v1/{ludo}/directory` retourne au plus 100 entrées publiées, dans l'ordre manuel (`?limit={1..200}`). Une entrée expose `id`, `slug`, `name`, `descriptionMarkdown`, l'adresse et les coordonnées publiques, `website` facultatif, ainsi que les liens distincts et obligatoires `directionsUrl` et `officialUrl`. Ces liens sont toujours des URL `http:` ou `https:` validées. Les brouillons, entrées masquées, auteurs, révisions et métadonnées d'audit ne sont jamais exposés.

## Formulaire de contact public

L'écriture est volontairement séparée de l'API publique de lecture : `POST /api/public/contact/v1/{ludo}`. Le JSON doit contenir `recipient` (`paquis`, `secheron` ou `general`), `name`, `email`, `subject` et `message`; `phone` est facultatif. L'en-tête `Idempotency-Key` est obligatoire (16 à 200 caractères ASCII visibles). Une première soumission répond `201`, une répétition reconnue répond `200`, toujours avec seulement `{ "accepted": true, "receiptId": "…" }`. Le message et les coordonnées ne sont jamais renvoyés par cette route.

La route impose une taille maximale de 16 Kio, un champ honeypot `website` et un quota par empreinte de source de 5 requêtes par 10 minutes. Ce quota en mémoire est une protection best-effort par instance et doit être remplacé par un stockage partagé si l'application est déployée sur plusieurs instances. Les messages sont conservés dans la boîte interne avec les états `new`, `processed` ou `archived`; aucun e-mail n'est envoyé et aucun destinataire réel n'est inventé. Les données personnelles ne doivent apparaître ni dans les journaux, ni dans les audits, ni dans une API publique de lecture.
