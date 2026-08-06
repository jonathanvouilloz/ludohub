# Extension Orphée — liaison et API LudoHub

## Contrat local du lot 9

- `POST /api/extension/v1/device-authorizations` crée une liaison de 10 minutes avec PKCE S256.
- L'approbation se fait uniquement par `POST /extensions/authorize`, avec la session web custom LudoHub d'un responsable actif. Better Auth n'est pas détourné.
- `POST /api/extension/v1/token` échange une seule fois le device code approuvé.
- Access token opaque : 15 minutes. Refresh token opaque rotatif : famille de 30 jours.
- Seuls les SHA-256 des tokens et le HMAC du user code sont persistés. Le rejeu d'un refresh déjà utilisé révoque toute la famille.
- Le reset du mot de passe partagé (`passwordVersion`), la désactivation du membre ou la perte du rôle responsable révoquent l'accès.
- Le client doit sérialiser la rotation du refresh token entre tous ses contextes (service worker unique ou Web Locks). Deux échanges simultanés du même token sont volontairement traités comme un rejeu et révoquent le poste.
- API adhésions : liste, détail, traitement et paiement sous `/api/extension/v1/family-memberships`. Le tenant et le membre viennent exclusivement du Bearer token ; les mutations réutilisent les CAS du lot 8.
- `/[ludo]/extensions` liste et révoque les postes actifs.

## Sécurité et exploitation

- CORS limité à `EXTENSION_API_ALLOWED_ORIGINS`, réponses `no-store`, corps JSON bornés à 8 Kio et création de device limitée par IP/process.
- Les audits ne contiennent ni token, ni code, ni donnée personnelle d'adhésion.
- La migration `0014_famous_talkback.sql` est additive et ne doit être appliquée qu'après revue, sur une branche Neon de test.
- Limite connue : le rate limit de création est local à l'instance serverless ; le polling est toutefois borné et cadencé atomiquement en base.
- Limite de validation locale : sans PostgreSQL/branche Neon isolée, les garanties de concurrence des CTE (double échange, rotation/rejeu) sont relues et testées par mocks, pas exercées contre Neon réel.
- Aucun secret ni identifiant réel d'extension n'est commité. Aucun flux Tally/Sheets/GAS n'est modifié par ce lot.
