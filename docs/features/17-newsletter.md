# Feature : NEWSLETTER — Audience, campagnes & envoi email (Resend)

**Epic :** 17 | **Taille :** L | **Statut :** DONE (code commité — `5e7b810`, `c5cbd9a`, `7221bef` module + segments ; `48e90c1` script import Pâquis). Reste hors-code : vérif domaine `ludohub.ch` dans Resend (DNS) avant tout vrai envoi.

## Etat session 2026-06-22 — Segments (tags)

**Fait :** Ajout d'un **segment par contact** (un seul tag, liste fixe `famille` /
`institution` / `partenaire` / `autre`, `null` = non classé) + ciblage des campagnes.

- Schéma : enum `newsletterContactTag`, colonne `newsletterContacts.tag` (nullable),
  `campaigns.targetTag` (nullable, `null` = tous). **`pnpm db:push` à faire** (non encore poussé).
- DB : `listSubscribedContacts(ludoId, tag?)`, `countSubscribed(ludoId, tag?)`,
  nouvelle `countSubscribedByTag(ludoId)` (map par segment + total + non classés).
- Service : `parseTag` (validé contre l'enum DB), tag sur `addContact`/`editContact`/
  `importContacts` (batch), `sendCampaign` filtre sur `campaign.targetTag`, `emitEvent` enrichi.
- UI : colonne **Segment** + compteurs page contacts ; select dans `ContactDialog` ;
  select « segment à appliquer » dans l'import ; carte **Destinataires** dans l'éditeur
  de campagne (compteur réactif, dialog d'envoi ciblé). Module client-safe `src/lib/newsletter/tags.ts`.
- Import Pâquis : `scripts/import-newsletter-paquis.ts` (non commité) tague 105 familles
  + 8 institutions ; exclut 4 test + 6 staff FASE. Dry-run OK (0 email malformé).

**Prochain :** (1) `pnpm db:push` (autorisation DB prod). (2) import `--commit`.
(3) `pnpm check` + `pnpm lint` : ✅. (4) Hors scope : multi-tag, tags libres, CRUD des valeurs.

---

## Etat session 2026-06-19

**Fait :** Module **entièrement codé — Phases 0→7** : schéma + enums, client Resend, CRM contacts, import CSV/xlsx (mapping + preview), template email inline-styles, éditeur campagne (image/PDF Blob), envoi batch + `emitEvent`, désabo public (token) + webhook Resend bounces. Tout est en **working tree, non commité ni testé en envoi réel**. Plan Resend tranché : **Pro 20 $/mo** (voir Décisions / env).
**Prochain :** (1) **Jonathan** : souscrire Resend **Pro** + vérifier le domaine `ludohub.ch` (DNS) — seuls prérequis hors-code. (2) Relecture du diff + `pnpm check` / `pnpm lint`, puis commit (par phase ou en bloc). (3) Test d'envoi réel une fois le domaine vérifié.
**Pieges :** L'en-tête précédent disait « pas encore codé » — **périmé** (session codée sans `/wrap-session`). Reste : domaine non vérifié → aucun envoi réel possible tant que ce n'est pas fait. Idempotence envoi à revérifier au test (verrou `status = 'sent'`).
**Commit :** _(à venir — wrap session)_

---

## Carte du code
> Mise a jour : 2026-06-19 — **codé (Phases 0→7), non commité** ; fichiers ci-dessous créés

| Fichier | Role |
|---------|------|
| `src/lib/server/resend.ts` | Client Resend (clé via `$env/dynamic/private`) |
| `src/lib/server/db/newsletter.ts` | Queries contacts + campagnes + sends (scoping ludoId) |
| `src/lib/server/services/newsletter.ts` | Import CSV/xlsx, dédup, rendu, envoi batch |
| `src/lib/server/email/template.ts` | `render(content, ludo)` → HTML email brandé |
| `src/routes/[ludo]/newsletter/**` | Liste campagnes, CRM contacts, éditeur |
| `src/routes/unsubscribe/+page.server.ts` | Désabo public (token, hors auth) |
| `src/routes/[ludo]/settings/infos/+page.server.ts` | Existant — étendre pour upload logo |

### Decisions cles
- Domaine d'envoi LudoHub **partagé** (`noreply@ludohub.ch`), `from`=nom ludo, `reply-to`=email ludo. Pas de DNS côté ludos.
- **DB Neon = source de vérité** des contacts ; Resend ne fait que livrer. Désabo géré nous-mêmes (token + page publique). Pas de Resend Audiences (sync à 2 copies).
- Template **fixe + champs structurés** (pas de WYSIWYG). Image + PDF flyer via Blob.
- v1 : envoi « maintenant » seulement, pas de tags/segments.

---

## Description

Module de communication email pour les ludothèques. Aujourd'hui aucune ludo
genevoise n'a d'outil pour envoyer une newsletter ou une annonce à son public.
Objectif : un module **simple, efficace, non-technique** permettant à un·e
responsable de :

1. gérer une **audience** (contacts externes = le public, distinct des `members`/staff),
2. **importer** des contacts via CSV/Excel,
3. **rédiger** une campagne dans un template brandé (logo + couleur de la ludo),
4. **envoyer** la campagne à tous les abonnés, avec désabonnement conforme.

On reste volontairement minimal : pas de tracking fin ouvertures/clics, pas d'A/B,
pas de segments/tags, pas d'automations. Communication ponctuelle simplifiée.

## Décisions de cadrage (validées)

- **Envoi : domaine LudoHub partagé.** Un seul domaine vérifié dans Resend
  (`noreply@ludohub.ch`). `from` = nom de la ludo, `reply-to` = email de la ludo.
  Zéro config DNS côté ludos.
- **Contacts : DB Neon = source de vérité.** Resend ne sert qu'à *livrer*. On gère
  le désabonnement nous-mêmes (token + page publique). Pas de Resend Audiences
  (modèle pauvre + problème de synchro à 2 copies).
- **Éditeur : template fixe + champs structurés** (pas de WYSIWYG libre). En-tête et
  footer brandés auto. Image optionnelle (Blob) + flyer PDF optionnel.
- **Envoi : « maintenant » uniquement** au v1. Programmation (`scheduled_at`) reportée.
- **Pas de tags/segments** au v1.

## Schéma de données (Drizzle — `src/lib/server/schema.ts`)

```ts
// Logo ludo (greffé sur la table existante)
ludotheques.logoUrl        text (nullable)        // URL Blob du logo

newsletterContactStatus  pgEnum('subscribed' | 'unsubscribed' | 'bounced')
newsletterContacts
  id, ludoId (fk cascade), email (notNull),
  firstName?, lastName?,
  status (default 'subscribed'),
  unsubscribeToken (notNull, unique),             // token public désabo
  source pgEnum('manual' | 'import') default 'manual',
  notes?,                                          // CRM light
  createdAt
  // index unique (ludoId, lower(email)) — dédup par ludo

campaignStatus  pgEnum('draft' | 'sent')
campaigns
  id, ludoId (fk cascade),
  subject (notNull), previewText?,
  content jsonb,                                   // { title, body, imageUrl?, ctaLabel?, ctaUrl?, pdfUrl?, pdfAsAttachment }
  status (default 'draft'),
  recipientCount integer default 0,
  sentAt?, createdAt

campaignSendStatus  pgEnum('sent' | 'failed' | 'bounced')
campaignSends
  id, campaignId (fk cascade), contactId (fk),
  status, resendId?, error?, createdAt
```

## Architecture (conventions projet)

```
lib/server/resend.ts                  → client Resend ($env/dynamic/private RESEND_API_KEY)
lib/server/db/newsletter.ts           → queries contacts + campagnes + sends
lib/server/services/newsletter.ts     → import CSV/xlsx, dédup, rendu HTML, envoi batch
lib/server/email/template.ts          → render(content, ludo) → HTML email brandé
```

Routes (kebab-case, responsable-only sauf désabo public) :

```
[ludo]/newsletter                     → liste des campagnes + CTA "nouvelle"
[ludo]/newsletter/contacts            → CRM : table, import, ajout/édition/suppression
[ludo]/newsletter/[id]                → éditeur campagne + preview + test + envoi
/unsubscribe                          → page publique (hors [ludo], hors auth), ?token=…
api/newsletter/contacts/import        → endpoint upload fichier (parse côté serveur)
```

Permissions : tout `[ludo]/newsletter/*` derrière `requireResponsableContext`.
Page settings : upload logo dans `[ludo]/settings/infos`.

## Variables d'environnement (à ajouter)

```
RESEND_API_KEY=        # clé API Resend
NEWSLETTER_FROM=       # noreply@ludohub.ch (domaine vérifié)
```

À documenter dans CLAUDE.md + `.env.example`.

### Plan Resend retenu — **Pro (20 $/mo, 50 000 emails/mois)**

- **Bloqueur du Free = 100 emails/jour** : un seul envoi de newsletter (batch) le dépasse
  aussitôt. Le Free ne sert que pour le **dev/test** (3 000/mois, 100/jour).
- Pro lève le plafond journalier ; 50 000/mois couvrent largement les 12 ludos
  (~7–10 k/mois estimés). 10 domaines (1 suffit).
- **Pas de dedicated IP** : contre-productif à faible volume (warmup requis, nuit à la
  délivrabilité). Le pool d'IP partagées Resend est meilleur pour ce profil.
- Le compteur « marketing contacts » de Resend ne s'applique pas : contacts en Neon,
  envoi via l'API `/emails` (pas Resend Audiences).
- Scale (90 $+) inutile tant qu'on reste < 100 k/mois.

---

## Phases (commitables une à une)

### Phase 0 — Logo ludothèque (prérequis branding)

- [x] `ludotheques.logoUrl` ajouté au schéma + `pnpm db:push`
- [x] Upload logo dans `[ludo]/settings/infos` (réutilise `put`/`del` de `@vercel/blob`,
      cf. `api/themes/[id]/images/+server.ts`) — preview + suppression
- [x] `updateLudoInfo` étendu (service `ludotheque.ts`)
- [x] Fallback en-tête email si pas de logo (nom + couleur uniquement)

### Phase 1 — Schéma + client Resend + env

- [x] Tables `newsletter_contacts`, `campaigns`, `campaign_sends` + enums dans `schema.ts`
- [x] `pnpm db:push`
- [x] `lib/server/resend.ts` (client, lecture clé via `$env/dynamic/private`)
- [x] `RESEND_API_KEY` + `NEWSLETTER_FROM` dans `.env.example` + CLAUDE.md
- [ ] Domaine `ludohub.ch` vérifié dans Resend (action Jonathan — DNS)

### Phase 2 — CRM contacts (sans import)

- [x] `db/newsletter.ts` : list/create/update/delete contacts (scoping ludoId)
- [x] `services/newsletter.ts` : validation email, génération `unsubscribeToken`, dédup
- [x] Route `[ludo]/newsletter/contacts` : `DataTable` (email, nom, statut, source)
- [x] Ajout manuel + édition + suppression (form actions + toasts)
- [x] Badge statut (`StatusBadge`) subscribed / unsubscribed / bounced
- [x] EmptyState quand 0 contact

### Phase 3 — Import CSV / Excel (le morceau délicat)

- [x] Parsing CSV natif + `.xlsx` via SheetJS (`xlsx`) côté serveur
- [x] Endpoint `api/newsletter/contacts/import` (upload → parse → renvoie preview)
- [x] UI : upload → **mapping colonnes** (email / prénom / nom) → preview (n lignes,
      n doublons, n invalides) → confirmation → insert
- [x] Dédup sur `(ludoId, lower(email))`, skip invalides, `source = 'import'`
- [x] Gestion encodage (UTF-8 / latin1) + séparateurs `,`/`;`
- [x] Compte-rendu post-import (X ajoutés, Y ignorés)

### Phase 4 — Template email + preview + test

- [x] `lib/server/email/template.ts` : `render(content, ludo)` → HTML inline-styles
      (tables, compatible clients mail), en-tête (logo + couleur), footer auto
      (nom, adresse, lien désabo)
- [x] Blocs supportés : titre, corps rich-text simple, image, bouton CTA, lien PDF
- [x] Preview live dans l'éditeur (iframe srcdoc)
- [x] Bouton « envoyer un test à moi-même » (saisie email)

### Phase 5 — Campagnes (brouillon)

- [x] Route `[ludo]/newsletter` : liste campagnes (statut, date, nb destinataires)
- [x] Route `[ludo]/newsletter/[id]` : éditeur (subject, previewText, blocs)
- [x] Upload image campagne → Blob ; upload PDF flyer → Blob (+ case « joindre en PJ »)
- [x] Sauvegarde brouillon (autosave ou bouton)

### Phase 6 — Envoi

- [x] `services/newsletter.ts` : `sendCampaign` — sélection des `subscribed`,
      envoi batch Resend (paquets de 100), écriture `campaign_sends`
- [x] Personnalisation simple : `{{first_name}}` (fallback si vide)
- [x] Exclusion automatique des `unsubscribed` / `bounced`
- [x] Confirmation avant envoi (nb destinataires) + statut `sent` + `sentAt`
- [x] Émission événement via `emitEvent` (activity_log + notif responsables) — cohérent
      avec le dispatcher existant
- [x] Garde-fou : pas de double envoi (campagne déjà `sent`)

### Phase 7 — Désabonnement & délivrabilité

- [x] Route publique `/unsubscribe?token=…` → page de confirmation → statut `unsubscribed`
- [x] Headers `List-Unsubscribe` + `List-Unsubscribe-Post` (one-click Gmail/Yahoo)
      pointant vers l'endpoint
- [x] Webhook Resend (bounces / plaintes) → statut `bounced` sur le contact
- [x] Lien désabo obligatoire dans le footer du template (déjà posé en phase 4, vérif)

---

## Pièges identifiés

- **HTML email = inline styles + tables.** Pas de flexbox/grid, pas de `<style>` externe
  fiable. Le template doit être conservateur (Outlook casse tout).
- **Images en pièce jointe inline** ne s'affichent pas proprement → toujours héberger sur
  Blob et référencer par URL absolue.
- **PDF en PJ** : alourdit l'email + risque spam. Défaut = bouton lien vers Blob ; PJ réelle
  seulement si case cochée (comms officielles).
- **Import CSV** : encodages (Excel FR exporte souvent en latin1 + `;`), colonnes mal nommées,
  emails dupliqués/invalides. Toujours passer par un écran de mapping + preview.
- **List-Unsubscribe obligatoire** depuis 2024 pour les envois en masse (Gmail/Yahoo) sinon
  délivrabilité dégradée. Non négociable.
- **Scoping multi-tenant** : tous les contacts/campagnes filtrés par `ludoId`. Jamais de
  fuite cross-ludo (la table est partagée, l'isolation est applicative).
- **Idempotence envoi** : un refresh ne doit pas relancer l'envoi. Verrou sur `status = 'sent'`.

## Flow E2E à reporter dans l'epic 12-TESTS

```
import CSV → contacts visibles → créer campagne → envoyer test → envoyer →
campagne 'sent' + sends enregistrés → désabo via lien → contact exclu du prochain envoi
```
