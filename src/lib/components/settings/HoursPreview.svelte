<script lang="ts">
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import PhoneIcon from '@lucide/svelte/icons/phone'
  import MailIcon from '@lucide/svelte/icons/mail'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { Button } from '$lib/components/ui/button/index.js'
  import { WEEK_DAYS, formatTime, type OpeningHourInput } from '$lib/utils/opening-hours.js'
  import InlineOpeningHoursEditor from './InlineOpeningHoursEditor.svelte'

  type PreviewSite = {
    id: string
    name: string
    address: string | null
    postalCode: string | null
    city: string | null
    phone: string | null
    email: string | null
    accessInfo: string | null
    openingHours: OpeningHourInput[]
  }

  let {
    sites,
    editable = false,
  }: { sites: PreviewSite[]; editable?: boolean } = $props()
  let editingSiteId = $state<string | null>(null)

  function ranges(site: PreviewSite, dayOfWeek: number): string {
    const rows = site.openingHours.filter((row) => row.dayOfWeek === dayOfWeek)
    return rows.length
      ? rows.map((row) => `${formatTime(row.opensAt)}–${formatTime(row.closesAt)}`).join(', ')
      : 'Fermé'
  }

  function address(site: PreviewSite): string {
    return [site.address, [site.postalCode, site.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ')
  }
</script>

<div class="preview-grid">
  {#each sites as site (site.id)}
    <article class="preview-card">
      <div class="preview-head">
        <div>
          <p class="eyebrow">Ludothèque</p>
          <h3>{site.name}</h3>
        </div>
        {#if editable && editingSiteId !== site.id}
          <Button size="sm" variant="outline" onclick={() => (editingSiteId = site.id)}>
            <PencilIcon size={15} aria-hidden="true" /> Modifier les horaires
          </Button>
        {/if}
      </div>

      {#if address(site)}
        <p class="contact"><MapPinIcon size={16} /> {address(site)}</p>
      {/if}
      {#if site.phone}<p class="contact"><PhoneIcon size={16} /> {site.phone}</p>{/if}
      {#if site.email}<p class="contact"><MailIcon size={16} /> {site.email}</p>{/if}

      {#if editingSiteId === site.id}
        <InlineOpeningHoursEditor
          siteId={site.id}
          openingHours={site.openingHours}
          onDone={() => (editingSiteId = null)}
          onCancel={() => (editingSiteId = null)}
        />
      {:else}
        <dl>
          {#each WEEK_DAYS as day (day.value)}
            <div>
              <dt>{day.label}</dt>
              <dd class:closed={ranges(site, day.value) === 'Fermé'}>{ranges(site, day.value)}</dd>
            </div>
          {/each}
        </dl>
      {/if}

      {#if site.accessInfo}
        <p class="access"><strong>À savoir&nbsp;:</strong> {site.accessInfo}</p>
      {/if}
    </article>
  {/each}
</div>

<style>
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    align-items: start;
    max-width: 1100px;
    gap: var(--space-4);
  }
  .preview-card {
    height: fit-content;
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
  }
  .preview-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .eyebrow {
    margin: 0 0 var(--space-1);
    color: var(--ludo-color);
    font-size: var(--text-label);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  h3 {
    margin: 0;
    color: var(--text-main);
  }
  .contact {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  dl {
    margin: var(--space-5) 0 0;
  }
  dl div {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
  }
  dl div:last-child {
    border-bottom: 0;
  }
  dt,
  dd {
    margin: 0;
    color: var(--text-main);
    font-size: var(--text-small);
  }
  dd {
    font-weight: var(--weight-semibold);
    text-align: right;
  }
  dd.closed {
    color: var(--text-muted);
    font-weight: var(--weight-normal);
  }
  .access {
    margin: var(--space-4) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
    white-space: pre-line;
  }
  .access strong {
    color: var(--text-main);
    font-weight: var(--weight-semibold);
  }
</style>
