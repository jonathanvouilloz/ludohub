<script lang="ts">
  import { enhance } from '$app/forms'
  import ActivityDialog from '$lib/components/public-site/ActivityDialog.svelte'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  let { data } = $props()
  let editOpen = $state(false)
  let pending = $state(false)
  const item = $derived(data.activity)
  const base = $derived(`/${data.ludo.slug}/site-public/activites`)
  const targetLabel = $derived(
    item.targets.length === 0
      ? 'Tous les lieux actifs'
      : item.targets
          .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
          .join(', '),
  )
  const inactiveTarget = $derived(item.targets.some((target) => !target.site.isActive))
  const statusLabel = $derived(
    item.lifecycle === 'trashed'
      ? 'Corbeille'
      : item.lifecycle === 'archived'
        ? 'Archivée'
        : item.status === 'published'
          ? 'Publiée'
          : item.status === 'hidden'
            ? 'Masquée'
            : 'Brouillon',
  )
</script>

<svelte:head><title>{item.title} · Activités</title></svelte:head>
<main class="detail-page">
  <a class="back" href={base}><ArrowLeftIcon size={18} aria-hidden="true" /> Retour aux activités</a
  >
  <header>
    <div>
      <div class="badges">
        <Badge
          variant={item.status === 'published' && item.lifecycle === 'active'
            ? 'success'
            : 'secondary'}>{statusLabel}</Badge
        >{#if item.featuredRank}<Badge variant="default">À la une n° {item.featuredRank}</Badge
          >{/if}{#if inactiveTarget}<Badge variant="warning">Lieu inactif</Badge>{/if}
      </div>
      <h1>{item.title}</h1>
      <p>{item.summary}</p>
    </div>
    {#if item.lifecycle === 'active'}<Button variant="outline" onclick={() => (editOpen = true)}
        ><PencilIcon size={16} aria-hidden="true" /> Modifier</Button
      >{/if}
  </header>

  <section class="publication">
    <div>
      <h2>Publication</h2>
      <p>{targetLabel}{item.location ? ` · ${item.location}` : ''}</p>
    </div>
    {#if item.lifecycle === 'active'}<form
        method="POST"
        action="?/publication"
        use:enhance={toastEnhance({
          success: item.status === 'published' ? 'Activité masquée.' : 'Activité publiée.',
          onPending: (value) => (pending = value),
        })}
      >
        <input type="hidden" name="id" value={item.id} /><input
          type="hidden"
          name="revision"
          value={item.revision}
        /><input
          type="hidden"
          name="status"
          value={item.status === 'published' ? 'hidden' : 'published'}
        /><Button
          type="submit"
          variant={item.status === 'published' ? 'outline' : 'default'}
          disabled={pending || (item.status !== 'published' && inactiveTarget)}
          >{item.status === 'published' ? 'Masquer du site' : 'Publier sur le site'}</Button
        >
      </form>{/if}
  </section>

  <section>
    <h2>Contenu</h2>
    <div class="body">{item.body}</div>
  </section>
  <section>
    <h2>Dates et horaires</h2>
    {#if item.type === 'permanent'}<p>
        Cette activité est permanente.
      </p>{:else if item.dates.length === 0}<p>Aucune date renseignée.</p>{:else}<ul>
        {#each item.dates as date}<li>
            {new Date(date.startsAt).toLocaleString('fr-CH')}{date.endsAt
              ? ` – ${new Date(date.endsAt).toLocaleString('fr-CH')}`
              : ''}
          </li>{/each}
      </ul>{/if}{#if item.exceptions.length > 0}<h3>Exceptions</h3>
      <ul>
        {#each item.exceptions as exception}<li>
            {new Date(exception.excludedAt).toLocaleString('fr-CH')}{exception.reason
              ? ` · ${exception.reason}`
              : ''}
          </li>{/each}
      </ul>{/if}
  </section>

  {#if data.canManageRegistrations && item.lifecycle === 'active'}<section>
      <div>
        <h2>Inscriptions</h2>
        <p>Activez les inscriptions publiques et indiquez une capacité si nécessaire.</p>
      </div>
      <form
        class="registration"
        method="POST"
        action="?/registrationSettings"
        use:enhance={toastEnhance({
          success: 'Réglages d’inscription mis à jour.',
          onPending: (value) => (pending = value),
        })}
      >
        <input type="hidden" name="id" value={item.id} /><input
          type="hidden"
          name="revision"
          value={item.revision}
        /><label class="toggle"
          ><input type="checkbox" name="enabled" checked={item.registrationEnabled} /> Accepter les inscriptions</label
        ><label
          ><span>Nombre maximum de participants</span><input
            type="number"
            name="capacity"
            min="1"
            max="10000"
            value={item.registrationCapacity ?? ''}
            placeholder="Sans limite"
          /></label
        ><Button type="submit" variant="outline" disabled={pending}>Enregistrer</Button>
      </form>
      <Button
        href={`/${data.ludo.slug}/site-public/inscriptions?registrationActivity=${item.id}`}
        variant="outline">Voir les inscriptions à cette activité</Button
      >
    </section>{/if}

  {#if item.lifecycle === 'active'}<details class="secondary-settings">
      <summary><span>Mettre l’activité en avant</span><small>Optionnel</small></summary>
      <section class="settings-panel">
      <div>
        <h2>Mise en avant sur la page d’accueil</h2>
        <p>Choisissez une position seulement si cette activité doit être mise en avant.</p>
      </div>
      <form
        class="feature"
        method="POST"
        action="?/feature"
        use:enhance={toastEnhance({
          success: 'Mise en avant mise à jour.',
          onPending: (value) => (pending = value),
        })}
      >
        <input type="hidden" name="id" value={item.id} /><input
          type="hidden"
          name="revision"
          value={item.revision}
        /><label
          ><span>Position sur la page d’accueil</span><select
            name="rank"
            disabled={item.status !== 'published' || pending}
            ><option value="" selected={item.featuredRank === null}>Ne pas mettre à la une</option
            >{#each [1, 2, 3] as rank}<option value={rank} selected={item.featuredRank === rank}
                >Position {rank}</option
              >{/each}</select
          ></label
        ><Button type="submit" variant="outline" disabled={item.status !== 'published' || pending}
          >Appliquer</Button
        >
      </form>
      </section>
    </details>{/if}

  <details class="secondary-settings lifecycle-settings">
    <summary><span>Archiver ou supprimer cette activité</span><small>Actions avancées</small></summary>
  <section class="lifecycle settings-panel">
    <div>
      <h2>Classement</h2>
      <p>Archivez une ancienne activité ou placez-la dans la corbeille.</p>
    </div>
    <div class="actions">
      {#if item.lifecycle !== 'active'}<form
          method="POST"
          action="?/lifecycle"
          use:enhance={toastEnhance({ success: 'Activité restaurée.' })}
        >
          <input type="hidden" name="id" value={item.id} /><input
            type="hidden"
            name="revision"
            value={item.revision}
          /><input type="hidden" name="lifecycle" value="active" /><Button
            type="submit"
            variant="outline">Restaurer</Button
          >
        </form>{:else}<form
          method="POST"
          action="?/lifecycle"
          use:enhance={toastEnhance({ success: 'Activité archivée.' })}
        >
          <input type="hidden" name="id" value={item.id} /><input
            type="hidden"
            name="revision"
            value={item.revision}
          /><input type="hidden" name="lifecycle" value="archived" /><Button
            type="submit"
            variant="outline">Archiver</Button
          >
        </form>{/if}{#if item.lifecycle !== 'trashed'}<form
          method="POST"
          action="?/lifecycle"
          use:enhance={toastEnhance({ success: 'Activité placée dans la corbeille.' })}
        >
          <input type="hidden" name="id" value={item.id} /><input
            type="hidden"
            name="revision"
            value={item.revision}
          /><input type="hidden" name="lifecycle" value="trashed" /><Button
            type="submit"
            variant="destructive">Mettre à la corbeille</Button
          >
        </form>{/if}
      <form
        method="POST"
        action="?/delete"
        onsubmit={(event) => {
          if (!confirm('Supprimer définitivement cette activité et ses médias ?')) {
            event.preventDefault()
          }
        }}
        use:enhance={toastEnhance({ redirect: 'Activité supprimée.' })}
      >
        <input type="hidden" name="id" value={item.id} /><input
          type="hidden"
          name="revision"
          value={item.revision}
        /><Button type="submit" variant="destructive">Supprimer définitivement</Button>
      </form>
    </div>
  </section>
  </details>
  <ActivityDialog bind:open={editOpen} activity={item} />
</main>

<style>
  .detail-page {
    display: grid;
    max-width: 1020px;
    margin: 0 auto;
    padding: var(--space-3) var(--space-6) var(--space-12);
    gap: var(--space-5);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    width: fit-content;
    color: var(--primary);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  header,
  .publication,
  .lifecycle {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  h1 {
    margin-top: var(--space-3);
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  header p,
  section p {
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.5;
  }
  .badges,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  section {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
  }
  .body {
    line-height: 1.7;
    white-space: pre-wrap;
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding-left: var(--space-5);
  }
  .registration,
  .feature {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 1fr) auto;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .registration .toggle {
    align-self: end;
    min-width: 14rem;
  }
  .feature {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  label {
    display: grid;
    flex: 1;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .toggle {
    display: flex;
    align-items: center;
    min-height: 44px;
  }
  input,
  select {
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .secondary-settings {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  .secondary-settings summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 60px;
    padding: 0 var(--space-6);
    color: var(--text-main);
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    cursor: pointer;
    list-style: none;
  }
  .secondary-settings summary::-webkit-details-marker {
    display: none;
  }
  .secondary-settings summary small {
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-normal);
  }
  .secondary-settings[open] summary {
    border-bottom: 1px solid var(--border);
  }
  .secondary-settings .settings-panel {
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .lifecycle-settings summary {
    color: var(--text-muted);
  }
  @media (max-width: 700px) {
    .detail-page {
      padding: var(--space-3) var(--space-4) var(--space-10);
    }
    header,
    .publication,
    .lifecycle,
    .registration,
    .feature {
      align-items: stretch;
      grid-template-columns: 1fr;
    }
    section {
      padding: var(--space-4);
    }
    .secondary-settings summary {
      min-height: 56px;
      padding-inline: var(--space-4);
    }
    header :global(button),
    .publication :global(button),
    .actions :global(button),
    .registration :global(button),
    .feature :global(button) {
      width: 100%;
    }
    .actions form {
      width: 100%;
    }
  }
</style>
