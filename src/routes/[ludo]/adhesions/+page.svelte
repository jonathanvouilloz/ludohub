<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import RichTextEditor from '$lib/components/public-site/RichTextEditor.svelte'
  import * as Table from '$lib/components/ui/table/index.js'
  import PuzzleIcon from '@lucide/svelte/icons/puzzle'
  import SettingsIcon from '@lucide/svelte/icons/settings-2'
  import UsersIcon from '@lucide/svelte/icons/users'

  let { data, form } = $props()
  const config = $derived(data.management?.form)
  const documents = $derived(data.management?.documents ?? [])
  const regulation = $derived(documents.find((document) => document.kind === 'rules') ?? null)
  const annualFee = $derived(config ? (config.annualFeeCents / 100).toFixed(2) : '')
  const publicFormUrl = $derived(data.publicFormUrl)
  let linkCopied = $state(false)
  let regulationText = $state('')
  $effect(() => {
    regulationText = regulation?.content_markdown ?? ''
  })

  async function copyPublicFormUrl() {
    await navigator.clipboard.writeText(publicFormUrl)
    linkCopied = true
    window.setTimeout(() => (linkCopied = false), 2000)
  }

  function dateLabel(value: Date | string) {
    return new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium' }).format(new Date(value))
  }
  function statusLabel(status: string) {
    return status === 'new' ? 'À traiter' : 'Traitée'
  }
  function paymentLabel(method: string | null) {
    if (method === 'twint') return 'TWINT'
    if (method === 'cash') return 'Espèces'
    return 'À renseigner'
  }
</script>

<svelte:head><title>Adhésions familiales</title></svelte:head>

<main class="family-page">
  <header class="page-header">
    <div>
      <h1>Adhésions familiales</h1>
      <p>Configurez le formulaire, le règlement et le suivi des demandes.</p>
    </div>
  </header>

  {#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}

  <section class="panel extension-panel" aria-labelledby="extension-title">
    <div class="section-heading">
      <div class="heading-icon"><PuzzleIcon size={20} aria-hidden="true" /></div>
      <div>
        <h2 id="extension-title">Extension Orphée</h2>
        <p>À installer une fois sur le poste d’accueil Chrome, pour remplir Orphée et imprimer les quittances.</p>
      </div>
    </div>
    <p><Button href="/extensions/ludo-orphee-chrome.zip" download>Télécharger l’extension</Button></p>
    <ol class="install-steps">
      <li>Décompressez le fichier. Vous obtenez un dossier <code>ludo-orphee</code>.</li>
      <li>Ouvrez <code>chrome://extensions</code> dans Chrome.</li>
      <li>Activez le mode développeur.</li>
      <li>Choisissez « Charger l’extension non empaquetée », puis le dossier <code>ludo-orphee</code>.</li>
    </ol>
    <p class="hint">Pour une mise à jour, remplacez ce dossier par la nouvelle archive, puis cliquez sur Recharger dans chrome://extensions.</p>
  </section>

  {#if config}
    <section class="panel configuration" aria-labelledby="configuration-title">
      <div class="section-heading">
        <div class="heading-icon"><SettingsIcon size={20} aria-hidden="true" /></div>
        <div>
          <h2 id="configuration-title">Formulaire public</h2>
          <p>Les informations présentées aux familles avant leur demande d’adhésion.</p>
        </div>
      </div>

      <form method="POST" action="?/configuration" class="configuration-form">
        <input type="hidden" name="revision" value={config.revision} />
        <div class="field full">
          <Label for="family-title">Titre du formulaire</Label><Input
            id="family-title"
            name="title"
            value={config.title}
            maxlength={200}
            required
          />
        </div>
        <div class="field full">
          <Label for="family-intro">Texte d’introduction</Label><textarea
            id="family-intro"
            name="intro"
            rows="4"
            maxlength="5000"
            placeholder="Expliquez simplement comment rejoindre votre ludothèque."
            >{config.intro ?? ''}</textarea
          >
        </div>
        <div class="field full">
          <Label for="family-consent">Texte de la case à cocher</Label><textarea
            id="family-consent"
            name="consentLabel"
            rows="3"
            maxlength="1000"
            placeholder="J’ai lu et j’accepte le règlement de la ludothèque."
            >{config.consentLabel ?? ''}</textarea
          >
          <p class="hint">
            Ce texte apparaît à côté de la case que la personne responsable doit cocher.
          </p>
        </div>
        <div class="input-grid">
          <div class="field">
            <Label for="family-fee">Tarif annuel (CHF)</Label><Input
              id="family-fee"
              name="annualFeeChf"
              type="number"
              min="0"
              step="0.01"
              value={annualFee}
              required
            />
            <p class="hint">Par exemple, 30.00.</p>
          </div>
          <div class="field">
            <Label for="family-retention">Conservation des demandes (jours)</Label><Input
              id="family-retention"
              name="retentionDays"
              type="number"
              min="1"
              max="365"
              value={config.retentionDays}
              required
            />
            <p class="hint">Les données sont supprimées après ce délai.</p>
          </div>
        </div>
        <fieldset class="payment-methods">
          <legend>Moyens de paiement acceptés</legend><label class="check-option"
            ><input type="checkbox" name="allowsTwint" checked={config.allowsTwint} /><span
              ><strong>TWINT</strong><small>Paiement sur place par TWINT.</small></span
            ></label
          ><label class="check-option"
            ><input type="checkbox" name="allowsCash" checked={config.allowsCash} /><span
              ><strong>Espèces</strong><small>Paiement sur place en espèces.</small></span
            ></label
          >
        </fieldset>
        <label class="check-option enabled-option"
          ><input type="checkbox" name="enabled" checked={config.enabled} /><span
            ><strong>Accepter les demandes</strong><small
              >Le formulaire est visible sur le site public.</small
            ></span
          ></label
        >
        <footer class="form-actions">
          <Button type="submit">Enregistrer les réglages</Button>
        </footer>
      </form>
    </section>

    <section class="panel publication-panel" aria-labelledby="publication-title">
      <div>
        <h2 id="publication-title">Formulaire destiné aux familles</h2>
        <p>
          Ce lien est hébergé par LudoHub, indépendamment des sites publics de chaque ludothèque.
          Publiez une nouvelle version après avoir vérifié les réglages et le règlement.
        </p>
      </div>
      <div class="publication-actions">
        <input
          class="public-form-url"
          aria-label="Lien public du formulaire"
          value={publicFormUrl}
          readonly
        />
        <Button type="button" variant="outline" onclick={() => void copyPublicFormUrl()}
          >{linkCopied ? 'Lien copié' : 'Copier le lien'}</Button
        >
        <Button href={publicFormUrl} target="_blank" variant="outline">Voir le formulaire</Button>
        <form method="POST" action="?/publish">
          <input type="hidden" name="formId" value={config.id} /><input
            type="hidden"
            name="revision"
            value={config.revision}
          /><Button type="submit">Publier les modifications</Button>
        </form>
      </div>
    </section>

    <section class="panel regulation-panel" aria-labelledby="regulation-title">
      <div class="section-heading">
        <div class="heading-icon"><SettingsIcon size={20} aria-hidden="true" /></div>
        <div>
          <h2 id="regulation-title">Règlement de la ludothèque</h2>
          <p>
            Les familles pourront le lire dans une fenêtre avant de cocher leur consentement. Chaque
            enregistrement conserve une nouvelle version avec les demandes déjà reçues.
          </p>
        </div>
      </div>
      <form method="POST" action="?/rules" class="regulation-form">
        <div class="field">
          <Label for="family-regulation">Votre règlement</Label><RichTextEditor
            id="family-regulation"
            name="contentMarkdown"
            bind:value={regulationText}
            ariaLabel="Règlement de la ludothèque"
            placeholder="Écrivez ou collez le règlement de votre ludothèque."
          />
          <p class="hint">
            Vous pouvez mettre en forme les titres, les listes, le gras et les liens.
          </p>
        </div>
        <footer class="form-actions">
          <Button type="submit"
            >{regulation ? 'Enregistrer le règlement' : 'Créer le règlement'}</Button
          >
        </footer>
      </form>
    </section>
  {/if}

  <section class="submissions-section" aria-labelledby="submissions-title">
    <div class="section-intro">
      <div class="section-heading">
        <div class="heading-icon"><UsersIcon size={20} aria-hidden="true" /></div>
        <div>
          <h2 id="submissions-title">Demandes reçues</h2>
          <p>Sélectionnez une famille pour lire les informations transmises.</p>
        </div>
      </div>
      <Badge variant="secondary">{data.submissions.length}</Badge>
    </div>
    {#if data.submissions.length > 0}
      <DataTable>
        {#snippet head()}<Table.Row
            ><Table.Head>Reçue le</Table.Head><Table.Head>Responsable</Table.Head><Table.Head
              >Statut</Table.Head
            ><Table.Head>Paiement</Table.Head><Table.Head class="actions-head">Action</Table.Head
            ></Table.Row
          >{/snippet}
        {#snippet body()}{#each data.submissions as item (item.id)}<Table.Row
              class={data.selected?.id === item.id ? 'selected' : ''}
              ><Table.Cell>{dateLabel(item.createdAt)}</Table.Cell><Table.Cell
                ><a class="submission-link" href={`?id=${item.id}`}
                  >{item.firstName} {item.lastName}</a
                ></Table.Cell
              ><Table.Cell
                ><Badge variant={item.status === 'new' ? 'warning' : 'success'}
                  >{statusLabel(item.status)}</Badge
                ></Table.Cell
              ><Table.Cell>{paymentLabel(item.paymentMethod)}</Table.Cell><Table.Cell
                ><div class="submission-action">
                  {#if item.status === 'new'}<form method="POST" action="?/process">
                      <input type="hidden" name="id" value={item.id} /><input
                        type="hidden"
                        name="revision"
                        value={item.revision}
                      /><Button type="submit" size="sm">Marquer comme traitée</Button>
                    </form>{:else}<form method="POST" action="?/payment">
                      <input type="hidden" name="id" value={item.id} /><input
                        type="hidden"
                        name="revision"
                        value={item.revision}
                      /><select aria-label="Mode de paiement" name="method"
                        ><option value="">Non payé</option><option
                          value="twint"
                          selected={item.paymentMethod === 'twint'}>TWINT</option
                        ><option value="cash" selected={item.paymentMethod === 'cash'}
                          >Espèces</option
                        ></select
                      ><Button type="submit" size="sm" variant="outline">Enregistrer</Button>
                    </form>{/if}
                </div></Table.Cell
              ></Table.Row
            >{/each}{/snippet}
        {#snippet cards()}{#each data.submissions as item (item.id)}<DataCard
              title={`${item.firstName} ${item.lastName}`}
              href={`?id=${item.id}`}
              >{#snippet notes()}{dateLabel(item.createdAt)}{/snippet}{#snippet byline()}<Badge
                  variant={item.status === 'new' ? 'warning' : 'success'}
                  >{statusLabel(item.status)}</Badge
                > · {paymentLabel(
                  item.paymentMethod,
                )}{/snippet}{#snippet actions()}{#if item.status === 'new'}<form
                    method="POST"
                    action="?/process"
                  >
                    <input type="hidden" name="id" value={item.id} /><input
                      type="hidden"
                      name="revision"
                      value={item.revision}
                    /><Button type="submit" size="sm">Traiter</Button>
                  </form>{:else}<form method="POST" action="?/payment">
                    <input type="hidden" name="id" value={item.id} /><input
                      type="hidden"
                      name="revision"
                      value={item.revision}
                    /><input
                      type="hidden"
                      name="method"
                      value={item.paymentMethod ? '' : 'twint'}
                    /><Button type="submit" size="sm" variant="outline"
                      >{item.paymentMethod ? 'Annuler le paiement' : 'Noter TWINT'}</Button
                    >
                  </form>{/if}{/snippet}</DataCard
            >{/each}{/snippet}
      </DataTable>
    {:else}<p class="empty-note">Aucune demande reçue pour le moment.</p>{/if}
  </section>

  {#if data.selected}
    <section class="selected-submission panel" aria-labelledby="selected-title">
      <div class="section-intro">
        <div>
          <h2 id="selected-title">Demande de {data.selected.firstName} {data.selected.lastName}</h2>
          <p>Informations transmises lors de la demande.</p>
        </div>
        <Badge variant={data.selected.status === 'new' ? 'warning' : 'success'}
          >{statusLabel(data.selected.status)}</Badge
        >
      </div>
      <dl>
        <div>
          <dt>Contact</dt>
          <dd>{data.selected.email}<br />{data.selected.phone}</dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>{data.selected.address}<br />{data.selected.postalCode} {data.selected.city}</dd>
        </div>
        <div>
          <dt>Consentement</dt>
          <dd>{data.selected.consentFullName}<br />{dateLabel(data.selected.consentAcceptedOn)}</dd>
        </div>
      </dl>
      <div class="member-list">
        <h3>Membres de la famille</h3>
        <ul>
          {#each data.selected.members as member}<li>
              {member.firstName}
              {member.lastName}{member.birthDate ? ` · ${member.birthDate}` : ''}
            </li>{/each}
        </ul>
      </div>
    </section>
  {/if}
</main>

<style>
  .family-page {
    display: grid;
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-12);
    gap: var(--space-8);
  }
  .page-header h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  .page-header h1 {
    color: var(--text-main);
    font-size: var(--text-display);
    line-height: var(--leading-tight);
  }
  .page-header p,
  .section-heading p,
  .section-intro p,
  .publication-panel p,
  .hint {
    color: var(--text-muted);
    line-height: var(--leading-base);
  }
  .page-header p {
    max-width: 44rem;
    margin-top: var(--space-2);
  }
  .panel,
  .submissions-section {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  .form-error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  .section-heading {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }
  .section-heading h2,
  .section-intro h2,
  .publication-panel h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    line-height: var(--leading-tight);
  }
  .section-heading p {
    margin-top: var(--space-1);
  }
  .install-steps {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding-left: 1.25rem;
    color: var(--text-main);
    line-height: var(--leading-base);
  }
  .install-steps code {
    font-size: 0.92em;
  }
  .heading-icon {
    display: grid;
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--primary-light);
    color: var(--primary-dark);
  }
  .configuration-form,
  .regulation-form {
    display: grid;
    gap: var(--space-4);
  }
  .field {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .full {
    grid-column: 1 / -1;
  }
  textarea,
  select {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    line-height: var(--leading-base);
  }
  textarea {
    resize: vertical;
  }
  textarea:focus-visible,
  select:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .input-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
  .input-grid > .field {
    align-self: start;
  }
  .hint {
    font-size: var(--text-small);
  }
  .payment-methods {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    border: 0;
  }
  .payment-methods legend {
    grid-column: 1 / -1;
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  .check-option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-height: 48px;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .check-option:focus-within {
    box-shadow: var(--shadow-focus);
  }
  .check-option span {
    display: grid;
    gap: var(--space-1);
  }
  .check-option strong {
    color: var(--text-main);
    font-size: var(--text-body);
  }
  .check-option small {
    color: var(--text-muted);
    font-size: var(--text-small);
    line-height: var(--leading-base);
  }
  .enabled-option {
    width: fit-content;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-1);
  }
  .publication-panel,
  .section-intro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-5);
  }
  .publication-panel p {
    margin-top: var(--space-1);
  }
  .publication-actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .public-form-url {
    width: min(100%, 28rem);
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-hover);
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-small);
  }
  .submissions-section {
    gap: var(--space-4);
  }
  :global(.actions-head) {
    text-align: right;
  }
  .submission-link {
    color: var(--primary-dark);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  .submission-link:hover {
    text-decoration: underline;
  }
  .submission-action,
  .submission-action form {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
  }
  .submission-action select {
    width: auto;
    min-height: 32px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-small);
  }
  :global(.selected > td) {
    background: var(--primary-light);
  }
  .selected-submission {
    gap: var(--space-5);
  }
  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0;
  }
  dl div,
  .member-list {
    display: grid;
    gap: var(--space-1);
  }
  dt {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  dd {
    margin: 0;
    color: var(--text-main);
    line-height: var(--leading-base);
  }
  .member-list {
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }
  .member-list h3 {
    color: var(--text-main);
    font-size: var(--text-h3);
  }
  .member-list ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .member-list li {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--bg-hover);
    color: var(--text-main);
    font-size: var(--text-small);
  }
  @media (max-width: 760px) {
    .family-page {
      padding: var(--space-4) var(--space-4) var(--space-10);
      gap: var(--space-6);
    }
    .panel,
    .submissions-section {
      padding: var(--space-4);
    }
    .input-grid,
    .payment-methods,
    dl {
      grid-template-columns: 1fr;
    }
    .publication-panel,
    .section-intro {
      align-items: stretch;
      flex-direction: column;
    }
    .publication-actions {
      display: grid;
      grid-template-columns: 1fr;
    }
    .publication-actions :global(a),
    .publication-actions :global(button),
    .form-actions :global(button) {
      width: 100%;
    }
    .enabled-option {
      width: auto;
    }
    .submission-action,
    .submission-action form {
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
</style>
