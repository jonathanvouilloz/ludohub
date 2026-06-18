# Feature : FRÉQUENTATION — Relevé & clôture de séance

**Epic :** 14 | **Taille :** M | **Statut :** EN COURS (cadrage)

## Etat session 2026-06-18

**Fait :**

- Cadrage complet (cette spec) à partir du brainstorming Jonathan. Aucune ligne de code.
- Décisions produit tranchées (voir § « Décisions tranchées ») : module `frequentation`, saisie manuelle date+période, météo Open-Meteo hybride (pré-rempli + corrigible), portée V1 = saisie + liste + totaux du mois, nouvelle entrée nav `[ludo]/frequentation`.
- Constat schéma : **aucune notion d'horaires/jours d'ouverture** n'existe (la table `ludotheques` n'a que name/slug/couleur/contact ; `saturday_slots` est spécifique au planning des samedis). V1 ne crée donc **pas** de config horaires — date + période saisies à la clôture.

**Prochain :** Valider la spec, puis Phase 1 = schema (1 table + 2 enums) + `pnpm db:push` (joué par Jonathan).
**Pièges :** Ne pas réutiliser `saturday_slots` (samedis/planning uniquement). La table fréquentation est indépendante. Coords Genève hardcodées en V1 (toutes les ludos FASE sont à Genève) — ne pas géocoder l'adresse.
**Commit :** _(à venir)_ docs(frequentation): cadre epic 14 (relevé & clôture de séance)

---

## Carte du code

> Mise à jour : 2026-06-18 — à compléter au fil de l'implémentation.

| Fichier                                              | Role (prévu)                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/server/schema.ts`                           | Table `attendance_records` + 2 enums (`attendance_period`, `weather_condition`) + relations + types |
| `src/lib/server/db/attendance.ts`                    | Queries : créer, lister (par mois), totaux agrégés, vérif unicité `(ludo_id, date, period)`    |
| `src/lib/server/services/attendance.ts`              | `recordSession`, `updateSession`, `deleteSession`, `getMonthSummary` (validation métier)        |
| `src/lib/server/weather.ts`                          | Client Open-Meteo : `fetchWeather(date)` → `{ condition, temperature }` (mapping code WMO)      |
| `src/routes/[ludo]/frequentation/+page.server.ts`    | `load` (liste mois + totaux) + actions `record` / `update` / `delete`                          |
| `src/routes/[ludo]/frequentation/+page.svelte`       | Liste chronologique + cartes totaux + bouton « Clôturer une séance »                           |
| `src/routes/[ludo]/frequentation/+server.ts` (ou action) | Endpoint météo : `GET ?date=YYYY-MM-DD` → JSON `{ condition, temperature }` (pré-remplissage)  |
| `src/lib/components/frequentation/CloseSessionDialog.svelte` | Formulaire de clôture (date, période, compteurs, météo pré-remplie + corrigible)      |
| `src/lib/components/frequentation/SessionList.svelte` | Tableau/cartes des séances clôturées du mois                                                  |
| `src/lib/components/frequentation/WeatherPicker.svelte` | 4 pastilles beau/gris/pluie/neige + input température                                        |
| `src/lib/components/nav/nav-config.ts`               | + entrée « Fréquentation » (icône `ClipboardList`, zones sidebar/sheet)                        |

### Décisions clés (à respecter)

- **Une séance = une ligne `attendance_records`.** Identité métier = `(ludo_id, date, period)`. Unicité contrainte en DB.
- **Pas de config horaires en V1.** Date (défaut aujourd'hui) + période choisies à la clôture. Pas de dépendance à `saturday_slots`.
- **Météo : Open-Meteo, hybride.** Pré-remplissage auto à l'ouverture du dialog (selon la date), **toujours corrigible** manuellement. L'API ne doit jamais bloquer la clôture (fallback : champs vides, saisie manuelle).
- **Coords Genève hardcodées** (`lat 46.2044`, `lon 6.1432`) en V1. Affinage par ludo = V2.
- **Pas de notification.** La clôture est un acte de saisie interne ; aucun `emitEvent`/notif en V1. (Journalisation `activity_log` optionnelle — voir edge cases.)

## Description

Aujourd'hui, à chaque ouverture, le staff compte à la main (petit compteur) le nombre
d'**adultes** et d'**enfants** venus, ainsi que le nombre de **prêts** et de **retours**.
En fin de séance, ces chiffres sont recopiés dans un fichier Excel, avec en plus la
**météo** du jour et la **température** (suivi canicule). C'est manuel, peu pratique,
et les données ne sont pas exploitables.

Cette feature remplace l'Excel par un module **Fréquentation** : un bouton « Clôturer
une séance » ouvre un formulaire qui enregistre, pour une **date** et une **période**
données, les 4 compteurs + la météo. Les séances clôturées sont listées et totalisées
(mois en cours en V1 ; graphiques et export en V2).

**Notion de période** : une journée peut comporter plusieurs séances selon les horaires.
En V1, 3 périodes possibles :

- `matin`
- `apres_midi`
- `evenement` — séance particulière (ex. « soirée jeu »), avec un **libellé libre** obligatoire.

> Note : la ludo n'ouvre pas tous les jours (ex. Pâquis-Sécheron : mardi, mercredi, jeudi,
> samedi). On ne modélise **pas** ces jours en V1 — la date est saisie librement à la clôture.

## Modèle de données (proposé)

```
attendance_records   (id, ludo_id, date, period, event_label,
                      adults_count, children_count, loans_count, returns_count,
                      weather, temperature, closed_by_member_id, created_at, updated_at)
  -- period      : attendance_period enum ['matin', 'apres_midi', 'evenement']
  -- event_label : text NULLABLE — requis ssi period = 'evenement', sinon null
  -- weather     : weather_condition enum ['beau', 'gris', 'pluie', 'neige'] NULLABLE
  -- temperature : integer NULLABLE (°C, peut être négatif)
  -- *_count     : integer NOT NULL default 0 (>= 0)
  -- UNIQUE (ludo_id, date, period)
```

**Enums :**

- `attendance_period` = `['matin', 'apres_midi', 'evenement']`
- `weather_condition` = `['beau', 'gris', 'pluie', 'neige']`

**Relations clés :**

- `attendance_records.ludo_id` → `ludotheques.id` (cascade)
- `attendance_records.closed_by_member_id` → `members.id` (set null / restrict — `closed_by` informatif)

**Types attendus :** `AttendanceRow`, `AttendanceInsert`, `AttendancePeriod`, `WeatherCondition`.

## Intégration météo — Open-Meteo

- **API** : `https://api.open-meteo.com/v1/forecast` (date du jour / proche) et
  `https://archive-api.open-meteo.com/v1/archive` (dates passées). Pas de clé, pas de compte.
- **Params** : `latitude=46.2044&longitude=6.1432&daily=weather_code,temperature_2m_max&timezone=Europe/Zurich&start_date=…&end_date=…`
- **Mapping `weather_code` (WMO) → `weather_condition`** :
  | Code WMO | Signification | → condition |
  | -------- | ------------- | ----------- |
  | 0 | ciel clair | `beau` |
  | 1 | plutôt clair | `beau` |
  | 2–3 | nuageux / couvert | `gris` |
  | 45, 48 | brouillard | `gris` |
  | 51–67 | bruine / pluie | `pluie` |
  | 80–82 | averses | `pluie` |
  | 71–77, 85–86 | neige | `neige` |
  | 95–99 | orage | `pluie` |
- **Température** : `temperature_2m_max` arrondi à l'entier (proposition ; corrigible).
- **Robustesse** : timeout court (~3 s), `try/catch` ; en cas d'échec → renvoyer `null` →
  le dialog s'ouvre avec météo/température vides, saisie manuelle. La clôture n'est **jamais** bloquée.
- **Côté serveur** : `fetch` via un endpoint SvelteKit (pas d'appel direct client → évite CORS et
  centralise le mapping). `$env` non requis (pas de clé).

## Flows

**Flow — Clôturer une séance :**

1. `[ludo]/frequentation` → bouton « Clôturer une séance ».
2. Dialog : date (défaut = aujourd'hui), période (`matin`/`apres_midi`/`evenement`).
   Si `evenement` → champ libellé obligatoire apparaît.
3. À l'ouverture (et au changement de date), pré-remplissage météo + température via Open-Meteo
   (corrigibles : 4 pastilles + input °C).
4. Saisie des 4 compteurs (adultes, enfants, prêts, retours), défaut 0.
5. Confirmer → crée `attendance_records`. Refus si `(date, period)` déjà clôturée pour ce ludo
   (proposer d'éditer la séance existante).
6. La séance apparaît en tête de la liste ; les totaux du mois se mettent à jour.

**Flow — Consulter / corriger :**

1. Liste chronologique des séances du **mois en cours** (date, période, compteurs, météo).
2. Cartes de **totaux** en haut : Σ adultes, Σ enfants, Σ prêts, Σ retours (mois courant).
3. Une séance peut être **éditée** ou **supprimée** (corrige une erreur de saisie).

## Tâches

### Phase 1 — Schema

- [ ] Table `attendance_records` + 2 enums (`attendance_period`, `weather_condition`) dans `schema.ts`
- [ ] Contrainte `UNIQUE (ludo_id, date, period)`
- [ ] Relations Drizzle + types (`AttendanceRow`, `AttendanceInsert`, …)
- [ ] `pnpm db:push` vers Neon (joué par Jonathan)

### Phase 2 — DB + Services + Météo

- [ ] `db/attendance.ts` : `createRecord`, `updateRecord`, `deleteRecord`, `listByMonth(ludoId, year, month)`, `getMonthTotals(ludoId, year, month)`, `existsForSlot(ludoId, date, period)`
- [ ] `services/attendance.ts` :
  - `recordSession(ludoId, memberId, input)` → valide compteurs ≥ 0 ; `event_label` requis ssi `evenement` ; refuse doublon `(date, period)`
  - `updateSession(recordId, ludoId, input)` / `deleteSession(recordId, ludoId)` (vérif appartenance au ludo)
  - `getMonthSummary(ludoId, year, month)` → `{ records, totals }`
- [ ] `weather.ts` : `fetchWeather(date)` → Open-Meteo (forecast vs archive selon date) + mapping WMO + fallback `null`

### Phase 3 — Pages & composants

- [ ] Route `[ludo]/frequentation` : `+page.server.ts` (load mois + totaux ; actions `record`/`update`/`delete`)
- [ ] Endpoint pré-remplissage météo (`+server.ts` `GET ?date=`)
- [ ] `+page.svelte` : cartes totaux + `SessionList` + bouton clôture
- [ ] `CloseSessionDialog.svelte` (date, période, libellé conditionnel, compteurs, météo pré-remplie)
- [ ] `WeatherPicker.svelte` (4 pastilles tokenisées + input °C)
- [ ] `SessionList.svelte` (réutiliser `DataTable`/`DataCard` du design system)
- [ ] Entrée nav « Fréquentation » dans `nav-config.ts` (icône `ClipboardList`, zones `sidebar`/`sheet`)

### Phase 4 — Tests

- [ ] `services/attendance.test.ts` : doublon `(date, period)` refusé ; `event_label` requis ssi `evenement` ; compteurs négatifs refusés ; totaux du mois corrects ; édition/suppression vérifient le ludo
- [ ] (optionnel) test du mapping `weather_code` → `weather_condition`
- [ ] e2e : clôturer une séance → la voir en liste → corriger un compteur (reporté à l'epic 12 si besoin)

## Edge cases

- **Doublon** `(ludo_id, date, period)` : refus à la création ; rediriger vers édition de la séance existante.
- **`evenement` sans libellé** : refus (libellé obligatoire). Pour `matin`/`apres_midi`, `event_label` = null.
- **Plusieurs événements le même jour** : `(date, 'evenement')` étant unique, on ne peut saisir qu'**un** événement par jour en V1. → à confirmer avec Jonathan (cf. question ouverte ci-dessous).
- **Compteurs** : ≥ 0, défaut 0. Pas de plafond.
- **Température** : peut être négative ; nullable (si météo non récupérée et non saisie).
- **API météo indisponible** : dialog s'ouvre avec météo/temp vides → saisie manuelle. Jamais bloquant.
- **Date future** : autorisée techniquement, mais l'archive météo n'existera pas → forecast ou champs vides. Pas d'interdiction stricte en V1.
- **Séance d'un jour où la ludo est fermée** : non contrôlé (pas de config horaires). La saisie reste libre.
- **Permissions** : tout membre connecté du ludo peut clôturer/éditer (pas `responsableOnly` en V1) — à confirmer.

## Critères d'acceptation

- [ ] Depuis `[ludo]/frequentation`, on clôture une séance (date + période + 4 compteurs + météo) en quelques clics.
- [ ] La météo et la température sont pré-remplies automatiquement et restent corrigibles.
- [ ] Une seule séance par `(date, période)` ; tentative de doublon refusée proprement.
- [ ] Une séance « événement » exige un libellé.
- [ ] La liste du mois et les totaux (adultes/enfants/prêts/retours) sont corrects.
- [ ] Une séance peut être éditée ou supprimée pour corriger une saisie.
- [ ] La clôture fonctionne même si l'API météo échoue.

## Décisions tranchées (2026-06-18)

- **Horaires : pas de config en V1.** Date + période saisies manuellement à la clôture. Pas de table settings, pas de réutilisation de `saturday_slots`. Config horaires = V2 éventuel (pré-remplissage/contrôles).
- **Météo : Open-Meteo, hybride.** Pré-rempli automatiquement (coords Genève hardcodées) + correction manuelle toujours possible. Choisi pour : zéro clé/compte, gratuit usage non-commercial, météo actuelle **et** historique, fallback simple.
- **Portée V1 : saisie + liste + totaux du mois.** Graphiques (fréquentation, météo vs affluence), filtres par période et export Excel/CSV = **V2**.
- **Navigation : nouvelle entrée `[ludo]/frequentation`** (pas un sous-onglet du planning).
- **Pas de notification** sur la clôture (acte de saisie interne).

## Questions ouvertes (à trancher avant Phase 3)

- **Plusieurs événements le même jour ?** L'unicité `(date, period)` limite à un seul événement/jour. Si besoin de plusieurs, remplacer la contrainte par `(ludo_id, date, period)` **sauf** pour `evenement` (ou ajouter un discriminant). À confirmer selon l'usage réel.
- **Permissions** : tout membre ou `responsableOnly` pour la clôture/édition ? Défaut proposé : tout membre connecté du ludo.
- **Journalisation `activity_log`** : tracer les clôtures dans le journal d'activité (via `emitEvent` sans notif) ? Utile pour l'admin global, optionnel en V1.
