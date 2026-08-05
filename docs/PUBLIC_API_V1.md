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
