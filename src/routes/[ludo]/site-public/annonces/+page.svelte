<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import AnnouncementDialog, {
    type EditableAnnouncement,
  } from '$lib/components/public-site/AnnouncementDialog.svelte'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  let { data } = $props()
  let dialogOpen = $state(false)
  let editing = $state<EditableAnnouncement | null>(null)
  let togglingId = $state<string | null>(null)

  function openCreate() {
    editing = null
    dialogOpen = true
  }

  function openEdit(announcement: EditableAnnouncement) {
    editing = announcement
    dialogOpen = true
  }

  function targetLabel(announcement: EditableAnnouncement) {
    if (announcement.targets.length === 0) return 'Tous les lieux actifs'
    return announcement.targets
      .map((target) => `${target.site.name}${target.site.isActive ? '' : ' (inactif)'}`)
      .join(', ')
  }

  function hasInactiveTargets(announcement: EditableAnnouncement) {
    return announcement.targets.some((target) => !target.site.isActive)
  }
</script>

<svelte:head>
  <title>Annonces · {data.ludo.name}</title>
</svelte:head>

<main class="announcements">
  <header>
    <div>
      <p class="eyebrow">Site public</p>
      <h1>Annonces</h1>
      <p class="intro">Fermetures, changements d’horaires et informations urgentes.</p>
    </div>
    <Button onclick={openCreate}>Nouvelle annonce</Button>
  </header>

  {#if page.form && 'error' in page.form && page.form.error}
    <p class="error" role="alert">{page.form.error}</p>
  {/if}

  {#if data.announcements.length === 0}
    <EmptyState
      icon={MegaphoneIcon}
      title="Aucune annonce"
      description="Créez une annonce, puis activez-la lorsqu’elle doit apparaître sur le site."
    >
      {#snippet action()}
        <Button onclick={openCreate}>Nouvelle annonce</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="list">
      {#each data.announcements as announcement (announcement.id)}
        <article class="announcement" class:inactive={announcement.status !== 'published'}>
          <div class="announcement-head">
            <div>
              <h2>{announcement.title}</h2>
              <p class="targets">{targetLabel(announcement)}</p>
            </div>
            {#if announcement.status === 'published'}
              <Badge variant="success">Active</Badge>
            {:else}
              <Badge variant="secondary">Inactive</Badge>
            {/if}
            {#if hasInactiveTargets(announcement)}
              <Badge variant="warning">Cible inactive</Badge>
            {/if}
          </div>

          <p class="message">{announcement.message}</p>
          {#if hasInactiveTargets(announcement)}
            <p class="target-warning" role="alert">
              Cette annonce cible un lieu devenu inactif. Modifiez son ciblage avant de
              l’enregistrer ou de la réactiver.
            </p>
          {/if}

          <footer>
            <Button variant="outline" size="sm" onclick={() => openEdit(announcement)}>
              <PencilIcon size={16} aria-hidden="true" />
              Modifier
            </Button>
            <form
              method="POST"
              action="?/toggle"
              use:enhance={toastEnhance({
                success:
                  announcement.status === 'published' ? 'Annonce désactivée.' : 'Annonce activée.',
                onPending: (pending) => (togglingId = pending ? announcement.id : null),
              })}
            >
              <input type="hidden" name="id" value={announcement.id} />
              <input type="hidden" name="revision" value={announcement.revision} />
              <input
                type="hidden"
                name="active"
                value={announcement.status === 'published' ? 'false' : 'true'}
              />
              <Button
                type="submit"
                size="sm"
                variant={announcement.status === 'published' ? 'outline' : 'default'}
                disabled={togglingId === announcement.id ||
                  (announcement.status !== 'published' && hasInactiveTargets(announcement))}
              >
                {#if togglingId === announcement.id}
                  Enregistrement…
                {:else if announcement.status === 'published'}
                  Désactiver
                {:else}
                  Activer
                {/if}
              </Button>
            </form>
          </footer>
        </article>
      {/each}
    </div>
  {/if}

  <AnnouncementDialog bind:open={dialogOpen} announcement={editing} sites={data.sites} />
</main>

<style>
  .announcements {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  .eyebrow {
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h1 {
    margin-top: var(--space-1);
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  .intro,
  .targets {
    margin-top: var(--space-1);
    color: var(--text-muted);
  }
  .targets {
    font-size: var(--text-small);
  }
  .error {
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
  }
  .list {
    display: grid;
    gap: var(--space-4);
  }
  .announcement {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  .announcement.inactive {
    border-style: dashed;
  }
  .announcement-head,
  footer {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-card-title);
  }
  .message {
    color: var(--text-main);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .target-warning {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--warning-light);
    color: var(--text-main);
    font-size: var(--text-small);
  }
  footer {
    align-items: center;
    justify-content: flex-end;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  footer form {
    display: inline-flex;
  }
  @media (max-width: 640px) {
    .announcements {
      padding: var(--space-6) var(--space-4);
    }
    header,
    .announcement-head {
      align-items: stretch;
      flex-direction: column;
    }
    header :global(button) {
      width: 100%;
    }
    footer {
      justify-content: stretch;
    }
    footer :global(button),
    footer form {
      flex: 1;
    }
    footer :global(button) {
      width: 100%;
    }
  }
</style>
