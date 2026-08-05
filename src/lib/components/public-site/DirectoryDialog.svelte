<script lang="ts" module>
  export type EditableDirectoryEntry = {
    id: string
    revision: number
    slug: string
    name: string
    descriptionMarkdown: string | null
    address: string | null
    postalCode: string | null
    city: string
    phone: string | null
    email: string | null
    website: string | null
    directionsUrl: string
    officialUrl: string
    sortOrder: number
    status: 'draft' | 'published' | 'hidden'
    publishedAt: Date | null
  }
</script>

<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  let {
    open = $bindable(false),
    entry = null,
  }: { open?: boolean; entry?: EditableDirectoryEntry | null } = $props()
  let name = $state(''),
    slug = $state(''),
    description = $state(''),
    address = $state(''),
    postalCode = $state(''),
    city = $state('Genève'),
    phone = $state(''),
    email = $state(''),
    website = $state(''),
    directionsUrl = $state(''),
    officialUrl = $state(''),
    sortOrder = $state(0),
    manual = $state(false),
    submitting = $state(false),
    submitError = $state('')
  const edit = $derived(entry !== null),
    slugEditable = $derived(!entry?.publishedAt)
  function slugify(v: string) {
    return v
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
  }
  function updateName(v: string) {
    name = v
    if (slugEditable && !manual) slug = slugify(v)
  }
  $effect(() => {
    if (!open) return
    name = entry?.name ?? ''
    slug = entry?.slug ?? ''
    description = entry?.descriptionMarkdown ?? ''
    address = entry?.address ?? ''
    postalCode = entry?.postalCode ?? ''
    city = entry?.city ?? 'Genève'
    phone = entry?.phone ?? ''
    email = entry?.email ?? ''
    website = entry?.website ?? ''
    directionsUrl = entry?.directionsUrl ?? ''
    officialUrl = entry?.officialUrl ?? ''
    sortOrder = entry?.sortOrder ?? 0
    manual = entry !== null
    submitError = ''
  })
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="directory-dialog"
    ><Dialog.Header
      ><Dialog.Title>{edit ? 'Modifier l’entrée' : 'Nouvelle entrée'}</Dialog.Title
      ><Dialog.Description>Informations publiques de l’annuaire genevois.</Dialog.Description
      ></Dialog.Header
    >
    <form
      method="POST"
      action={edit ? '?/update' : '?/create'}
      use:enhance={toastEnhance({
        success: edit ? 'Entrée mise à jour.' : 'Brouillon créé.',
        errorMode: 'inline',
        onPending: (v) => {
          submitting = v
          if (v) submitError = ''
        },
        onError: (m) => (submitError = m),
        onSuccess: () => (open = false),
      })}
    >
      {#if edit}<input type="hidden" name="id" value={entry?.id} /><input
          type="hidden"
          name="revision"
          value={entry?.revision}
        />{/if}
      <div class="field">
        <Label for="directory-name">Nom</Label><Input
          id="directory-name"
          name="name"
          value={name}
          oninput={(e) => updateName(e.currentTarget.value)}
          maxlength={180}
          required
        />
      </div>
      <div class="field">
        <Label for="directory-slug">Adresse de la page</Label>{#if slugEditable}<Input
            id="directory-slug"
            name="slug"
            value={slug}
            oninput={(e) => {
              slug = e.currentTarget.value
              manual = true
            }}
            maxlength={120}
            required
          />{:else}<code>/{entry?.slug}</code>{/if}
      </div>
      <div class="field">
        <Label for="directory-description">Description Markdown</Label><textarea
          id="directory-description"
          name="descriptionMarkdown"
          bind:value={description}
          maxlength="10000"
          rows="6"
        ></textarea>
      </div>
      <div class="field">
        <Label for="directory-address">Adresse</Label><Input
          id="directory-address"
          name="address"
          bind:value={address}
          maxlength={500}
        />
      </div>
      <div class="row">
        <div class="field">
          <Label for="directory-postal">NPA</Label><Input
            id="directory-postal"
            name="postalCode"
            bind:value={postalCode}
            maxlength={20}
          />
        </div>
        <div class="field">
          <Label for="directory-city">Ville</Label><Input
            id="directory-city"
            name="city"
            bind:value={city}
            maxlength={120}
            required
          />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <Label for="directory-phone">Téléphone</Label><Input
            id="directory-phone"
            name="phone"
            bind:value={phone}
            maxlength={50}
          />
        </div>
        <div class="field">
          <Label for="directory-email">E-mail</Label><Input
            id="directory-email"
            name="email"
            type="email"
            bind:value={email}
            maxlength={320}
          />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <Label for="directory-web">Site web</Label><Input
            id="directory-web"
            name="website"
            type="url"
            bind:value={website}
            maxlength={2000}
          />
        </div>
        <div class="field">
          <Label for="directory-order">Ordre</Label><Input
            id="directory-order"
            name="sortOrder"
            type="number"
            bind:value={sortOrder}
            min={0}
            step={1}
            required
          />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <Label for="directory-directions">Lien itinéraire</Label><Input
            id="directory-directions"
            name="directionsUrl"
            type="url"
            bind:value={directionsUrl}
            maxlength={2000}
            required
          />
        </div>
        <div class="field">
          <Label for="directory-official">Fiche Ville de Genève</Label><Input
            id="directory-official"
            name="officialUrl"
            type="url"
            bind:value={officialUrl}
            maxlength={2000}
            required
          />
        </div>
      </div>
      {#if submitError}<p class="error">{submitError}</p>{/if}<Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button
        ><Button
          type="submit"
          disabled={submitting ||
            !name.trim() ||
            !slug.trim() ||
            !city.trim() ||
            !directionsUrl.trim() ||
            !officialUrl.trim()}
          >{submitting ? 'Enregistrement…' : edit ? 'Enregistrer' : 'Créer le brouillon'}</Button
        ></Dialog.Footer
      >
    </form></Dialog.Content
  ></Dialog.Root
>

<style>
  :global(.directory-dialog) {
    max-width: 760px;
    max-height: 90vh;
    overflow-y: auto;
  }
  form,
  .field {
    display: grid;
    gap: var(--space-3);
  }
  form {
    gap: var(--space-5);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }
  textarea {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    font: inherit;
  }
  .error {
    padding: var(--space-3);
    background: var(--danger-light);
    color: var(--danger);
  }
  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
