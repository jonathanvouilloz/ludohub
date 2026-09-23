<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import BookOpenIcon from '@lucide/svelte/icons/book-open'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'

  let { data } = $props()
  let sending = $state(false)
  let message = $state('')
  let idempotencyKey = $state('')
  const MAX_TECHNICAL_MEMBERS = 50
  const documents = $derived(data.config.documents)
  const SWISS_PHONE = /^(?:\+41|0041|0)[1-9]\d{8}$/
  const EMAIL =
    /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+$/i
  const consentDateLabel = $derived(formatIsoDate(data.today))

  function formatIsoDate(iso: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
    if (!match) return iso
    return new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))),
    )
  }
  function swissPhone(value: string) {
    return SWISS_PHONE.test(value.replace(/[\s.-]/g, ''))
  }
  let members = $state<Array<{ firstName: string; lastName: string }>>([])

  function changed() {
    idempotencyKey = ''
  }
  function addMember() {
    if (members.length < MAX_TECHNICAL_MEMBERS) {
      members.push({ firstName: '', lastName: '' })
      changed()
    }
  }
  function removeMember(index: number) {
    members.splice(index, 1)
    changed()
  }
  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }
  function inline(value: string) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  }
  function regulationHtml(markdown: string) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
    const blocks: string[] = []
    let index = 0
    const unordered = (line: string) => /^\s*[-*+]\s+/.test(line)
    const ordered = (line: string) => /^\s*\d+\.\s+/.test(line)
    while (index < lines.length) {
      const line = lines[index]
      if (!line.trim()) {
        index += 1
        continue
      }
      const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
      if (heading) {
        const level = Math.min(4, Math.max(2, heading[1].length))
        blocks.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`)
        index += 1
        continue
      }
      if (unordered(line) || ordered(line)) {
        const isOrdered = ordered(line)
        const items: string[] = []
        while (
          index < lines.length &&
          (isOrdered ? ordered(lines[index]) : unordered(lines[index]))
        ) {
          items.push(
            `<li>${inline(lines[index].replace(isOrdered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/, '').trim())}</li>`,
          )
          index += 1
        }
        blocks.push(`<${isOrdered ? 'ol' : 'ul'}>${items.join('')}</${isOrdered ? 'ol' : 'ul'}>`)
        continue
      }
      const paragraph: string[] = []
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^\s*#{1,6}\s+/.test(lines[index]) &&
        !unordered(lines[index]) &&
        !ordered(lines[index])
      ) {
        paragraph.push(lines[index].trim())
        index += 1
      }
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
    }
    return blocks.join('')
  }
  async function submit(event: SubmitEvent) {
    message = ''
    const form = event.currentTarget as HTMLFormElement
    const raw = Object.fromEntries(new FormData(form))
    const phone = String(raw.phone ?? '')
    const secondaryPhone = String(raw.secondaryPhone ?? '').trim()
    const email = String(raw.email ?? '').trim()
    if (!swissPhone(phone)) {
      message = 'Le téléphone doit être un numéro suisse, par exemple 079 000 00 00.'
      return
    }
    if (secondaryPhone && !swissPhone(secondaryPhone)) {
      message = 'Le second téléphone doit être un numéro suisse, par exemple 022 000 00 00.'
      return
    }
    if (!EMAIL.test(email)) {
      message = 'L’e-mail doit être une adresse complète, par exemple prenom@exemple.ch.'
      return
    }
    sending = true
    const body = { ...raw, consentAccepted: raw.consentAccepted === 'on', members }
    idempotencyKey ||= crypto.randomUUID() + crypto.randomUUID()
    try {
      const response = await fetch(
        `/api/forms/v1/${encodeURIComponent(data.ludoSlug)}/family-membership/submissions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
          body: JSON.stringify(body),
        },
      )
      message = response.ok
        ? 'Votre demande a bien été reçue. La ludothèque vous recontactera prochainement.'
        : 'La demande n’a pas pu être envoyée. Vérifiez les champs puis réessayez.'
    } catch {
      message = 'La demande n’a pas pu être envoyée. Réessayez.'
    } finally {
      sending = false
    }
  }
</script>

<svelte:head
  ><title>{data.config.title}</title><meta name="robots" content="noindex,nofollow" /></svelte:head
>

<main class="membership-page">
  <header class="page-intro">
    <p class="eyebrow">Demande d’adhésion</p>
    <h1>{data.config.title}</h1>
    {#if data.config.intro}<p class="intro-copy">{data.config.intro}</p>{/if}
    <div class="fee-note">
      <span>Cotisation annuelle</span>
      <strong>{(data.config.annualFeeCents / 100).toFixed(2)} {data.config.currency}</strong>
      <small>Paiement sur place par {data.config.paymentMethods.join(' ou ')}.</small>
    </div>
  </header>

  <form
    class="membership-form"
    oninput={changed}
    onsubmit={(event) => {
      event.preventDefault()
      void submit(event)
    }}
  >
    <input name="website" class="honeypot" tabindex="-1" autocomplete="off" />

    <section class="form-section" aria-labelledby="responsible-title">
      <div class="section-heading">
        <span>1</span>
        <div>
          <h2 id="responsible-title">Personne responsable</h2>
          <p>Les coordonnées de la personne qui effectue la demande.</p>
        </div>
      </div>
      <div class="fields-grid">
        <label class="field full"
          ><span>Genre</span><select required name="gender"
            ><option value="" disabled selected>Choisir</option><option value="female"
              >Féminin</option
            ><option value="male">Masculin</option><option value="other">Neutre</option></select
          ></label
        >
        <label class="field"
          ><span>Prénom</span><input required name="firstName" autocomplete="given-name" /></label
        >
        <label class="field"
          ><span>Nom</span><input required name="lastName" autocomplete="family-name" /></label
        >
        <label class="field full"
          ><span>Adresse</span><input
            required
            name="address"
            autocomplete="street-address"
          /></label
        >
        <label class="field"
          ><span>NPA</span><input
            required
            name="postalCode"
            autocomplete="postal-code"
            inputmode="numeric"
          /></label
        >
        <label class="field"
          ><span>Ville</span><input required name="city" autocomplete="address-level2" /></label
        >
        <label class="field"
          ><span>Téléphone</span><input
            required
            name="phone"
            autocomplete="tel"
            inputmode="tel"
            placeholder="079 000 00 00"
          /><small>Numéro suisse, par exemple 079 000 00 00.</small></label
        >
        <label class="field"
          ><span>Autre téléphone <em>facultatif</em></span><input
            name="secondaryPhone"
            autocomplete="tel"
            inputmode="tel"
            placeholder="022 000 00 00"
          /><small>Même format, si vous en avez un deuxième.</small></label
        >
        <label class="field full"
          ><span>E-mail</span><input
            required
            name="email"
            type="email"
            autocomplete="email"
            placeholder="prenom@exemple.ch"
          /><small>Adresse complète, par exemple prenom@exemple.ch.</small></label
        >
      </div>
    </section>

    <section class="form-section" aria-labelledby="members-title">
      <div class="section-heading">
        <span>2</span>
        <div>
          <h2 id="members-title">Autres membres</h2>
          <p>La personne responsable est déjà incluse. Ajoutez un enfant ou un autre parent seulement si besoin.</p>
        </div>
      </div>
      <div class="member-list">
        {#if members.length === 0}<p class="member-empty">Aucun autre membre.</p>{/if}
        {#each members as member, index}
          <div class="member-row">
            <p>Membre {index + 1}</p>
            <label class="field"
              ><span>Prénom</span><input required bind:value={member.firstName} /></label
            >
            <label class="field"
              ><span>Nom</span><input required bind:value={member.lastName} /></label
            >
            <button
              class="remove-member"
              type="button"
              onclick={() => removeMember(index)}
              aria-label={`Retirer le membre ${index + 1}`}
              ><Trash2Icon size={17} aria-hidden="true" />Retirer</button
            >
          </div>
        {/each}
      </div>
      <button class="add-member" type="button" onclick={addMember}
        ><PlusIcon size={17} aria-hidden="true" />Ajouter un membre</button
      >
    </section>

    <section class="form-section" aria-labelledby="confirmation-title">
      <div class="section-heading">
        <span>3</span>
        <div>
          <h2 id="confirmation-title">Validation</h2>
          <p>Relisez le règlement avant d’envoyer la demande.</p>
        </div>
      </div>
      <div class="validation-fields">
        {#if data.config.sites.length > 1}<label class="field"
            ><span>Lieu de la ludothèque</span><select required name="siteId"
              ><option value="">Choisir un lieu</option>{#each data.config.sites as site}<option
                  value={site.id}>{site.name}</option
                >{/each}</select
            ></label
          >{/if}
        {#each documents as document (document.slug)}
          <Dialog.Root>
            <Dialog.Trigger class="rules-link"
              ><BookOpenIcon size={18} aria-hidden="true" />{document.title}</Dialog.Trigger
            >
            <Dialog.Content class="rules-dialog">
              <Dialog.Header
                ><Dialog.Title>{document.title}</Dialog.Title><Dialog.Description
                  >À lire avant de valider votre demande.</Dialog.Description
                ></Dialog.Header
              >
              <article class="regulation-content">
                {@html regulationHtml(document.contentMarkdown)}
              </article>
              <Dialog.Footer><Dialog.Close class="dialog-close">Fermer</Dialog.Close></Dialog.Footer
              >
            </Dialog.Content>
          </Dialog.Root>
        {/each}
        <label class="consent"
          ><input required type="checkbox" name="consentAccepted" /><span
            >{data.config.consentLabel}</span
          ></label
        >
        <div class="signature-grid">
          <label class="field"
            ><span>Signature</span><input
              required
              name="consentFullName"
              placeholder="Nom complet"
            /></label
          >
          <div class="field">
            <span>Date</span>
            <p class="fixed-date">{consentDateLabel}</p>
            <input type="hidden" name="consentAcceptedOn" value={data.today} />
          </div>
        </div>
      </div>
    </section>

    <footer class="form-footer">
      <button class="submit-button" disabled={sending} type="submit"
        >{sending ? 'Envoi en cours…' : 'Envoyer la demande'}</button
      >
    </footer>
  </form>

  {#if message}<p
      class:success={message.startsWith('Votre')}
      class="form-message"
      aria-live="polite"
    >
      {message}
    </p>{/if}
</main>

<style>
  .membership-page {
    width: min(100% - 32px, 48rem);
    margin: 0 auto;
    padding: var(--space-12) 0 var(--space-16);
  }
  .page-intro {
    display: grid;
    gap: var(--space-3);
    margin-bottom: var(--space-8);
  }
  .eyebrow {
    margin: 0;
    color: var(--primary-dark);
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .page-intro h1 {
    color: var(--text-main);
    font-size: clamp(2rem, 5vw, 2.7rem);
    letter-spacing: -0.03em;
  }
  .intro-copy {
    max-width: 42rem;
    color: var(--text-muted);
    font-size: 1.05rem;
  }
  .fee-note {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--primary-light);
    border-radius: var(--radius-md);
    background: var(--primary-light);
    color: var(--primary-dark);
  }
  .fee-note span {
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  .fee-note strong {
    font-size: var(--text-h2);
  }
  .fee-note small {
    color: var(--text-main);
  }
  .membership-form {
    display: grid;
    gap: var(--space-5);
  }
  .form-section {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  .section-heading {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
  }
  .section-heading > span {
    display: grid;
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 50%;
    background: var(--primary);
    color: var(--text-inverse);
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
  }
  .section-heading h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
  }
  .section-heading p {
    margin-top: 2px;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .fields-grid,
  .signature-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }
  .full {
    grid-column: 1 / -1;
  }
  .field {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .field > span {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  .field em,
  .field small {
    color: var(--text-muted);
    font-style: normal;
    font-weight: var(--weight-normal);
    font-size: var(--text-small);
  }
  input:not(.honeypot):not([type='checkbox']):not([type='hidden']),
  select {
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    transition:
      border-color var(--dur-fast),
      box-shadow var(--dur-fast);
  }
  input:not(.honeypot):focus,
  select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: var(--shadow-focus);
  }
  .honeypot {
    position: absolute;
    left: -10000px;
  }
  .member-list {
    display: grid;
    gap: var(--space-3);
  }
  .member-empty {
    margin: 0;
    color: var(--text-muted);
  }
  .member-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: end;
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-hover);
  }
  .member-row > p {
    grid-column: 1 / -1;
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  .remove-member,
  .add-member,
  :global(.rules-link) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 40px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--primary-dark);
    font: inherit;
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
  .remove-member {
    padding: 0 var(--space-2);
    color: var(--danger);
  }
  .add-member {
    justify-self: start;
    padding: 0 var(--space-2);
  }
  .add-member:hover,
  :global(.rules-link):hover {
    background: var(--primary-light);
  }
  .remove-member:hover {
    background: var(--danger-light);
  }
  .validation-fields {
    display: grid;
    gap: var(--space-4);
  }
  :global(.rules-link) {
    justify-self: start;
    min-height: auto;
    padding: var(--space-2) 0;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .consent {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-hover);
    color: var(--text-main);
    cursor: pointer;
  }
  .consent input {
    width: 18px;
    height: 18px;
    min-height: 18px;
    margin-top: 2px;
    padding: 0;
    flex: 0 0 18px;
    accent-color: var(--primary);
  }
  .consent span {
    line-height: var(--leading-base);
  }
  .fixed-date {
    display: flex;
    align-items: center;
    min-height: 44px;
    margin: 0;
    color: var(--text-main);
  }
  .form-footer {
    display: flex;
    justify-content: flex-end;
  }
  .submit-button {
    min-height: 46px;
    padding: 0 var(--space-5);
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--primary);
    color: var(--text-inverse);
    font: inherit;
    font-weight: var(--weight-semibold);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .submit-button:hover:not(:disabled) {
    background: var(--primary-dark);
  }
  .submit-button:focus-visible,
  .add-member:focus-visible,
  .remove-member:focus-visible,
  :global(.rules-link):focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .submit-button:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  .form-message {
    margin: var(--space-5) 0 0;
    padding: var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  .form-message.success {
    background: var(--success-light);
    color: var(--success);
  }
  :global(.rules-dialog) {
    max-width: min(42rem, calc(100% - 2rem));
    padding: var(--space-6);
  }
  .regulation-content {
    color: var(--text-main);
    line-height: 1.65;
  }
  .regulation-content :global(h2),
  .regulation-content :global(h3),
  .regulation-content :global(h4) {
    margin: var(--space-5) 0 var(--space-2);
    color: var(--text-main);
  }
  .regulation-content :global(h2) {
    font-size: var(--text-h2);
  }
  .regulation-content :global(h3) {
    font-size: var(--text-h3);
  }
  .regulation-content :global(p) {
    margin: 0 0 var(--space-3);
  }
  .regulation-content :global(ul),
  .regulation-content :global(ol) {
    margin: 0 0 var(--space-3);
    padding-left: var(--space-6);
  }
  :global(.dialog-close) {
    min-height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    cursor: pointer;
  }
  @media (max-width: 600px) {
    .membership-page {
      width: min(100% - 24px, 48rem);
      padding: var(--space-6) 0 var(--space-10);
    }
    .form-section {
      padding: var(--space-4);
    }
    .fields-grid,
    .signature-grid {
      grid-template-columns: 1fr;
    }
    .member-row {
      grid-template-columns: 1fr;
    }
    .member-row > p {
      grid-column: auto;
    }
    .remove-member {
      justify-self: start;
      padding-left: 0;
    }
    .form-footer,
    .submit-button {
      width: 100%;
    }
    .fee-note {
      display: grid;
      gap: 2px;
    }
    .fee-note strong {
      order: 1;
    }
    .fee-note small {
      order: 2;
    }
  }
</style>
