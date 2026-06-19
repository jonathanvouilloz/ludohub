/**
 * Rendu HTML d'un email de campagne. Module ISOMORPHE (aucune dépendance serveur)
 * pour être réutilisé tel quel par :
 *  - l'aperçu live dans l'éditeur (client, `<iframe srcdoc>`),
 *  - l'envoi réel via Resend (serveur).
 *
 * Contraintes clients mail : styles inline + tables, pas de flexbox/grid, pas de
 * `<style>` externe fiable (Outlook). On reste volontairement conservateur.
 */

export interface EmailContent {
  title?: string | null
  body: string
  imageUrl?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  pdfUrl?: string | null
  pdfAsAttachment?: boolean
}

export interface EmailBrand {
  name: string
  color: string
  logoUrl?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
}

export interface RenderOptions {
  /** URL de désabonnement (token réel à l'envoi, `#` pour l'aperçu). */
  unsubscribeUrl: string
  previewText?: string | null
  /** Prénom du destinataire pour `{{first_name}}` (aperçu : vide → fallback). */
  recipientFirstName?: string | null
}

const FALLBACK_NAME = 'là'

/**
 * Stack système avec repli `Arial, sans-serif` : rendu moderne sur Apple Mail/Gmail,
 * et jamais de serif par défaut sous Outlook (qui retombe sur Arial). Les clients mail
 * n'héritent pas `font-family` de façon fiable → on l'applique sur chaque élément texte.
 */
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Helper : retire le protocole d'une URL pour un libellé de lien lisible. */
function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/** Helper : numéro de téléphone → valeur `tel:` (chiffres et `+` uniquement). */
function telHref(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Remplace `{{first_name}}` par le prénom (ou un fallback neutre). */
function personalize(text: string, firstName?: string | null): string {
  const name = (firstName ?? '').trim() || FALLBACK_NAME
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, name)
}

/** Corps texte → paragraphes HTML (séparés par lignes vides), avec `<br>` internes. */
function renderBody(body: string, firstName?: string | null): string {
  const personalized = personalize(body, firstName)
  const blocks = personalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (blocks.length === 0) return ''
  return blocks
    .map((block) => {
      const html = escapeHtml(block).replace(/\n/g, '<br />')
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:#333333;">${html}</p>`
    })
    .join('')
}

function isSafeUrl(url: string | null | undefined): url is string {
  if (!url) return false
  return /^https?:\/\//i.test(url.trim())
}

export function renderCampaignEmail(
  content: EmailContent,
  brand: EmailBrand,
  opts: RenderOptions,
): string {
  const color = /^#[0-9a-fA-F]{6}$/.test(brand.color) ? brand.color : '#0073e6'
  const name = escapeHtml(brand.name)
  const preheader = opts.previewText ? escapeHtml(opts.previewText) : ''

  // En-tête : logo si disponible, sinon bandeau coloré au nom de la ludo.
  const header = isSafeUrl(brand.logoUrl)
    ? `<tr><td style="padding:24px;text-align:center;background:#ffffff;border-bottom:1px solid #eeeeee;">
         <img src="${escapeHtml(brand.logoUrl)}" alt="${name}" style="max-height:56px;max-width:220px;height:auto;" />
       </td></tr>`
    : `<tr><td style="padding:20px 24px;background:${color};text-align:center;">
         <span style="font-family:${FONT};font-size:20px;font-weight:bold;color:#ffffff;">${name}</span>
       </td></tr>`

  const title = content.title
    ? `<tr><td style="padding:28px 24px 0;">
         <h1 style="margin:0;font-family:${FONT};font-size:24px;line-height:1.3;color:#1a1a1a;">${escapeHtml(
           personalize(content.title, opts.recipientFirstName),
         )}</h1>
       </td></tr>`
    : ''

  const image = isSafeUrl(content.imageUrl)
    ? `<tr><td style="padding:20px 24px 0;">
         <img src="${escapeHtml(content.imageUrl)}" alt="" style="width:100%;max-width:512px;height:auto;border-radius:8px;display:block;" />
       </td></tr>`
    : ''

  const bodyHtml = renderBody(content.body ?? '', opts.recipientFirstName)
  const body = bodyHtml ? `<tr><td style="padding:24px;">${bodyHtml}</td></tr>` : ''

  // Bouton CTA « bulletproof » (table) compatible Outlook.
  const cta =
    content.ctaLabel && isSafeUrl(content.ctaUrl)
      ? `<tr><td style="padding:0 24px 24px;">
           <table role="presentation" cellpadding="0" cellspacing="0" border="0">
             <tr><td style="border-radius:8px;background:${color};">
               <a href="${escapeHtml(content.ctaUrl)}" target="_blank"
                  style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
                 ${escapeHtml(content.ctaLabel)}
               </a>
             </td></tr>
           </table>
         </td></tr>`
      : ''

  // Lien PDF (le PDF lui-même peut aussi être joint en PJ selon le réglage campagne).
  const pdf = isSafeUrl(content.pdfUrl)
    ? `<tr><td style="padding:0 24px 24px;">
         <a href="${escapeHtml(content.pdfUrl)}" target="_blank"
            style="font-family:${FONT};font-size:15px;color:${color};text-decoration:underline;">📎 Télécharger le document (PDF)</a>
       </td></tr>`
    : ''

  // Footer 3 zones : infos ludo (gauche), contact (droite), site + désabo (centre bas).
  // Table email-safe (tds 50/50 + ligne pleine largeur), chaque info conditionnée.
  const fName = `<div style="margin:0 0 4px;font-family:${FONT};font-weight:bold;color:#666666;">${name}</div>`
  const fAddress = brand.address
    ? `<div style="font-family:${FONT};color:#888888;">${escapeHtml(brand.address)}</div>`
    : ''
  const fEmail = brand.email
    ? `<div style="font-family:${FONT};"><a href="mailto:${escapeHtml(
        brand.email,
      )}" style="color:#888888;text-decoration:none;">${escapeHtml(brand.email)}</a></div>`
    : ''
  const fPhone = brand.phone
    ? `<div style="font-family:${FONT};"><a href="tel:${escapeHtml(
        telHref(brand.phone),
      )}" style="color:#888888;text-decoration:none;">${escapeHtml(brand.phone)}</a></div>`
    : ''
  const fSite = brand.website
    ? `<a href="${escapeHtml(
        brand.website,
      )}" target="_blank" style="color:#888888;text-decoration:underline;">${escapeHtml(
        stripProtocol(brand.website),
      )}</a>&nbsp;&nbsp;·&nbsp;&nbsp;`
    : ''

  const footer = `<tr><td style="padding:24px;background:#fafafa;border-top:1px solid #eeeeee;font-family:${FONT};font-size:12px;line-height:1.6;color:#888888;">
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td valign="top" style="text-align:left;vertical-align:top;">${fName}${fAddress}</td>
           <td valign="top" style="text-align:right;vertical-align:top;">${fEmail}${fPhone}</td>
         </tr>
         <tr>
           <td colspan="2" style="text-align:center;padding-top:16px;">
             ${fSite}<a href="${escapeHtml(
               opts.unsubscribeUrl,
             )}" style="color:#888888;text-decoration:underline;">Se désabonner</a>
           </td>
         </tr>
       </table>
     </td></tr>`

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:${FONT};-webkit-text-size-adjust:100%;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eaeaea;">
      ${header}
      ${title}
      ${image}
      ${body}
      ${cta}
      ${pdf}
      ${footer}
    </table>
  </td></tr>
</table>
</body>
</html>`
}
