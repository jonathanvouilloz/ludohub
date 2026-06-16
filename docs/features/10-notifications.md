# Feature : NOTIFICATIONS — Notifs in-app + dispatcher

**Epic :** 10 | **Taille :** M | **Statut :** DONE

## Etat session 2026-06-16

**Fait :**

- Schéma : enums `notification_type` (8) + `notification_severity`, table `notifications`
  (recipient ludo/membre nullable, type, severity, entité, title/body, is_read) + relations + types.
- Dispatcher unique `services/events.ts` (`emitEvent`) : écrit `activity_log` (enfin câblé) **et**
  fan-out notifications par destinataire ; routage type→severity, fan-out responsables, pas
  d'auto-notif, idempotence (`hasUnreadNotification`), best-effort (try/catch).
- 8 points d'émission branchés (prêts ×3, aide ×2, absences ×3) ; lecture
  `services/notifications.ts` (inbox groupé, badge action_required, read/readAll gardés).
- UI : badge rouge dans le shell (sidebar élargie 72→104px pour le label « Notifications »),
  page `/reseau/notifications` (groupes + filtres + lien profond + marquage lu).
- **Fix régression epic 08** : catalogue `/reseau/themes` était devenu inaccessible (cross-links
  retirés, aucun item shell vers lui) → ajout d'une sous-nav réseau (onglets Aide / Catalogue thèmes).
- Vérif : `pnpm test` 64 verts (52 + 12 nouveaux), `pnpm check` 0 erreur, lint propre.

**Prochain :** epic terminé. Les 2 tests Playwright (notifs) restent reportés à l'epic 12.
Prochain epic : **11-ADMIN** (super admin, consomme `activity_log` désormais peuplé).
**Pieges :** `db:push` requis avant exécution (table `notifications`). Le push de prêt n'était pas
cassé — seul le catalogue réseau était orphelin de lien. Catalogue réseau = thèmes `is_shareable`
uniquement (pas de vue dédiée « prêts reçus »).
**Commit :** [0ffac48] feat(notifs): notifications in-app + dispatcher (epic 10)

---

## Carte du code

> Mise a jour : 2026-06-16

| Fichier                                       | Role                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/server/schema.ts`                    | Enums + table `notifications` + relations + types                          |
| `src/lib/server/services/events.ts`           | Dispatcher `emitEvent` : audit + fan-out notifs (point d'émission unique)  |
| `src/lib/server/services/notifications.ts`    | Lecture : `getInbox` (groupé), `getBadgeCount`, `read`/`readAll`           |
| `src/lib/server/db/notifications.ts`          | Queries notifs (create batch, list, count, markRead/All, idempotence)      |
| `src/lib/server/db/activity_log.ts`           | `insertActivity` (audit append-only)                                       |
| `src/lib/server/services/{loans,help,absences}.ts` | Appellent `emitEvent` après mutation (8 points d'émission)            |
| `src/lib/components/nav/NavItem.svelte`       | Badge compteur dans `.nav-item__icon` ; label nowrap                       |
| `src/lib/components/nav/{AppShell,AppSidebar,BottomTabBar,MoreSheet}.svelte` | Cascade `notifCount` ; badge sur « Plus » mobile    |
| `src/routes/{[ludo],reseau}/+layout.server.ts` | Calculent `notifCount` via `getBadgeCount`                                |
| `src/routes/reseau/+layout.svelte`            | Sous-nav réseau (onglets Aide / Catalogue thèmes)                          |
| `src/routes/reseau/notifications/+page.{server.ts,svelte}` | Page inbox (groupes, filtres, lien profond, marquage lu)      |

### Decisions cles

- Notifications **≠** `activity_log` : tables distinctes, **point d'émission unifié** via `emitEvent`.
- Dispatch best-effort : `emitEvent` ne fait jamais échouer l'action métier (try/catch + log).
- Destinataires résolus dans l'événement : ludo entière, membre précis, ou `recipientResponsablesOf` (fan-out).
- Badge = `action_required` non lues uniquement ; `info` consultable hors badge.
- Sidebar élargie à 104px (token `--sidebar-width`) pour loger le label « Notifications ».

---

## Contexte

Aujourd'hui tout est en « pull » : il faut ouvrir une page (thèmes, `/reseau/aide`…) pour
voir qu'une action est en attente. Besoin transverse (demandes d'emprunt de thèmes,
réponses aux demandes d'aide, décisions d'absence, matériel…). Cette feature ajoute des
**notifications in-app** (pas de push web/email — hors stack ; éventuellement plus tard via
Brevo).

**Pré-requis : epic 08-NAVIGATION** (le badge compteur vit dans le shell).

## Décision d'architecture

Notifications **≠** `activity_log` — deux préoccupations distinctes :

| | `activity_log` (audit) | `notifications` (action) |
| --- | --- | --- |
| Audience | super-admin (11-ADMIN) | un membre / une ludo |
| Cycle de vie | append-only, immuable | lu / non-lu, ça se vide |
| Cible | la ludo **acteur** | le **destinataire** (souvent une autre ludo) |
| Cardinalité | 1 événement = 1 ligne | 1 événement = 0..N notifs (fan-out) |

→ On **ne fusionne pas** les tables. On **unifie le point d'émission** : un dispatcher reçoit
un événement de domaine et écrit **la ligne d'audit** (`activity_log`) **et** les
notifications par destinataire. Un seul call site dans les services, deux préoccupations.

## Tâches

### Schéma (`src/lib/server/schema.ts`) — `db:push`

- [x] enum `notification_type` (domaines) : `theme_request`, `theme_request_confirmed`,
      `theme_request_declined`, `help_response`, `help_confirmed`, `absence_request`,
      `absence_approved`, `absence_refused` (extensible)
- [x] enum `notification_severity` : `info` | `action_required`
- [x] table `notifications` : `id`, `recipient_ludo_id`, `recipient_member_id` (nullable →
      toute la ludo), `type`, `severity`, `entity_type`, `entity_id`, `title`, `body`,
      `is_read`, `created_at`
- [x] relations Drizzle (recipientLudo, recipientMember)

### Dispatcher (`src/lib/server/services/events.ts`)

- [x] `emitEvent(event)` → écrit `activity_log` (audit, ludo acteur) **+** fan-out
      `notifications` (par destinataire) selon une **table de routage** type → severity ;
      résolution destinataires dans l'événement (ludo entière, membre, ou `recipientResponsablesOf`)
- [x] Brancher sur les services existants : `requestTheme`, `confirmLoanRequest` /
      `declineLoanRequest`, `respondToRequest`, `confirmVolunteer`, `approveAbsence` /
      `refuseAbsence`, `requestAbsence` (8 points)
- [x] Au passage : câbler enfin `activity_log` (jusqu'ici jamais écrit) — bonus pour 11-ADMIN
- [x] Best-effort : `emitEvent` ne fait jamais échouer l'action métier (try/catch) ;
      idempotence via `hasUnreadNotification`

### DB queries (`src/lib/server/db/notifications.ts`, `db/activity_log.ts`)

- [x] `listForRecipient(ludoId, memberId, { unreadOnly? })`, `countActionRequired(...)`
- [x] `markRead(id, ludoId, memberId)`, `markAllRead(ludoId, memberId)` (gardes destinataire)
- [x] `createNotifications(rows)` (batch, depuis le dispatcher), `hasUnreadNotification(...)`
- [x] `insertActivity(row)` + `getActiveResponsables(ludoId)` (fan-out responsables)

### Service (`src/lib/server/services/notifications.ts`)

- [x] `getInbox(ludoId, memberId)` (groupé par domaine), `getBadgeCount(...)` (action_required)
- [x] `read(id, ctx)` / `readAll(ctx)` avec garde destinataire

### UI

- [x] Badge compteur sur l'item dédié du shell (epic 08) — `action_required` uniquement ;
      surfacé aussi sur le bouton « Plus » de la tab bar mobile (item Notifications en sheet)
- [x] `src/routes/reseau/notifications/+page.svelte` — liste groupée par domaine, lien
      profond vers l'entité (par `type`), via formulaire `?/read` + redirect interne validé
- [x] Marquage lu au clic / « tout marquer comme lu »
- [x] Filtre par domaine ; `info` consultable mais hors badge

## Critères d'acceptation

- [ ] Une demande d'emprunt de thème notifie la ludo propriétaire (`action_required`)
- [ ] Une réponse à une demande d'aide notifie la ludo demandeuse
- [ ] Le badge ne compte que les `action_required` non lues
- [ ] Cliquer une notif l'ouvre (entité) **et** la marque lue
- [ ] `activity_log` est peuplé par le même dispatcher (vérifiable en 11-ADMIN)
- [ ] Un membre ne voit que les notifs de sa ludo (garde destinataire)

## Edge cases

- Destinataire = ludo entière (`recipient_member_id` null) vs membre précis
- Idempotence : ne pas dupliquer une notif si l'événement est rejoué
- Entité supprimée/annulée : la notif reste mais le lien profond gère l'absence proprement
- Pas d'auto-notification de l'acteur (on ne se notifie pas soi-même)

## Playwright tests

- [ ] Demande de thème depuis ludo B → badge + notif chez ludo A → clic ouvre la fiche
- [ ] « Tout marquer comme lu » remet le badge à zéro
