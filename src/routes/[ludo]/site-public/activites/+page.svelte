<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import ActivityDialog, {
    type EditableActivity,
  } from '$lib/components/public-site/ActivityDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import CalendarIcon from '@lucide/svelte/icons/calendar-days'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableActivity | null>(null)
  let pendingId = $state<string | null>(null)
  let imagePendingId = $state<string | null>(null)
  let registrationPendingId = $state<string | null>(null)
  const registrationLabels = {
    received: 'Reçue',
    waitlisted: "Liste d'attente",
    confirmed: 'Confirmée',
    declined: 'Refusée',
    cancelled: 'Annulée par l’équipe',
    archived: 'Archivée',
  } as const

  function openCreate() {
    editing = null
    dialogOpen = true
  }

  function openEdit(activity: EditableActivity) {
    editing = activity
    dialogOpen = true
  }

  function hasInactiveTargets(activity: EditableActivity) {
    return activity.targets.some((target) => !target.site.isActive)
  }

  function targetLabel(activity: EditableActivity) {
    if (activity.targets.length === 0) return 'Tous les lieux actifs'
    return activity.targets
      .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
      .join(', ')
  }

  function scheduleLabel(activity: EditableActivity) {
    if (activity.type === 'permanent') return 'Activité permanente'
    const occurrences = `${activity.dates.length} occurrence${activity.dates.length > 1 ? 's' : ''}`
    if (activity.type === 'one_off') return occurrences
    return `${occurrences} · récurrence · ${activity.exceptions.length} exception${activity.exceptions.length > 1 ? 's' : ''}`
  }
</script>

<svelte:head><title>Activités · {data.ludo.name}</title></svelte:head>

<main class="activities-page">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Activités</h1>
      <p class="intro">Gérez les activités, leurs occurrences et leur visibilité.</p>
    </div>
    <Button onclick={openCreate}>Nouvelle activité</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}
    <p class="error" role="alert">{page.form.error}</p>
  {/if}

  {#if data.activities.length === 0}
    <EmptyState
      icon={CalendarIcon}
      title="Aucune activité"
      description="Créez un brouillon, ajoutez ses dates puis publiez-le."
    >
      {#snippet action()}<Button onclick={openCreate}>Nouvelle activité</Button>{/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.activities as item (item.id)}
        <article
          class="activity-card"
          class:muted={item.status !== 'published' || item.lifecycle !== 'active'}
        >
          <div class="card-head">
            <div>
              <h2>{item.title}</h2>
              <p class="meta">/{item.slug} · {scheduleLabel(item)}</p>
              <p class="meta">{targetLabel(item)}{item.location ? ` · ${item.location}` : ''}</p>
            </div>
            <div class="badges">
              {#if item.status === 'published'}
                <Badge variant="success">Publiée</Badge>
              {:else if item.status === 'hidden'}
                <Badge variant="secondary">Masquée</Badge>
              {:else}
                <Badge variant="outline">Brouillon</Badge>
              {/if}
              {#if item.lifecycle === 'archived'}
                <Badge variant="secondary">Archivée</Badge>
              {:else if item.lifecycle === 'trashed'}
                <Badge variant="warning">Corbeille</Badge>
              {/if}
              {#if item.featuredRank}<Badge variant="outline">À la une n° {item.featuredRank}</Badge
                >{/if}
              {#if hasInactiveTargets(item)}<Badge variant="warning">Cible inactive</Badge>{/if}
            </div>
          </div>

          <p class="summary">{item.summary}</p>
          {#if data.canManageRegistrations && item.lifecycle === 'active'}
            <form
              class="registration-settings"
              method="POST"
              action="?/registrationSettings"
              use:enhance={toastEnhance({
                success: "Réglages d'inscription mis à jour.",
                onPending: (value) => (registrationPendingId = value ? item.id : null),
              })}
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="revision" value={item.revision} />
              <label class="toggle">
                <input type="checkbox" name="enabled" checked={item.registrationEnabled} />
                Accepter les inscriptions
              </label>
              <label>
                <span>Capacité indicative</span>
                <input
                  type="number"
                  name="capacity"
                  min="1"
                  max="10000"
                  value={item.registrationCapacity ?? ''}
                  placeholder="Sans limite"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={registrationPendingId === item.id}>Enregistrer</Button
              >
            </form>
          {/if}
          {#if item.imageUrl}<img
              class="cover"
              src={item.imageUrl}
              alt={item.imageAlt ?? ''}
            />{/if}
          {#if hasInactiveTargets(item)}
            <p class="warning" role="alert">
              Cette activité cible un lieu inactif. Corrigez son ciblage avant de la publier.
            </p>
          {/if}

          {#if item.lifecycle === 'active'}
            <div class="controls">
              <Button variant="outline" size="sm" onclick={() => openEdit(item)}>
                <PencilIcon size={16} aria-hidden="true" /> Modifier
              </Button>
              <form
                method="POST"
                action="?/publication"
                use:enhance={toastEnhance({
                  success: item.status === 'published' ? 'Activité masquée.' : 'Activité publiée.',
                  onPending: (value) => (pendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <input
                  type="hidden"
                  name="status"
                  value={item.status === 'published' ? 'hidden' : 'published'}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant={item.status === 'published' ? 'outline' : 'default'}
                  disabled={pendingId === item.id ||
                    (item.status !== 'published' && hasInactiveTargets(item))}
                >
                  {item.status === 'published' ? 'Masquer' : 'Publier'}
                </Button>
              </form>
              <form
                class="feature"
                method="POST"
                action="?/feature"
                use:enhance={toastEnhance({
                  success: 'Mise en avant mise à jour.',
                  onPending: (value) => (pendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="revision" value={item.revision} />
                <label
                  >À la une
                  <select
                    name="rank"
                    disabled={item.status !== 'published' || pendingId === item.id}
                  >
                    <option value="" selected={item.featuredRank === null}>Non</option>
                    {#each [1, 2, 3] as rank}<option
                        value={rank}
                        selected={item.featuredRank === rank}>Rang {rank}</option
                      >{/each}
                  </select>
                </label>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={item.status !== 'published' || pendingId === item.id}>Appliquer</Button
                >
              </form>
            </div>
          {/if}

          <div class="lifecycle">
            {#if item.lifecycle !== 'active'}
              <form
                method="POST"
                action="?/lifecycle"
                use:enhance={toastEnhance({ success: 'Activité restaurée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="lifecycle" value="active" />
                <Button type="submit" size="sm" variant="outline">Restaurer</Button>
              </form>
            {/if}
            {#if item.lifecycle === 'active'}
              <form
                method="POST"
                action="?/lifecycle"
                use:enhance={toastEnhance({ success: 'Activité archivée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="lifecycle" value="archived" />
                <Button type="submit" size="sm" variant="outline">Archiver</Button>
              </form>
            {/if}
            {#if item.lifecycle !== 'trashed'}
              <form
                method="POST"
                action="?/lifecycle"
                use:enhance={toastEnhance({ success: 'Activité placée dans la corbeille.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="lifecycle" value="trashed" />
                <Button type="submit" size="sm" variant="outline">Corbeille</Button>
              </form>
            {:else}
              <form
                method="POST"
                action="?/delete"
                onsubmit={(event) => {
                  if (!confirm('Supprimer définitivement cette activité ?')) event.preventDefault()
                }}
                use:enhance={toastEnhance({ success: 'Activité supprimée.' })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                />
                <Button type="submit" size="sm" variant="destructive"
                  >Supprimer définitivement</Button
                >
              </form>
            {/if}
          </div>

          {#if item.lifecycle === 'active'}
            <section class="image-editor" aria-label={`Image de ${item.title}`}>
              <form
                method="POST"
                action="?/uploadImage"
                enctype="multipart/form-data"
                use:enhance={toastEnhance({
                  success: item.imageUrl ? 'Image remplacée.' : 'Image ajoutée.',
                  onPending: (value) => (imagePendingId = value ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                />
                <label
                  ><span>Fichier JPEG, PNG ou WebP</span><input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  /></label
                >
                <label
                  ><span>Texte alternatif</span><input
                    type="text"
                    name="alt"
                    value={item.imageAlt ?? ''}
                    maxlength="300"
                    required
                  /></label
                >
                <Button type="submit" size="sm" disabled={imagePendingId === item.id}
                  >{item.imageUrl ? 'Remplacer' : 'Ajouter'}</Button
                >
              </form>
              {#if item.imageUrl}
                <form
                  method="POST"
                  action="?/removeImage"
                  use:enhance={toastEnhance({
                    success: 'Image supprimée.',
                    onPending: (value) => (imagePendingId = value ? item.id : null),
                  })}
                >
                  <input type="hidden" name="id" value={item.id} /><input
                    type="hidden"
                    name="revision"
                    value={item.revision}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={imagePendingId === item.id}>Supprimer l’image</Button
                  >
                </form>
              {/if}
            </section>
          {/if}
        </article>
      {/each}
    </div>
  {/if}

  {#if data.canManageRegistrations}
    <section class="registrations" aria-labelledby="registrations-title">
      <header class="registrations-head">
        <div>
          <p class="eyebrow">Gestion interne</p>
          <h2 id="registrations-title">Inscriptions reçues</h2>
          <p class="intro">Les coordonnées sont privées et visibles uniquement ici.</p>
        </div>
        <form method="GET" class="registration-filters">
          <label>
            <span>Activité</span>
            <select name="registrationActivity">
              <option value="">Toutes</option>
              {#each data.activities as activity}
                <option
                  value={activity.id}
                  selected={data.registrationFilters.activityId === activity.id}
                  >{activity.title}</option
                >
              {/each}
            </select>
          </label>
          <label>
            <span>Statut</span>
            <select name="registrationStatus">
              <option value="">Tous</option>
              {#each Object.entries(registrationLabels) as [value, label]}
                <option {value} selected={data.registrationFilters.status === value}>{label}</option
                >
              {/each}
            </select>
          </label>
          <Button type="submit" size="sm" variant="outline">Filtrer</Button>
        </form>
      </header>

      {#if data.registrations.length === 0}
        <p class="empty-registrations">Aucune inscription pour ces filtres.</p>
      {:else}
        <div class="registration-list">
          {#each data.registrations as registration (registration.id)}
            <article class="registration-card">
              <details>
                <summary>
                  <span>
                    <strong>{registration.activity.title}</strong>
                    <small
                      >{registration.participantCount} participant{registration.participantCount > 1
                        ? 's'
                        : ''} · {new Date(registration.createdAt).toLocaleString('fr-CH')}</small
                    >
                  </span>
                  <Badge variant={registration.status === 'waitlisted' ? 'warning' : 'secondary'}
                    >{registrationLabels[registration.status]}</Badge
                  >
                </summary>
                <div class="registration-detail">
                  <dl>
                    <div>
                      <dt>Nom</dt>
                      <dd>{registration.contactName}</dd>
                    </div>
                    <div>
                      <dt>E-mail</dt>
                      <dd><a href={`mailto:${registration.email}`}>{registration.email}</a></dd>
                    </div>
                    {#if registration.phone}
                      <div>
                        <dt>Téléphone</dt>
                        <dd><a href={`tel:${registration.phone}`}>{registration.phone}</a></dd>
                      </div>
                    {/if}
                  </dl>
                  {#if registration.message}
                    <p class="registration-message">{registration.message}</p>
                  {/if}
                </div>
              </details>
              <form
                class="status-form"
                method="POST"
                action="?/registrationStatus"
                use:enhance={toastEnhance({
                  success: "Statut de l'inscription mis à jour.",
                  onPending: (value) => (registrationPendingId = value ? registration.id : null),
                })}
              >
                <input type="hidden" name="id" value={registration.id} />
                <input type="hidden" name="revision" value={registration.revision} />
                <label>
                  <span>Nouveau statut</span>
                  <select name="status" disabled={registrationPendingId === registration.id}>
                    {#each Object.entries(registrationLabels) as [value, label]}
                      <option {value} selected={registration.status === value}>{label}</option>
                    {/each}
                  </select>
                </label>
                <Button type="submit" size="sm" disabled={registrationPendingId === registration.id}
                  >Appliquer</Button
                >
              </form>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <ActivityDialog bind:open={dialogOpen} activity={editing} sites={data.sites} />
</main>

<style>
  .activities-page {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header,
  .card-head,
  .controls,
  .lifecycle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  header {
    align-items: flex-end;
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .eyebrow,
  .intro,
  .meta {
    color: var(--text-muted);
  }
  .eyebrow {
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: var(--text-h1);
  }
  h2 {
    font-size: var(--text-card-title);
  }
  .meta {
    margin-top: var(--space-1);
    font-size: var(--text-small);
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .activity-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .activity-card.muted {
    border-style: dashed;
  }
  .badges,
  .controls,
  .lifecycle {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .summary {
    line-height: 1.6;
  }
  .cover {
    width: min(100%, 560px);
    max-height: 280px;
    border-radius: var(--radius-md);
    object-fit: cover;
  }
  .warning,
  .error {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-small);
  }
  .warning {
    background: var(--warning-light);
  }
  .error {
    margin-bottom: var(--space-4);
    background: var(--danger-light);
    color: var(--danger);
  }
  .controls,
  .lifecycle,
  .image-editor {
    justify-content: flex-start;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .registration-settings,
  .registration-filters,
  .status-form {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .registration-settings {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--bg-muted);
  }
  .registration-settings label,
  .registration-filters label,
  .status-form label {
    display: grid;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .registration-settings .toggle {
    display: flex;
    align-items: center;
  }
  .registration-settings input[type='number'],
  .registration-filters select,
  .status-form select {
    min-height: 40px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .registrations {
    display: grid;
    gap: var(--space-4);
    margin-top: var(--space-8);
    padding-top: var(--space-6);
    border-top: 1px solid var(--border);
  }
  .registrations-head,
  .registration-card summary,
  .registration-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .registration-list {
    display: grid;
    gap: var(--space-3);
  }
  .registration-card {
    align-items: flex-end;
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .registration-card details {
    flex: 1;
  }
  .registration-card summary {
    cursor: pointer;
  }
  .registration-card summary span {
    display: grid;
    gap: var(--space-1);
  }
  .registration-card small,
  .empty-registrations {
    color: var(--text-muted);
  }
  .registration-detail {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-4);
  }
  .registration-detail dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin: 0;
  }
  .registration-detail dt {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .registration-detail dd {
    margin: 0;
  }
  .registration-message {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--bg-muted);
    white-space: pre-wrap;
  }
  .controls form,
  .lifecycle form,
  .feature {
    display: inline-flex;
    align-items: flex-end;
    gap: var(--space-2);
  }
  .feature label {
    display: grid;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  select,
  .image-editor input {
    min-height: 40px;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .image-editor {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .image-editor form:first-child {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    flex: 1;
  }
  .image-editor label {
    display: grid;
    gap: var(--space-1);
    flex: 1;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .image-editor input {
    width: 100%;
  }
  @media (max-width: 640px) {
    .activities-page {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .card-head,
    .controls,
    .lifecycle,
    .image-editor,
    .image-editor form:first-child {
      align-items: stretch;
      flex-direction: column;
    }
    .registrations-head,
    .registration-card,
    .registration-filters,
    .status-form,
    .registration-settings {
      align-items: stretch;
      flex-direction: column;
    }
    .badges {
      justify-content: flex-start;
    }
    header :global(button),
    .controls :global(button),
    .lifecycle :global(button),
    .image-editor :global(button) {
      width: 100%;
    }
  }
</style>
