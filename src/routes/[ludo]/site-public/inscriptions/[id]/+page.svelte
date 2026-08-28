<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  let { data } = $props()
  let pending = $state(false)
  const item = $derived(data.registration)
  const base = $derived(`/${data.ludo.slug}/site-public/inscriptions`)
  const labels = {
    received: 'Reçue',
    waitlisted: 'Liste d’attente',
    confirmed: 'Confirmée',
    declined: 'Refusée',
    cancelled: 'Annulée',
    archived: 'Archivée',
  } as const
</script>

<svelte:head><title>Inscription · {item.activity.title}</title></svelte:head>
<main class="detail-page">
  <a class="back" href={base}
    ><ArrowLeftIcon size={18} aria-hidden="true" /> Retour aux inscriptions</a
  >
  <header>
    <div>
      <Badge
        variant={item.status === 'confirmed'
          ? 'success'
          : item.status === 'received' || item.status === 'waitlisted'
            ? 'warning'
            : 'secondary'}>{labels[item.status]}</Badge
      >
      <h1>{item.activity.title}</h1>
      <p>Demande reçue le {new Date(item.createdAt).toLocaleString('fr-CH')}</p>
    </div>
  </header>
  <section>
    <h2>Coordonnées</h2>
    <dl>
      <div>
        <dt>Nom</dt>
        <dd>{item.contactName}</dd>
      </div>
      <div>
        <dt>E-mail</dt>
        <dd><a href={`mailto:${item.email}`}>{item.email}</a></dd>
      </div>
      {#if item.phone}<div>
          <dt>Téléphone</dt>
          <dd><a href={`tel:${item.phone}`}>{item.phone}</a></dd>
        </div>{/if}
      <div>
        <dt>Participants</dt>
        <dd>{item.participantCount}</dd>
      </div>
    </dl>
    {#if item.message}<div class="message">
        <strong>Message</strong>
        <p>{item.message}</p>
      </div>{/if}
  </section>
  <section>
    <h2>Décision</h2>
    <p>Choisissez le nouveau statut de cette inscription.</p>
    <form
      method="POST"
      action="?/registrationStatus"
      use:enhance={toastEnhance({
        success: 'Statut de l’inscription mis à jour.',
        onPending: (value) => (pending = value),
      })}
    >
      <input type="hidden" name="id" value={item.id} /><input
        type="hidden"
        name="revision"
        value={item.revision}
      /><label
        ><span>Nouveau statut</span><select name="status" disabled={pending}
          >{#each Object.entries(labels) as [value, label]}<option
              {value}
              selected={item.status === value}>{label}</option
            >{/each}</select
        ></label
      ><Button type="submit" disabled={pending}
        >{pending ? 'Enregistrement…' : 'Enregistrer le statut'}</Button
      >
    </form>
  </section>
</main>

<style>
  .detail-page {
    display: grid;
    max-width: 820px;
    margin: 0 auto;
    padding: var(--space-3) var(--space-6) var(--space-12);
    gap: var(--space-5);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    width: fit-content;
    color: var(--primary);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    margin-top: var(--space-3);
    color: var(--text-main);
    font-size: var(--text-h1);
  }
  header p,
  section > p {
    margin-top: var(--space-2);
    color: var(--text-muted);
  }
  section {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-card);
    box-shadow: var(--shadow-sm);
  }
  h2 {
    font-size: var(--text-h2);
  }
  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    margin: 0;
  }
  dl div {
    display: grid;
    gap: var(--space-1);
  }
  dt,
  label span {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  dd {
    margin: 0;
    font-weight: var(--weight-semibold);
  }
  .message {
    padding: var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--bg-hover);
  }
  .message p {
    margin-top: var(--space-2);
    white-space: pre-wrap;
  }
  form {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }
  label {
    display: grid;
    flex: 1;
    gap: var(--space-1);
  }
  select {
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
  }
  @media (max-width: 640px) {
    .detail-page {
      padding: var(--space-3) var(--space-4) var(--space-10);
    }
    section {
      padding: var(--space-4);
    }
    dl {
      grid-template-columns: 1fr;
    }
    form {
      align-items: stretch;
      flex-direction: column;
    }
    form :global(button) {
      width: 100%;
    }
  }
</style>
