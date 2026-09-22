<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { DataCard } from '$lib/components/ui/data-card/index.js'
  import { DataTable } from '$lib/components/ui/data-table/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import * as Table from '$lib/components/ui/table/index.js'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import SettingsIcon from '@lucide/svelte/icons/settings-2'
  import UsersIcon from '@lucide/svelte/icons/users'

  let { data, form } = $props()
  const config = $derived(data.management?.form)
  const documents = $derived(data.management?.documents ?? [])
  const annualFee = $derived(config ? (config.annualFeeCents / 100).toFixed(2) : '')
  const publicFormHref = $derived(`/formulaires/${data.ludo.slug}/adhesion`)

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
      <p>Configurez le formulaire, les documents à accepter et le suivi des demandes.</p>
    </div>
  </header>

  {#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}

  {#if config}
    <section class="panel configuration" aria-labelledby="configuration-title">
      <div class="section-heading">
        <div class="heading-icon"><SettingsIcon size={20} aria-hidden="true" /></div>
        <div><h2 id="configuration-title">Formulaire public</h2><p>Les informations présentées aux familles avant leur demande d’adhésion.</p></div>
      </div>

      <form method="POST" action="?/configuration" class="configuration-form">
        <input type="hidden" name="revision" value={config.revision} />
        <div class="field full"><Label for="family-title">Titre du formulaire</Label><Input id="family-title" name="title" value={config.title} maxlength={200} required /></div>
        <div class="field full"><Label for="family-intro">Texte d’introduction</Label><textarea id="family-intro" name="intro" rows="4" maxlength="5000" placeholder="Expliquez simplement comment rejoindre votre ludothèque.">{config.intro ?? ''}</textarea></div>
        <div class="field full"><Label for="family-consent">Texte de consentement</Label><textarea id="family-consent" name="consentLabel" rows="3" maxlength="1000" placeholder="Texte que la personne responsable doit accepter.">{config.consentLabel ?? ''}</textarea></div>
        <div class="input-grid">
          <div class="field"><Label for="family-fee">Tarif annuel (CHF)</Label><Input id="family-fee" name="annualFeeChf" type="number" min="0" step="0.01" value={annualFee} required /><p class="hint">Par exemple, 30.00.</p></div>
          <div class="field"><Label for="family-retention">Conservation des demandes (jours)</Label><Input id="family-retention" name="retentionDays" type="number" min="1" max="365" value={config.retentionDays} required /><p class="hint">Les données sont supprimées après ce délai.</p></div>
        </div>
        <fieldset class="payment-methods"><legend>Moyens de paiement acceptés</legend><label class="check-option"><input type="checkbox" name="allowsTwint" checked={config.allowsTwint} /><span><strong>TWINT</strong><small>Paiement sur place par TWINT.</small></span></label><label class="check-option"><input type="checkbox" name="allowsCash" checked={config.allowsCash} /><span><strong>Espèces</strong><small>Paiement sur place en espèces.</small></span></label></fieldset>
        <label class="check-option enabled-option"><input type="checkbox" name="enabled" checked={config.enabled} /><span><strong>Accepter les demandes</strong><small>Le formulaire est visible sur le site public.</small></span></label>
        <footer class="form-actions"><Button type="submit">Enregistrer les réglages</Button></footer>
      </form>
    </section>

    <section class="panel publication-panel" aria-labelledby="publication-title">
      <div><h2 id="publication-title">Formulaire destiné aux familles</h2><p>Publiez une nouvelle version après avoir vérifié les réglages et les documents. Vous pouvez ensuite l’ouvrir exactement comme les familles le verront.</p></div>
      <div class="publication-actions">
        <Button href={publicFormHref} target="_blank" variant="outline">Voir le formulaire public</Button>
        <form method="POST" action="?/publish"><input type="hidden" name="formId" value={config.id} /><input type="hidden" name="revision" value={config.revision} /><Button type="submit">Publier les modifications</Button></form>
      </div>
    </section>

    <section class="documents-section" aria-labelledby="documents-title">
      <div class="section-intro"><div><h2 id="documents-title">Documents pour les familles</h2><p>Ajoutez par exemple le règlement ou les conditions de confidentialité. Cochez « Acceptation obligatoire » lorsqu’une famille doit valider ce document pour envoyer sa demande. Chaque modification crée une version conservée avec les demandes déjà reçues.</p></div><Badge variant="secondary">{documents.length} document{documents.length > 1 ? 's' : ''}</Badge></div>
      <div class="document-list">
        {#each documents as document (document.id)}
          <details class="document-card">
            <summary><span class="heading-icon"><FileTextIcon size={19} aria-hidden="true" /></span><span><strong>{document.title}</strong><small>{document.requiredAcceptance ? 'Acceptation obligatoire' : 'Lecture facultative'}</small></span><span class="document-kind">{document.kind === 'rules' ? 'Règlement' : document.kind === 'contract' ? 'Contrat' : document.kind === 'privacy' ? 'Confidentialité' : 'Autre'}</span></summary>
            <form method="POST" action="?/document" class="document-form">
              <input type="hidden" name="id" value={document.id} /><input type="hidden" name="revision" value={document.revision} />
              <div class="document-grid"><div class="field"><Label for={`document-title-${document.id}`}>Titre</Label><Input id={`document-title-${document.id}`} required name="title" value={document.title} /></div><div class="field"><Label for={`document-kind-${document.id}`}>Type</Label><select id={`document-kind-${document.id}`} name="kind" value={document.kind}><option value="rules">Règlement</option><option value="contract">Contrat</option><option value="privacy">Confidentialité</option><option value="other">Autre</option></select></div><div class="field order-field"><Label for={`document-order-${document.id}`}>Ordre d’affichage</Label><Input id={`document-order-${document.id}`} type="number" min="0" name="sortOrder" value={document.sort_order} /></div></div>
              <label class="simple-check"><input type="checkbox" name="requiredAcceptance" checked={document.requiredAcceptance} /> Acceptation obligatoire</label>
              <div class="field"><Label for={`document-content-${document.id}`}>Contenu du document</Label><textarea id={`document-content-${document.id}`} required name="contentMarkdown" rows="12">{document.content_markdown ?? ''}</textarea></div>
              <footer class="form-actions"><Button type="submit" variant="outline">Créer une nouvelle version</Button></footer>
            </form>
          </details>
        {:else}<p class="empty-note">Aucun document pour le moment. Ajoutez au moins le règlement avant de publier.</p>{/each}
      </div>
      <details class="add-document">
        <summary>Ajouter un document</summary>
        <form method="POST" action="?/document" class="document-form">
          <div class="document-grid"><div class="field"><Label for="new-document-slug">Identifiant</Label><Input id="new-document-slug" required name="slug" placeholder="reglement" /></div><div class="field"><Label for="new-document-title">Titre</Label><Input id="new-document-title" required name="title" placeholder="Règlement de la ludothèque" /></div><div class="field"><Label for="new-document-kind">Type</Label><select id="new-document-kind" name="kind"><option value="rules">Règlement</option><option value="contract">Contrat</option><option value="privacy">Confidentialité</option><option value="other">Autre</option></select></div><div class="field order-field"><Label for="new-document-order">Ordre d’affichage</Label><Input id="new-document-order" type="number" min="0" name="sortOrder" value="0" /></div></div>
          <label class="simple-check"><input type="checkbox" name="requiredAcceptance" checked /> Acceptation obligatoire</label>
          <div class="field"><Label for="new-document-content">Contenu du document</Label><textarea id="new-document-content" required name="contentMarkdown" rows="12" placeholder="Saisissez le texte validé par la ludothèque."></textarea></div>
          <footer class="form-actions"><Button type="submit">Ajouter le document</Button></footer>
        </form>
      </details>
    </section>
  {/if}

  <section class="submissions-section" aria-labelledby="submissions-title">
    <div class="section-intro"><div class="section-heading"><div class="heading-icon"><UsersIcon size={20} aria-hidden="true" /></div><div><h2 id="submissions-title">Demandes reçues</h2><p>Sélectionnez une famille pour lire les informations transmises.</p></div></div><Badge variant="secondary">{data.submissions.length}</Badge></div>
    {#if data.submissions.length > 0}
      <DataTable>
        {#snippet head()}<Table.Row><Table.Head>Reçue le</Table.Head><Table.Head>Responsable</Table.Head><Table.Head>Statut</Table.Head><Table.Head>Paiement</Table.Head><Table.Head class="actions-head">Action</Table.Head></Table.Row>{/snippet}
        {#snippet body()}{#each data.submissions as item (item.id)}<Table.Row class={data.selected?.id === item.id ? 'selected' : ''}><Table.Cell>{dateLabel(item.createdAt)}</Table.Cell><Table.Cell><a class="submission-link" href={`?id=${item.id}`}>{item.firstName} {item.lastName}</a></Table.Cell><Table.Cell><Badge variant={item.status === 'new' ? 'warning' : 'success'}>{statusLabel(item.status)}</Badge></Table.Cell><Table.Cell>{paymentLabel(item.paymentMethod)}</Table.Cell><Table.Cell><div class="submission-action">{#if item.status === 'new'}<form method="POST" action="?/process"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} /><Button type="submit" size="sm">Marquer comme traitée</Button></form>{:else}<form method="POST" action="?/payment"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} /><select aria-label="Mode de paiement" name="method"><option value="">Non payé</option><option value="twint" selected={item.paymentMethod === 'twint'}>TWINT</option><option value="cash" selected={item.paymentMethod === 'cash'}>Espèces</option></select><Button type="submit" size="sm" variant="outline">Enregistrer</Button></form>{/if}</div></Table.Cell></Table.Row>{/each}{/snippet}
        {#snippet cards()}{#each data.submissions as item (item.id)}<DataCard title={`${item.firstName} ${item.lastName}`} href={`?id=${item.id}`}>{#snippet notes()}{dateLabel(item.createdAt)}{/snippet}{#snippet byline()}<Badge variant={item.status === 'new' ? 'warning' : 'success'}>{statusLabel(item.status)}</Badge> · {paymentLabel(item.paymentMethod)}{/snippet}{#snippet actions()}{#if item.status === 'new'}<form method="POST" action="?/process"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} /><Button type="submit" size="sm">Traiter</Button></form>{:else}<form method="POST" action="?/payment"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} /><input type="hidden" name="method" value={item.paymentMethod ? '' : 'twint'} /><Button type="submit" size="sm" variant="outline">{item.paymentMethod ? 'Annuler le paiement' : 'Noter TWINT'}</Button></form>{/if}{/snippet}</DataCard>{/each}{/snippet}
      </DataTable>
    {:else}<p class="empty-note">Aucune demande reçue pour le moment.</p>{/if}
  </section>

  {#if data.selected}
    <section class="selected-submission panel" aria-labelledby="selected-title">
      <div class="section-intro"><div><h2 id="selected-title">Demande de {data.selected.firstName} {data.selected.lastName}</h2><p>Informations transmises lors de la demande.</p></div><Badge variant={data.selected.status === 'new' ? 'warning' : 'success'}>{statusLabel(data.selected.status)}</Badge></div>
      <dl><div><dt>Contact</dt><dd>{data.selected.email}<br />{data.selected.phone}</dd></div><div><dt>Adresse</dt><dd>{data.selected.address}<br />{data.selected.postalCode} {data.selected.city}</dd></div><div><dt>Consentement</dt><dd>{data.selected.consentFullName}<br />{dateLabel(data.selected.consentAcceptedOn)}</dd></div></dl>
      <div class="member-list"><h3>Membres de la famille</h3><ul>{#each data.selected.members as member}<li>{member.firstName} {member.lastName}{member.birthDate ? ` · ${member.birthDate}` : ''}</li>{/each}</ul></div>
    </section>
  {/if}
</main>

<style>
  .family-page { display: grid; max-width: var(--max-content); margin: 0 auto; padding: var(--space-6) var(--space-6) var(--space-12); gap: var(--space-8); }
  .page-header h1, h2, h3, p { margin: 0; }
  .page-header h1 { color: var(--text-main); font-size: var(--text-display); line-height: var(--leading-tight); }
  .page-header p, .section-heading p, .section-intro p, .publication-panel p, .hint { color: var(--text-muted); line-height: var(--leading-base); }
  .page-header p { max-width: 44rem; margin-top: var(--space-2); }
  .panel, .documents-section, .submissions-section { display: grid; gap: var(--space-5); padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card); box-shadow: var(--shadow-sm); }
  .form-error { padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--danger-light); color: var(--danger); }
  .section-heading { display: flex; align-items: flex-start; gap: var(--space-3); }.section-heading h2, .section-intro h2, .publication-panel h2 { color: var(--text-main); font-size: var(--text-h2); line-height: var(--leading-tight); }.section-heading p { margin-top: var(--space-1); }
  .heading-icon { display: grid; flex: 0 0 auto; width: 40px; height: 40px; place-items: center; border-radius: var(--radius-sm); background: var(--primary-light); color: var(--primary-dark); }
  .configuration-form, .document-form { display: grid; gap: var(--space-4); }.field { display: grid; gap: var(--space-2); min-width: 0; }.full { grid-column: 1 / -1; }
  textarea, select { box-sizing: border-box; width: 100%; min-height: 44px; padding: var(--space-3); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); font: inherit; line-height: var(--leading-base); } textarea { resize: vertical; } textarea:focus-visible, select:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
  .input-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: var(--space-4); }.input-grid > .field { align-self: start; }.hint { font-size: var(--text-small); }
  .payment-methods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); margin: 0; padding: 0; border: 0; }.payment-methods legend { grid-column: 1 / -1; color: var(--text-main); font-size: var(--text-small); font-weight: var(--weight-semibold); }.check-option { display: flex; align-items: flex-start; gap: var(--space-3); min-height: 48px; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; }.check-option:focus-within { box-shadow: var(--shadow-focus); }.check-option span { display: grid; gap: var(--space-1); }.check-option strong { color: var(--text-main); font-size: var(--text-body); }.check-option small { color: var(--text-muted); font-size: var(--text-small); line-height: var(--leading-base); }.enabled-option { width: fit-content; }.form-actions { display: flex; justify-content: flex-end; padding-top: var(--space-1); }
  .publication-panel, .section-intro { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); }.publication-panel p { margin-top: var(--space-1); }.publication-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); }.documents-section, .submissions-section { gap: var(--space-4); }.document-list { display: grid; gap: var(--space-3); }
  .document-card, .add-document { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card); overflow: hidden; }.document-card summary, .add-document summary { display: flex; align-items: center; gap: var(--space-3); min-height: 64px; padding: var(--space-3) var(--space-4); color: var(--text-main); cursor: pointer; list-style: none; }.document-card summary::-webkit-details-marker, .add-document summary::-webkit-details-marker { display: none; }.document-card summary > span:nth-child(2) { display: grid; gap: var(--space-1); min-width: 0; }.document-card summary small { color: var(--text-muted); font-size: var(--text-small); }.document-kind { margin-left: auto; color: var(--text-muted); font-size: var(--text-small); }.document-form { padding: 0 var(--space-4) var(--space-4); border-top: 1px solid var(--border); }.document-form > :first-child { margin-top: var(--space-4); }.document-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(11rem, 1fr) minmax(9rem, .6fr); gap: var(--space-3); }.simple-check { display: flex; align-items: center; gap: var(--space-2); color: var(--text-main); font-size: var(--text-small); font-weight: var(--weight-medium); }.add-document summary { color: var(--primary); font-weight: var(--weight-semibold); }.empty-note { padding: var(--space-5); border: 1px dashed var(--border-strong); border-radius: var(--radius-md); color: var(--text-muted); text-align: center; }
  :global(.actions-head) { text-align: right; }.submission-link { color: var(--primary-dark); font-weight: var(--weight-semibold); text-decoration: none; }.submission-link:hover { text-decoration: underline; }.submission-action, .submission-action form { display: flex; justify-content: flex-end; align-items: center; gap: var(--space-2); }.submission-action select { width: auto; min-height: 32px; padding: var(--space-1) var(--space-2); font-size: var(--text-small); }:global(.selected > td) { background: var(--primary-light); }
  .selected-submission { gap: var(--space-5); } dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); margin: 0; }dl div, .member-list { display: grid; gap: var(--space-1); }dt { color: var(--text-muted); font-size: var(--text-small); }dd { margin: 0; color: var(--text-main); line-height: var(--leading-base); }.member-list { padding-top: var(--space-4); border-top: 1px solid var(--border); }.member-list h3 { color: var(--text-main); font-size: var(--text-h3); }.member-list ul { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }.member-list li { padding: var(--space-2) var(--space-3); border-radius: var(--radius-pill); background: var(--bg-hover); color: var(--text-main); font-size: var(--text-small); }
  @media (max-width: 760px) { .family-page { padding: var(--space-4) var(--space-4) var(--space-10); gap: var(--space-6); }.panel, .documents-section, .submissions-section { padding: var(--space-4); }.input-grid, .payment-methods, .document-grid, dl { grid-template-columns: 1fr; }.publication-panel, .section-intro { align-items: stretch; flex-direction: column; }.publication-actions { display: grid; grid-template-columns: 1fr; }.publication-actions :global(a), .publication-actions :global(button), .form-actions :global(button) { width: 100%; }.enabled-option { width: auto; }.document-kind { margin-left: 0; }.submission-action, .submission-action form { justify-content: flex-start; flex-wrap: wrap; } }
</style>
