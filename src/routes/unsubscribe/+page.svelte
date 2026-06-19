<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import MailXIcon from '@lucide/svelte/icons/mail-x'
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2'

  let { data, form } = $props()

  // L'état devient « done » dès que l'action a réussi (form?.success).
  const done = $derived(data.state === 'done' || form?.success === true)
  const invalid = $derived(data.state === 'invalid')
  let submitting = $state(false)
</script>

<svelte:head>
  <title>Désabonnement</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="unsub">
  <div class="card">
    {#if invalid}
      <MailXIcon class="icon icon-muted" aria-hidden="true" />
      <h1>Lien invalide</h1>
      <p>Ce lien de désabonnement n'est plus valable. Aucune action n'est nécessaire.</p>
    {:else if done}
      <CheckCircle2Icon class="icon icon-ok" aria-hidden="true" />
      <h1>Vous êtes désabonné·e</h1>
      <p>
        {#if data.email}<strong>{data.email}</strong> ne recevra plus{:else}Vous ne recevrez plus{/if}
        nos newsletters. Vous pouvez fermer cette page.
      </p>
    {:else}
      <MailXIcon class="icon icon-muted" aria-hidden="true" />
      <h1>Se désabonner</h1>
      <p>
        Confirmez le désabonnement de
        {#if data.email}<strong>{data.email}</strong>{:else}cette adresse{/if}. Vous ne recevrez
        plus nos communications par email.
      </p>
      {#if form?.error}
        <p class="error" role="alert">{form.error}</p>
      {/if}
      <form
        method="POST"
        use:enhance={() => {
          submitting = true
          return async ({ update }) => {
            await update()
            submitting = false
          }
        }}
      >
        <Button type="submit" variant="destructive" disabled={submitting}>
          {submitting ? 'Traitement…' : 'Confirmer le désabonnement'}
        </Button>
      </form>
    {/if}
  </div>
</main>

<style>
  .unsub {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    background: var(--bg-base, #f0f0f0);
  }
  .card {
    max-width: 28rem;
    width: 100%;
    text-align: center;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, var(--radius-md));
    padding: var(--space-8) var(--space-6);
  }
  :global(.unsub .icon) {
    width: 2.5rem;
    height: 2.5rem;
    margin: 0 auto var(--space-3);
  }
  :global(.unsub .icon-ok) {
    color: var(--success, #1a7f4b);
  }
  :global(.unsub .icon-muted) {
    color: var(--text-muted);
  }
  h1 {
    color: var(--text-main);
    font-size: var(--text-h2);
    margin: 0 0 var(--space-2);
  }
  p {
    color: var(--text-muted);
    margin: 0 0 var(--space-4);
    line-height: 1.6;
  }
  .error {
    color: var(--danger);
    font-size: var(--text-small);
  }
  form {
    margin-top: var(--space-2);
  }
</style>
