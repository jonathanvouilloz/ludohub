<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance'
  import type { OpeningHourInput } from '$lib/utils/opening-hours.js'
  import OpeningHoursEditor from './OpeningHoursEditor.svelte'

  type EditableSite = {
    id: string
    slug: string
    name: string
    address: string | null
    postalCode: string | null
    city: string | null
    phone: string | null
    email: string | null
    accessInfo: string | null
    latitude: number | string | null
    longitude: number | string | null
    isPrimary: boolean
    isActive: boolean
    sortOrder: number
    openingHours: OpeningHourInput[]
  }

  let {
    site,
    multiSite = false,
    dirty = $bindable(false),
  }: { site: EditableSite; multiSite?: boolean; dirty?: boolean } = $props()
  let openingHours = $state<OpeningHourInput[]>([])
  let saving = $state(false)

  $effect.pre(() => {
    openingHours = site.openingHours.map((row) => ({ ...row }))
  })
</script>

<details class="editor" open={!multiSite || site.isPrimary}>
  <summary>
    <div>
      <span class="site-name">{site.name}</span>
      {#if site.isPrimary && multiSite}<span class="primary">Lieu principal</span>{/if}
      {#if !site.isActive}<span class="inactive">Masqué</span>{/if}
    </div>
    <span class="chevron"><ChevronDownIcon size={18} /></span>
  </summary>

  <form
    method="POST"
    action="?/update"
    data-dirty={dirty}
    oninput={() => (dirty = true)}
    use:enhance={toastEnhance({
      success: 'Lieu et horaires enregistrés.',
      errorMode: 'inline',
      onPending: (pending) => (saving = pending),
      onSuccess: () => (dirty = false),
      updateOptions: { reset: false },
    })}
  >
    <input type="hidden" name="siteId" value={site.id} />
    <input type="hidden" name="sortOrder" value={site.sortOrder} />
    <input type="hidden" name="openingHours" value={JSON.stringify(openingHours)} />

    <fieldset>
      <legend>Coordonnées du lieu</legend>
      <div class="field">
        <Label for={`name-${site.id}`}>Nom du lieu</Label>
        <Input id={`name-${site.id}`} name="name" value={site.name} required />
      </div>

      <div class="field">
        <Label for={`slug-${site.id}`}>Identifiant technique</Label>
        <Input id={`slug-${site.id}`} name="slug" value={site.slug} readonly />
        <p class="field-hint">Conservé pour la compatibilité des anciennes fréquentations.</p>
      </div>

      <div class="field">
        <Label for={`address-${site.id}`}>Adresse</Label>
        <Input id={`address-${site.id}`} name="address" value={site.address ?? ''} />
      </div>

      <div class="grid postal-grid">
        <div class="field">
          <Label for={`postal-${site.id}`}>Code postal</Label>
          <Input
            id={`postal-${site.id}`}
            name="postalCode"
            inputmode="numeric"
            value={site.postalCode ?? ''}
          />
        </div>
        <div class="field">
          <Label for={`city-${site.id}`}>Ville</Label>
          <Input id={`city-${site.id}`} name="city" value={site.city ?? ''} />
        </div>
      </div>

      <div class="grid">
        <div class="field">
          <Label for={`phone-${site.id}`}>Téléphone</Label>
          <Input id={`phone-${site.id}`} name="phone" type="tel" value={site.phone ?? ''} />
        </div>
        <div class="field">
          <Label for={`email-${site.id}`}>Email</Label>
          <Input id={`email-${site.id}`} name="email" type="email" value={site.email ?? ''} />
        </div>
      </div>

      <div class="field">
        <Label for={`access-${site.id}`}>Informations d’accès</Label>
        <textarea
          id={`access-${site.id}`}
          name="accessInfo"
          rows="3"
          placeholder="Entrée, étage, transports publics…">{site.accessInfo ?? ''}</textarea
        >
      </div>

      <details class="optional">
        <summary>Coordonnées géographiques (facultatif)</summary>
        <div class="grid optional-fields">
          <div class="field">
            <Label for={`latitude-${site.id}`}>Latitude</Label>
            <Input
              id={`latitude-${site.id}`}
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={site.latitude ?? ''}
            />
          </div>
          <div class="field">
            <Label for={`longitude-${site.id}`}>Longitude</Label>
            <Input
              id={`longitude-${site.id}`}
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={site.longitude ?? ''}
            />
          </div>
        </div>
      </details>

      {#if multiSite}
        <div class="toggles">
          <label
            ><input type="checkbox" name="isPrimary" checked={site.isPrimary} /> Lieu principal</label
          >
          <label
            ><input type="checkbox" name="isActive" checked={site.isActive} /> Visible et actif</label
          >
        </div>
      {:else}
        <input type="hidden" name="isPrimary" value="on" />
        <input type="hidden" name="isActive" value="on" />
      {/if}
    </fieldset>

    <fieldset>
      <legend>Horaires hebdomadaires</legend>
      <p class="hint">Ajoutez plusieurs plages pour indiquer une fermeture à midi.</p>
      <OpeningHoursEditor bind:value={openingHours} onDirty={() => (dirty = true)} />
    </fieldset>

    <div class="actions">
      <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
    </div>
  </form>
</details>

<style>
  .editor {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    overflow: clip;
  }
  .editor > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    cursor: pointer;
    list-style: none;
  }
  .editor > summary::-webkit-details-marker {
    display: none;
  }
  .editor[open] > summary {
    border-bottom: 1px solid var(--border);
  }
  .editor[open] .chevron {
    transform: rotate(180deg);
  }
  .chevron {
    color: var(--text-muted);
    transition: transform var(--dur-fast) var(--ease-out-strong);
  }
  .site-name {
    color: var(--text-main);
    font-weight: var(--weight-bold);
  }
  .primary,
  .inactive {
    margin-left: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--success-light);
    color: var(--success);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
  }
  .inactive {
    background: var(--warning-light);
    color: var(--warning);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-5);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  legend {
    margin-bottom: var(--space-4);
    color: var(--text-main);
    font-size: var(--text-body);
    font-weight: var(--weight-bold);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }
  .postal-grid {
    grid-template-columns: minmax(7rem, 0.35fr) 1fr;
  }
  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    resize: vertical;
  }
  textarea:focus-visible {
    outline: 2px solid var(--ludo-color);
    outline-offset: 2px;
  }
  .optional {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--bg-hover);
  }
  .optional summary {
    color: var(--text-muted);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
  .optional-fields {
    margin-top: var(--space-3);
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }
  .toggles label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-main);
    font-size: var(--text-small);
  }
  .hint {
    margin: calc(var(--space-3) * -1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .field-hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-label);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 640px) {
    .grid,
    .postal-grid {
      grid-template-columns: 1fr;
    }
    form {
      padding: var(--space-4);
    }
  }
</style>
