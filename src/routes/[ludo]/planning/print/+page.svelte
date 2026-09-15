<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import PrinterIcon from '@lucide/svelte/icons/printer'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import { formatDayWeekday } from '$lib/utils/dates.js'

  let { data } = $props()

  const statusFor = (slot: (typeof data.months)[number]['slots'][number]) => {
    if (slot.closure) return `Fermé — ${slot.closure.label}`
    if (slot.isCancelled) return 'Fermé'
    return 'Ouvert'
  }
  const filledCount = (slot: (typeof data.months)[number]['slots'][number]) =>
    slot.assignments.filter((assignment) => !assignment.absence).length
  const isMine = (slot: (typeof data.months)[number]['slots'][number]) =>
    !slot.closure &&
    !slot.isCancelled &&
    slot.assignments.some((assignment) => assignment.member.id === data.currentMemberId)
</script>

<svelte:head>
  <title>Planning — {data.season.name}</title>
</svelte:head>

<main class="print-page">
  <header class="head">
    <div>
      <p class="ludo">{data.ludoName}</p>
      <h1>Planning des samedis</h1>
      <p class="meta">
        {data.season.name} · préparé pour {data.currentMemberName} · {data.printedAt}
      </p>
    </div>
    <div class="actions no-print">
      <Button href="../" variant="outline"><ArrowLeftIcon aria-hidden="true" /> Planning</Button>
      <Button onclick={() => window.print()}><PrinterIcon aria-hidden="true" /> Imprimer</Button>
    </div>
  </header>

  <p class="legend"><span class="legend-mark"></span> Mes samedis de service</p>

  {#each data.months as month (month.key)}
    <section class="month">
      <table>
        <thead>
          <tr class="month-title"><th colspan="4">{month.label}</th></tr>
          <tr class="columns">
            <th>Date</th>
            <th>Équipe</th>
            <th>Effectif</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {#each month.slots as slot (slot.id)}
            {@const mine = isMine(slot)}
            <tr class:mine>
              <td class="date">
                <strong>{formatDayWeekday(slot.date)}</strong>
                {#if mine}<span class="mine-label">Mon service</span>{/if}
              </td>
              <td class="team">
                {#if slot.closure || slot.isCancelled}
                  —
                {:else}
                  {#each slot.assignments as assignment, index (assignment.id)}
                    <span
                      class:me={assignment.member.id === data.currentMemberId}
                      class:absent={!!assignment.absence}
                    >
                      {assignment.member.name}{assignment.absence ? ' (absent·e)' : ''}{index <
                      slot.assignments.length - 1
                        ? ', '
                        : ''}
                    </span>
                  {/each}
                {/if}
              </td>
              <td class="count"
                >{slot.closure || slot.isCancelled
                  ? '—'
                  : `${filledCount(slot)}/${slot.requiredCount}`}</td
              >
              <td class="status">{statusFor(slot)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/each}
</main>

<style>
  .print-page {
    max-width: 62rem;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    color: var(--text-main);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    align-items: flex-start;
    border-bottom: 2px solid var(--border-strong);
    padding-bottom: var(--space-4);
  }
  .ludo {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  h1 {
    margin: var(--space-1) 0;
    font-size: var(--text-h1);
  }
  .meta,
  .legend {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-5) 0 var(--space-3);
  }
  .legend-mark {
    width: 0.8rem;
    height: 0.8rem;
    background: var(--ludo-color);
    border-radius: var(--radius-sm);
    box-shadow: inset 3px 0 0 color-mix(in srgb, var(--ludo-color) 65%, black);
  }
  .month {
    margin-top: var(--space-5);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th,
  td {
    text-align: left;
    vertical-align: middle;
    padding: var(--space-3);
    border-bottom: 1px solid var(--border);
  }
  .month-title th {
    padding: var(--space-2) var(--space-3);
    background: var(--bg-sidebar);
    color: var(--text-subtle);
    font-size: var(--text-small);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .columns th {
    color: var(--text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
  }
  .date {
    width: 25%;
    text-transform: capitalize;
  }
  .team {
    width: 43%;
  }
  .count {
    width: 12%;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .status {
    width: 20%;
    color: var(--text-muted);
  }
  tr.mine td {
    background: color-mix(in srgb, var(--ludo-color) 12%, white);
  }
  tr.mine td:first-child {
    box-shadow: inset 4px 0 0 var(--ludo-color);
  }
  .mine-label {
    display: block;
    width: fit-content;
    margin-top: var(--space-1);
    color: color-mix(in srgb, var(--ludo-color) 65%, black);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .me {
    font-weight: var(--weight-bold);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }
  .absent {
    color: var(--danger);
    text-decoration: line-through;
  }

  @media (max-width: 639px) {
    .head {
      flex-direction: column;
    }
    .actions {
      justify-content: flex-start;
    }
    .print-page {
      padding: var(--space-6) var(--space-4);
    }
    th,
    td {
      padding: var(--space-2);
    }
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    :global(body) {
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page {
      max-width: none;
      padding: 0;
      color: #000;
    }
    .no-print {
      display: none !important;
    }
    .head {
      margin-bottom: 4mm;
    }
    .month {
      margin-top: 5mm;
    }
    .legend {
      margin: 3mm 0;
    }
    .month-title th {
      background: #efefef;
      color: #000;
    }
    .columns th {
      color: #333;
    }
    th,
    td {
      padding: 2.5mm;
      border-color: #b5b5b5;
    }
    thead {
      display: table-header-group;
    }
    tr,
    .month-title,
    .columns {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .month-title,
    .columns {
      break-after: avoid;
      page-break-after: avoid;
    }
    tr.mine td {
      background: #e8f2ff;
    }
    tr.mine td:first-child {
      box-shadow: inset 3px 0 0 #2368a2;
    }
    .mine-label {
      color: #174d78;
    }
    .status {
      color: #333;
    }
    .absent {
      color: #8a1f1f;
    }
  }
</style>
