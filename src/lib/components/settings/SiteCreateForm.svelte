<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance'
  import type { OpeningHourInput } from '$lib/utils/opening-hours.js'
  import OpeningHoursEditor from './OpeningHoursEditor.svelte'

  let { oncreated = () => {} }: { oncreated?: () => void } = $props()
  let openingHours = $state<OpeningHourInput[]>([])
  let saving = $state(false)
</script>

<section class="create" aria-labelledby="create-site-title">
  <h3 id="create-site-title">Nouveau lieu</h3>
  <form
    method="POST"
    action="?/create"
    use:enhance={toastEnhance({
      success: 'Lieu créé.',
      errorMode: 'inline',
      onPending: (pending) => (saving = pending),
      onSuccess: oncreated,
    })}
  >
    <input type="hidden" name="openingHours" value={JSON.stringify(openingHours)} />

    <fieldset>
      <legend>Coordonnées du lieu</legend>
      <div class="grid">
        <div class="field"><Label for="create-name">Nom du lieu</Label><Input id="create-name" name="name" required placeholder="Ex. Pâquis" /></div>
        <div class="field"><Label for="create-slug">Identifiant technique</Label><Input id="create-slug" name="slug" required placeholder="Ex. paquis" /></div>
      </div>
      <div class="field"><Label for="create-address">Adresse</Label><Input id="create-address" name="address" /></div>
      <div class="grid postal-grid">
        <div class="field"><Label for="create-postal">Code postal</Label><Input id="create-postal" name="postalCode" inputmode="numeric" /></div>
        <div class="field"><Label for="create-city">Ville</Label><Input id="create-city" name="city" /></div>
      </div>
      <div class="grid">
        <div class="field"><Label for="create-phone">Téléphone</Label><Input id="create-phone" name="phone" type="tel" /></div>
        <div class="field"><Label for="create-email">E-mail</Label><Input id="create-email" name="email" type="email" /></div>
      </div>
      <div class="field"><Label for="create-access">Informations d’accès et transports</Label><textarea id="create-access" name="accessInfo" rows="3"></textarea></div>
      <div class="field">
        <Label for="create-directions">Lien Google Maps</Label>
        <Input id="create-directions" name="directionsUrl" type="url" inputmode="url" placeholder="Collez le lien partagé depuis Google Maps" />
        <p>Facultatif. Sans lien, un itinéraire est créé à partir de l’adresse.</p>
      </div>
      <div class="toggles">
        <label><input type="checkbox" name="isPrimary" /> Lieu principal</label>
        <label><input type="checkbox" name="isActive" checked /> Visible et actif</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Horaires hebdomadaires</legend>
      <p>Ajoutez plusieurs plages pour indiquer une fermeture à midi.</p>
      <OpeningHoursEditor bind:value={openingHours} />
    </fieldset>

    <div class="actions"><Button type="submit" disabled={saving}>{saving ? 'Création…' : 'Créer le lieu'}</Button></div>
  </form>
</section>

<style>
  .create { margin-bottom: var(--space-5); padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-card); }
  h3 { margin: 0 0 var(--space-5); color: var(--text-main); }
  form, fieldset, .field { display: flex; flex-direction: column; }
  form { gap: var(--space-6); }
  fieldset { margin: 0; padding: 0; border: 0; gap: var(--space-4); }
  legend { margin-bottom: var(--space-1); color: var(--text-main); font-weight: var(--weight-bold); }
  .field { gap: var(--space-2); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  .postal-grid { grid-template-columns: minmax(7rem, .35fr) 1fr; }
  textarea { width: 100%; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); font: inherit; resize: vertical; }
  p { margin: calc(var(--space-3) * -1) 0 0; color: var(--text-muted); font-size: var(--text-small); }
  .toggles, .actions { display: flex; gap: var(--space-4); }
  .toggles label { display: flex; align-items: center; gap: var(--space-2); color: var(--text-main); font-size: var(--text-small); }
  .actions { justify-content: flex-end; }
  @media (max-width: 640px) { .grid, .postal-grid { grid-template-columns: 1fr; } .create { padding: var(--space-4); } }
</style>
