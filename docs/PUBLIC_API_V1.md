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
