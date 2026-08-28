# HANDOFF — 2026-08-16

## Epic en cours
20 — SITE PUBLIC → docs/features/20-site-public.md

## État
- Fait cette session : migrations Neon `0000` à `0014` appliquées ; `public_site_settings` est présent.
- Fait cette session : lieux `paquis` et `secheron` créés ; Pâquis est actif et principal.
- Fait cette session : un responsable peut créer un lieu et saisir ses horaires dans LudoHub.
- Fait cette session : le site public est rendu dynamiquement sur Vercel et lit l'API LudoHub à chaque requête.
- Déploiements production : `ludohub.vercel.app` et `ludo-paquis-secheron.ch` sont à jour.
- Dernier commit : `5417607` fix: make top-three migration compatible with PostgreSQL regex limits.

## Prochaine étape (par quoi commencer)
Saisir et vérifier les horaires Pâquis et Sécheron dans LudoHub, puis contrôler `/paquis` et `/secheron` sur le site public : les changements doivent être immédiats.

## Pièges / contexte chaud
- Le site public ne doit plus utiliser les horaires de secours après le passage Astro SSR ; ils restent seulement un repli si l'API est indisponible.
- Un projet Vercel vide `website-v2-lot8` a été créé involontairement pendant une vérification ; il est inutilisé et attend une décision de suppression.
