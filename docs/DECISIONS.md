# Décisions techniques — LudoHub

Format : `Date | Décision | Contexte | Alternatives considérées`

---

## 2026-06-15 | Auth par mot de passe partagé par ludo (Better Auth)

**Contexte :** Les ludothèques ont un staff peu technique. Créer un compte individuel par membre crée de la friction et des mots de passe oubliés. Le modèle existant (`samediLudoV2`) utilisait localStorage — non sécurisé et non scalable.

**Décision :** Un mot de passe unique par ludo (haché bcrypt). L'utilisateur saisit le mot de passe commun, puis choisit son nom dans la liste des membres actifs. Session cookie httpOnly 30 jours.

**Alternatives :** Auth individuelle email/password (trop de friction), magic link (complexité infra email), SSO FASE (dépendance externe non garantie).

---

## 2026-06-15 | Multi-tenant par slug URL (pas de sous-domaine)

**Contexte :** 12 ludos connues, nombre limité. Les ludos sont créées manuellement par le super admin (Jonathan).

**Décision :** `ludohub.ch/[slug]` — route dynamique `[ludo]` dans SvelteKit. Plus simple à gérer côté Vercel qu'un sous-domaine dynamique. Slug non-modifiable après création.

**Alternatives :** Sous-domaines dynamiques (`paquis.ludohub.ch`) — complexité DNS/Vercel disproportionnée pour 12 entités.

---

## 2026-06-15 | Neon (Postgres serverless) + Drizzle ORM

**Contexte :** Vercel deployment, besoin d'un Postgres managé avec connection pooling intégré pour les serverless functions.

**Décision :** Neon + Drizzle. Neon gère le pooling, Drizzle donne un type-safety complet sur le schema. Pas de Prisma (overhead + cold starts).

**Alternatives :** PlanetScale (MySQL, pas de FK), Supabase (overkill, auth redondante avec Better Auth), Turso (SQLite, limites sur requêtes complexes cross-ludo).

---

## 2026-06-15 | Vercel Blob pour les photos de thèmes (max 3/thème)

**Contexte :** Les thèmes ont besoin de photos pour les présenter aux autres ludos. Besoin simple : upload, URL publique, suppression.

**Décision :** Vercel Blob — intégration native Vercel, pas de config S3 supplémentaire. Limite : 3 photos max par thème, 5MB chacune.

**Alternatives :** Cloudinary (CDN + transformations — overkill), S3 direct (config IAM complexe), uploadthing (dépendance supplémentaire).

---

## 2026-06-15 | Versions dépendances critiques

**Contexte :** Conflits de peers découverts lors du setup initial.

**Décision :** `drizzle-orm@^0.45`, `drizzle-kit@>=0.31`, `vitest@^3` (v4 installé). Better Auth v1.6 exige drizzle-orm 0.45+ ; vitest v2 est incompatible avec Vite 6 (types Plugin conflictuels).

**Alternatives :** Rester sur drizzle-orm 0.40 + better-auth 1.2 — écarté car versions trop en retard sur l'écosystème.
