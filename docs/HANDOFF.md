# HANDOFF — 2026-09-23

## Epic en cours

20 — SITE PUBLIC → docs/features/20-site-public.md

## État

- Fait cette session : formulaire d’adhésion familial refondu (UI, étapes, champs et membres).
- Fait cette session : un unique règlement enrichi est éditable dans Hub ; il s’ouvre en modal sur le formulaire.
- Fait cette session : 500 public corrigé et déployé (`d36c157`), mais Pâquis-Sécheron reste non publié faute de règlement et de consentement configurés.
- Vérifié : `pnpm check`, 628 tests et build passent.
- Dernier commit : `d36c157 fix: serve published family membership forms`.

## Prochaine étape (par quoi commencer)

Commiter et pousser les trois fichiers du formulaire + les documents de session. Puis configurer l’extension avec `https://ludohub.vercel.app`, son origine autorisée et valider le flux complet sur une inscription de test.

## Pièges / contexte chaud

- Changements locaux non commités : `src/routes/[ludo]/adhesions/+page.server.ts`, `+page.svelte`, `src/routes/formulaires/[ludo]/adhesion/+page.svelte` et docs.
- Ne pas inventer le règlement : le responsable doit fournir/saisir son contenu et le texte de consentement avant publication.
