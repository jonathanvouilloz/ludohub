<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import PrinterIcon from '@lucide/svelte/icons/printer'

  let { data } = $props()

  // Objets actifs uniquement (les archivés ne font pas partie de la caisse).
  const items = $derived(data.theme.items.filter((i) => !i.isArchived))

  const conditionLabel: Record<string, string> = {
    a_reparer: 'À réparer',
    manquant: 'Manquant',
  }
</script>

<svelte:head>
  <title>Checklist — {data.theme.name}</title>
</svelte:head>

<div class="print-page">
  <header class="head">
    <div class="head__text">
      <p class="ludo">{data.ludoName}</p>
      <h1>{data.theme.name}</h1>
      <p class="meta">Liste du matériel · imprimé le {data.printedAt}</p>
    </div>
    <Button class="no-print" variant="outline" onclick={() => window.print()}>
      <PrinterIcon aria-hidden="true" />
      Imprimer
    </Button>
  </header>

  {#if items.length === 0}
    <p class="empty">Aucun objet dans ce thème.</p>
  {:else}
    <table class="checklist">
      <thead>
        <tr>
          <th class="col-check" aria-label="Présent"></th>
          <th class="col-name">Objet</th>
          <th class="col-qty">Qté</th>
          <th class="col-note">État</th>
        </tr>
      </thead>
      <tbody>
        {#each items as item (item.id)}
          <tr>
            <td class="col-check"><span class="box"></span></td>
            <td class="col-name">{item.name}</td>
            <td class="col-qty">×{item.quantity}</td>
            <td class="col-note">
              {#if item.condition !== 'present'}
                {conditionLabel[item.condition] ?? ''}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <p class="count">{items.length} objet{items.length > 1 ? 's' : ''} au total</p>
  {/if}
</div>

<style>
  .print-page {
    max-width: 48rem;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    color: var(--text-main);
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 2px solid var(--border-strong);
    margin-bottom: var(--space-6);
  }
  .ludo {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .head h1 {
    margin: var(--space-1) 0;
    font-size: var(--text-h1);
    font-weight: var(--weight-bold);
  }
  .meta {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .empty {
    color: var(--text-muted);
  }
  .checklist {
    width: 100%;
    border-collapse: collapse;
  }
  .checklist th {
    text-align: left;
    font-size: var(--text-small);
    color: var(--text-muted);
    font-weight: var(--weight-semibold);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border);
  }
  .checklist td {
    padding: var(--space-3);
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  .col-check {
    width: 2.5rem;
  }
  .col-qty {
    width: 4rem;
    color: var(--text-muted);
  }
  .col-note {
    width: 8rem;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .box {
    display: inline-block;
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid var(--border-strong);
    border-radius: var(--radius-sm);
  }
  .count {
    margin-top: var(--space-4);
    color: var(--text-muted);
    font-size: var(--text-small);
  }

  /* Rendu impression : on force un fond blanc et de l'encre noire (exception
     assumée à la règle « tokens uniquement », justifiée par le contexte print),
     on masque les contrôles d'écran et on resserre les marges. */
  @media print {
    :global(body) {
      background: #fff;
      color: #000;
    }
    .print-page {
      max-width: none;
      padding: 0;
      color: #000;
    }
    :global(.no-print) {
      display: none !important;
    }
    .box {
      border-color: #000;
    }
    .checklist td,
    .checklist th {
      border-color: #999;
    }
    tr {
      break-inside: avoid;
    }
  }
</style>
