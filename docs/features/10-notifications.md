# Feature : NOTIFICATIONS — Notifs in-app + dispatcher

**Epic :** 10 | **Taille :** M | **Statut :** TODO

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

- [ ] enum `notification_type` (domaines) : `theme_request`, `theme_request_confirmed`,
      `help_response`, `help_confirmed`, `absence_decision`, … (extensible)
- [ ] enum `notification_severity` : `info` | `action_required`
- [ ] table `notifications` : `id`, `recipient_ludo_id`, `recipient_member_id` (nullable →
      toute la ludo), `type`, `severity`, `entity_type`, `entity_id`, `title`, `body`,
      `is_read`, `created_at`
- [ ] relations Drizzle (recipientLudo, recipientMember)

### Dispatcher (`src/lib/server/services/events.ts`)

- [ ] `emitEvent(event)` → écrit `activity_log` (audit, ludo acteur) **+** fan-out
      `notifications` (par destinataire) selon une **table de routage** type → (severity,
      destinataires)
- [ ] Brancher sur les services existants : `requestTheme`, `confirmLoanRequest` /
      `declineLoanRequest`, `respondToRequest`, `confirmVolunteer`, approbation d'absence
- [ ] Au passage : câbler enfin `activity_log` (jusqu'ici jamais écrit) — bonus pour 11-ADMIN

### DB queries (`src/lib/server/db/notifications.ts`)

- [ ] `listForMember(ludoId, memberId, { unreadOnly? })`, `countActionRequired(...)`
- [ ] `markRead(id, recipient)`, `markAllRead(ludoId, memberId)`
- [ ] `createNotifications(rows)` (batch, depuis le dispatcher)

### Service (`src/lib/server/services/notifications.ts`)

- [ ] `getInbox(ludoId, memberId)` (groupé par domaine), `getBadgeCount(...)` (action_required)
- [ ] `read(id, ctx)` / `readAll(ctx)` avec garde destinataire

### UI

- [ ] Badge compteur sur l'item dédié du shell (epic 08) — `action_required` uniquement
- [ ] `src/routes/reseau/notifications/+page.svelte` (ou dropdown depuis le shell) — liste
      groupée par domaine, lien profond vers l'entité (`entity_type` + `entity_id`)
- [ ] Marquage lu au clic / « tout marquer comme lu »
- [ ] Filtre par domaine ; `info` consultable mais hors badge

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
