<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import BellOffIcon from '@lucide/svelte/icons/bell-off'
  import type { NotificationRow, NotificationType } from '$lib/server/schema'
  import type { NotificationGroup } from '$lib/server/services/notifications'

  let { data } = $props()

  const slug = $derived(data.ludo.slug)
  const groups = $derived(data.groups as NotificationGroup[])
  const hasAny = $derived(groups.some((g) => g.items.length > 0))

  let filter = $state<'all' | NotificationGroup['domain']>('all')

  const visibleGroups = $derived(
    filter === 'all' ? groups : groups.filter((g) => g.domain === filter),
  )

  /** Lien profond vers l'entité concernée par la notification. */
  function linkFor(n: NotificationRow): string {
    const byType: Record<NotificationType, string> = {
      theme_request: n.entityId ? `/${slug}/themes/${n.entityId}` : `/${slug}/themes`,
      theme_request_confirmed: '/reseau/themes',
      theme_request_declined: '/reseau/themes',
      help_response: '/reseau/aide',
      help_confirmed: '/reseau/aide',
      absence_request: `/${slug}/absences`,
      absence_approved: `/${slug}/absences`,
      absence_refused: `/${slug}/absences`,
      theme_installed: `/${slug}/themes`,
      installation_closed: `/${slug}/themes`,
      checkup_recorded: `/${slug}/themes`,
      checkup_missing_item: `/${slug}/themes`,
      supply_request: `/${slug}/supplies`,
      campaign_sent: `/${slug}/newsletter`,
    }
    return byType[n.type]
  }

  const dateFmt = new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const formatDate = (d: Date) => dateFmt.format(new Date(d))
</script>

<svelte:head>
  <title>Notifications — {data.ludo.name}</title>
</svelte:head>

<main class="notifications">
  <header class="head">
    <div>
      <h1>Notifications</h1>
      <p class="muted">Les actions et réponses qui concernent votre ludothèque.</p>
    </div>
    {#if hasAny}
      <form
        method="POST"
        action="?/readAll"
        use:enhance={toastEnhance({ success: 'Tout marqué lu.' })}
      >
        <Button type="submit" variant="outline">Tout marquer comme lu</Button>
      </form>
    {/if}
  </header>

  {#if !hasAny}
    <EmptyState icon={BellOffIcon} title="Aucune notification pour le moment" />
  {:else}
    <div class="filters" role="tablist" aria-label="Filtrer par domaine">
      <button
        type="button"
        class="chip"
        class:chip--active={filter === 'all'}
        onclick={() => (filter = 'all')}>Tout</button
      >
      {#each groups as g (g.domain)}
        <button
          type="button"
          class="chip"
          class:chip--active={filter === g.domain}
          onclick={() => (filter = g.domain)}>{g.label}</button
        >
      {/each}
    </div>

    {#each visibleGroups as group (group.domain)}
      <section class="group">
        <h2 class="group__title">{group.label}</h2>
        <ul class="list">
          {#each group.items as n (n.id)}
            <li>
              <form
                method="POST"
                action="?/read"
                use:enhance={toastEnhance({ success: null })}
                class="notif"
                class:notif--unread={!n.isRead}
              >
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="href" value={linkFor(n)} />
                <button type="submit" class="notif__btn">
                  <span class="notif__main">
                    <span class="notif__title">{n.title}</span>
                    {#if n.body}<span class="notif__body">{n.body}</span>{/if}
                  </span>
                  <span class="notif__meta">
                    {#if n.severity === 'action_required'}
                      <Badge variant="destructive">À traiter</Badge>
                    {/if}
                    <time class="notif__date">{formatDate(n.createdAt)}</time>
                  </span>
                </button>
              </form>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>

<style>
  .notifications {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  h1 {
    color: var(--text-main);
    margin: 0 0 var(--space-1);
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }
  .chip {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
    font-family: inherit;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .chip:hover {
    background: var(--bg-hover);
  }
  .chip--active {
    background: var(--ludo-color);
    border-color: var(--ludo-color);
    color: var(--text-inverse);
  }
  .chip:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .group {
    margin-bottom: var(--space-8);
  }
  .group__title {
    font-size: var(--text-h3);
    color: var(--text-muted);
    margin: 0 0 var(--space-3);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .notif {
    margin: 0;
  }
  .notif__btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out-strong);
  }
  .notif__btn:hover {
    background: var(--bg-hover);
  }
  .notif__btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  .notif--unread .notif__btn {
    background: var(--primary-light);
  }
  .notif--unread .notif__btn:hover {
    background: color-mix(in srgb, var(--primary-light) 70%, var(--bg-hover));
  }
  .notif__main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .notif__title {
    color: var(--text-main);
    font-weight: var(--weight-semibold);
  }
  .notif--unread .notif__title {
    font-weight: var(--weight-bold);
  }
  .notif__body {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .notif__meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }
  .notif__date {
    color: var(--text-subtle);
    font-size: var(--text-small);
    white-space: nowrap;
  }
</style>
