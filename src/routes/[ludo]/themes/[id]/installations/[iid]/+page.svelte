<script lang="ts">
  import { enhance } from '$app/forms'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import CheckupHistory from '$lib/components/themes/CheckupHistory.svelte'
  import { formatDateShort } from '$lib/utils/dates.js'

  let { data, form } = $props()

  const inst = $derived(data.installation)
  const isOpen = $derived(inst.status === 'en_cours')
  const kitItems = $derived(inst.items)
  const problemItems = $derived(kitItems.filter((it) => it.condition !== 'present'))
</script>

<svelte:head>
  <title>Installation — {inst.theme.name}</title>
</svelte:head>

<main class="install">
  <header class="head">
    <a class="back" href="/{data.ludo.slug}/themes/{inst.themeId}">← {inst.theme.name}</a>
    <h1>
      Installation
      {#if isOpen}
        <Badge variant="secondary">En cours</Badge>
      {:else}
        <Badge variant="outline">Clôturée</Badge>
      {/if}
    </h1>
    <p class="muted">
      Installée le {formatDateShort(inst.installedAt)} par {inst.installedBy?.name ?? '—'} ·
      {kitItems.length} objet(s) dans le kit
      {#if !isOpen && inst.closedAt}· clôturée le {formatDateShort(inst.closedAt)}{/if}
    </p>
    {#if inst.notes}<p class="note">{inst.notes}</p>{/if}
  </header>

  {#if form?.error}
    <p class="banner-err" role="alert">{form.error}</p>
  {/if}

  <div class="columns">
    <section class="col">
      <div class="kit-head">
        <h2>État du kit</h2>
        {#if isOpen}
          <Button
            href="/{data.ludo.slug}/themes/{inst.themeId}/installations/{inst.id}/checkup"
            size="sm"
          >
            Faire un check-up
          </Button>
        {/if}
      </div>

      {#if problemItems.length === 0}
        <p class="muted">Tout est en ordre — aucun objet à traiter.</p>
      {:else}
        <ul class="problems">
          {#each problemItems as it (it.id)}
            <li class="problem">
              <div class="problem-info">
                <span class="problem-name">{it.themeItem.name}</span>
                {#if it.condition === 'a_reparer'}
                  <Badge variant="warning">À réparer</Badge>
                {:else}
                  <Badge variant="destructive">Manquant</Badge>
                {/if}
              </div>
              {#if isOpen}
                <div class="problem-actions">
                  {#if it.condition === 'a_reparer'}
                    <form method="POST" action="?/resolveItem" use:enhance>
                      <input type="hidden" name="itemId" value={it.id} />
                      <input type="hidden" name="resolution" value="repaired" />
                      <Button type="submit" variant="outline" size="sm">Réparé</Button>
                    </form>
                  {:else}
                    <form method="POST" action="?/resolveItem" use:enhance>
                      <input type="hidden" name="itemId" value={it.id} />
                      <input type="hidden" name="resolution" value="found" />
                      <Button type="submit" variant="outline" size="sm">Retrouvé</Button>
                    </form>
                    <AlertDialog.Root>
                      <AlertDialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                        Perdu définitivement
                      </AlertDialog.Trigger>
                      <AlertDialog.Content>
                        <AlertDialog.Header>
                          <AlertDialog.Title
                            >Objet perdu : « {it.themeItem.name} » ?</AlertDialog.Title
                          >
                          <AlertDialog.Description>
                            L'objet sera <strong>définitivement retiré du thème entier</strong> (kit installé
                            et catalogue du thème), pas seulement de cette installation. Action irréversible.
                          </AlertDialog.Description>
                        </AlertDialog.Header>
                        <form method="POST" action="?/resolveItem" use:enhance>
                          <input type="hidden" name="itemId" value={it.id} />
                          <input type="hidden" name="resolution" value="lost" />
                          <AlertDialog.Footer>
                            <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
                            <button
                              type="submit"
                              class={buttonVariants({ variant: 'destructive' })}
                            >
                              Retirer du thème
                            </button>
                          </AlertDialog.Footer>
                        </form>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      {#if !isOpen}
        <p class="muted">Installation clôturée : plus de check-up possible.</p>
      {/if}
    </section>

    <section class="col">
      <h2 class="hist-title">Historique des check-ups</h2>
      <CheckupHistory checkups={inst.checkups} />
    </section>
  </div>
</main>

<style>
  .install {
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
  }
  .head {
    margin-bottom: var(--space-6);
  }
  .back {
    color: var(--text-muted);
    text-decoration: none;
    font-size: var(--text-small);
  }
  h1 {
    color: var(--text-main);
    margin: var(--space-2) 0 var(--space-1);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  h2 {
    color: var(--text-main);
    font-size: var(--text-h2);
    font-weight: var(--weight-semibold);
    margin: 0;
  }
  .kit-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  /* Espace entre le titre et son tableau, aligné sur « État du kit ». */
  .hist-title {
    margin-bottom: var(--space-3);
  }
  .banner-err {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: var(--text-small);
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-8);
  }
  @media (max-width: 720px) {
    .columns {
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
  }
  .col {
    min-width: 0;
  }
  .problems {
    list-style: none;
    margin: 0 0 var(--space-3);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .problem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .problem-info {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .problem-name {
    color: var(--text-main);
    overflow-wrap: anywhere;
  }
  .problem-actions {
    display: flex;
    flex-shrink: 0;
    gap: var(--space-2);
  }
  .muted {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .note {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
</style>
