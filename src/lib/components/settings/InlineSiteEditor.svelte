<script lang="ts">
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
    directionsUrl: string | null
    latitude: number | string | null
    longitude: number | string | null
    isPrimary: boolean
    isActive: boolean
    openingHours: OpeningHourInput[]
  }

  let {
    site,
    onDone,
    onCancel,
  }: { site: EditableSite; onDone: () => void; onCancel: () => void } = $props()
  let openingHours = $state<OpeningHourInput[]>([])
  let initialized = $state(false)
  let saving = $state(false)

  $effect(() => {
    if (initialized) return
    openingHours = site.openingHours.map((row) => ({ ...row }))
    initialized = true
  })
</script>

<form
  class="editor"
  method="POST"
  action="?/update"
  use:enhance={toastEnhance({
    success: 'Lieu et horaires enregistrés.',
    errorMode: 'inline',
    onPending: (pending) => (saving = pending),
    onSuccess: () => onDone(),
    updateOptions: { reset: false },
  })}
>
  <input type="hidden" name="siteId" value={site.id} />
  <input type="hidden" name="slug" value={site.slug} />
  <input type="hidden" name="openingHours" value={JSON.stringify(openingHours)} />
  <input type="hidden" name="latitude" value={site.latitude ?? ''} />
  <input type="hidden" name="longitude" value={site.longitude ?? ''} />
  {#if site.isPrimary}<input type="hidden" name="isPrimary" value="on" />{/if}
  {#if site.isActive}<input type="hidden" name="isActive" value="on" />{/if}

  <fieldset>
    <legend>Informations du lieu</legend>
    <div class="field">
      <Label for={`name-${site.id}`}>Nom du lieu</Label>
      <Input id={`name-${site.id}`} name="name" value={site.name} required />
    </div>

    <div class="field">
      <Label for={`address-${site.id}`}>Adresse</Label>
      <Input id={`address-${site.id}`} name="address" value={site.address ?? ''} />
    </div>

    <div class="grid postal-grid">
      <div class="field">
        <Label for={`postal-${site.id}`}>Code postal</Label>
        <Input id={`postal-${site.id}`} name="postalCode" inputmode="numeric" value={site.postalCode ?? ''} />
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
        <Label for={`email-${site.id}`}>E-mail</Label>
        <Input id={`email-${site.id}`} name="email" type="email" value={site.email ?? ''} />
      </div>
    </div>

    <div class="field">
      <Label for={`access-${site.id}`}>Informations d’accès et transports</Label>
      <textarea
        id={`access-${site.id}`}
        name="accessInfo"
        rows="3"
        placeholder="Entrée, étage, transports publics…">{site.accessInfo ?? ''}</textarea
      >
    </div>

    <div class="field">
      <Label for={`directions-${site.id}`}>Lien Google Maps</Label>
      <Input
        id={`directions-${site.id}`}
        name="directionsUrl"
        type="url"
        inputmode="url"
        value={site.directionsUrl ?? ''}
        placeholder="Collez le lien partagé depuis Google Maps"
      />
      <p class="hint">Facultatif. S’il est vide, un itinéraire est créé automatiquement depuis l’adresse.</p>
    </div>
  </fieldset>

  <fieldset>
    <legend>Horaires hebdomadaires</legend>
    <p class="hint">Ajoutez une seconde plage en cas de fermeture à midi. Les heures se règlent par quarts d’heure.</p>
    <OpeningHoursEditor bind:value={openingHours} />
  </fieldset>

  <div class="actions">
    <Button type="button" variant="outline" onclick={onCancel} disabled={saving}>Annuler</Button>
    <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le lieu'}</Button>
  </div>
</form>

<style>
  .editor {
    display: grid;
    gap: var(--space-5);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-3);
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-bold);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .postal-grid { grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr); }
  .field { display: grid; gap: var(--space-1); margin-bottom: var(--space-3); }
  .field:last-child { margin-bottom: 0; }
  textarea {
    width: 100%;
    min-height: 84px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-main);
    font: inherit;
    resize: vertical;
  }
  .hint { margin: var(--space-1) 0 0; color: var(--text-muted); font-size: var(--text-label); }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
  @media (max-width: 560px) {
    .grid, .postal-grid { grid-template-columns: 1fr; }
    .actions { justify-content: stretch; }
    .actions :global(button) { flex: 1; }
  }
</style>
