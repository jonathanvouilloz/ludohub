<script lang="ts">
  import EditorialListItem from '$lib/components/public-site/EditorialListItem.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import UsersIcon from '@lucide/svelte/icons/users'
  let { data } = $props()
  const base = $derived(`/${data.ludo.slug}/site-public/inscriptions`)
  const labels = {
    received: 'Reçue',
    waitlisted: 'Liste d’attente',
    confirmed: 'Confirmée',
    declined: 'Refusée',
    cancelled: 'Annulée',
    archived: 'Archivée',
  } as const
  function variant(
    status: keyof typeof labels,
  ): 'warning' | 'success' | 'secondary' | 'destructive' {
    if (status === 'received' || status === 'waitlisted') return 'warning'
    if (status === 'confirmed') return 'success'
    if (status === 'declined' || status === 'cancelled') return 'destructive'
    return 'secondary'
  }
</script>

<svelte:head><title>Inscriptions aux activités · {data.ludo.name}</title></svelte:head>
<main class="index-page">
  <header>
    <div>
      <h1>Inscriptions aux activités</h1>
      <p>
        Consultez les demandes reçues, puis ouvrez-en une pour voir les coordonnées et décider de
        son statut.
      </p>
    </div>
  </header>
  <form method="GET" class="filters">
    <label
      ><span>Activité</span><select name="registrationActivity"
        ><option value="">Toutes les activités</option>{#each data.activities as activity}<option
            value={activity.id}
            selected={data.filters.activityId === activity.id}>{activity.title}</option
          >{/each}</select
      ></label
    ><label
      ><span>Statut</span><select name="registrationStatus"
        ><option value="">Tous les statuts</option
        >{#each Object.entries(labels) as [value, label]}<option
            {value}
            selected={data.filters.status === value}>{label}</option
          >{/each}</select
      ></label
    ><Button type="submit" variant="outline">Filtrer</Button
    >{#if data.filters.activityId || data.filters.status}<Button href={base} variant="outline"
        >Effacer les filtres</Button
      >{/if}
  </form>
  {#if data.registrations.length === 0}<EmptyState
      icon={UsersIcon}
      title="Aucune inscription"
      description="Aucune demande ne correspond aux filtres sélectionnés."
    />{:else}<div class="content-list">
      {#each data.registrations as item (item.id)}<EditorialListItem
          href={`${base}/${item.id}`}
          title={item.activity.title}
          description={`${item.contactName} · ${item.participantCount} participant${item.participantCount > 1 ? 's' : ''}`}
          meta={[new Date(item.createdAt).toLocaleString('fr-CH')]}
          status={labels[item.status]}
          statusVariant={variant(item.status)}
        />{/each}
    </div>{/if}
</main>

<style>
  .index-page {
    display: grid;
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-4) var(--space-6) var(--space-12);
    gap: var(--space-5);
  }
  h1,
  p {
    margin: 0;
  }
  h1 {
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  header p {
    max-width: 720px;
    margin-top: var(--space-2);
    color: var(--text-muted);
    line-height: 1.5;
  }
  .filters {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
  }
  label {
    display: grid;
    flex: 1;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  select {
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
  }
  .content-list {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  @media (max-width: 700px) {
    .index-page {
      padding: var(--space-3) var(--space-4) var(--space-10);
    }
    .filters {
      align-items: stretch;
      flex-direction: column;
    }
    .filters :global(a),
    .filters :global(button) {
      width: 100%;
    }
  }
</style>
