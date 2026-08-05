<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { EmptyState } from '$lib/components/ui/empty-state/index.js'
  import { toastEnhance } from '$lib/utils/enhance.js'
  import InboxIcon from '@lucide/svelte/icons/inbox'
  let { data } = $props()
  let pending = $state<string | null>(null)
  const labels = { new: 'À traiter', processed: 'Traité', archived: 'Archivé' } as const
  const recipients = {
    paquis: 'Pâquis',
    secheron: 'Sécheron',
    general: 'Demande générale',
  } as const
  function recipientLabel(item: { recipient?: keyof typeof recipients }) {
    return recipients[item.recipient ?? 'general']
  }
</script>

<svelte:head><title>Messages reçus · {data.ludo.name}</title></svelte:head>
<main>
  <header>
    <div>
      <p>Site public</p>
      <h1>Messages reçus</h1>
      <span>Les coordonnées restent privées et ne sont visibles que dans le détail.</span>
    </div>
  </header>
  {#if page.form && 'error' in page.form && page.form.error}<p class="error">
      {page.form.error}
    </p>{/if}{#if !data.messages.length}<EmptyState
      icon={InboxIcon}
      title="Aucun message"
      description="Les demandes reçues apparaîtront ici."
    />{:else}<div class="list">
      {#each data.messages as item (item.id)}<article>
          <details>
            <summary
              ><span
                ><strong>{item.subject || 'Demande de contact'}</strong><small
                  >{recipientLabel(item)} · {new Date(item.createdAt).toLocaleString(
                    'fr-CH',
                  )}</small
                ></span
              ><Badge variant={item.status === 'new' ? 'warning' : 'secondary'}
                >{labels[item.status]}</Badge
              ></summary
            >
            <div class="detail">
              <p><strong>Destinataire :</strong> {recipientLabel(item)}</p>
              <dl>
                <div>
                  <dt>Nom</dt>
                  <dd>{item.name}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd><a href={`mailto:${item.email}`}>{item.email}</a></dd>
                </div>
                {#if item.phone}<div>
                    <dt>Téléphone</dt>
                    <dd><a href={`tel:${item.phone}`}>{item.phone}</a></dd>
                  </div>{/if}
              </dl>
              <p class="message">{item.message}</p>
            </div>
          </details>
          <footer>
            {#if item.status !== 'processed'}<form
                method="POST"
                action="?/transition"
                use:enhance={toastEnhance({
                  success: 'Message marqué comme traité.',
                  onPending: (v) => (pending = v ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="status" value="processed" /><Button
                  type="submit"
                  size="sm"
                  disabled={pending === item.id}>Marquer traité</Button
                >
              </form>{/if}{#if item.status !== 'archived'}<form
                method="POST"
                action="?/transition"
                use:enhance={toastEnhance({
                  success: 'Message archivé.',
                  onPending: (v) => (pending = v ? item.id : null),
                })}
              >
                <input type="hidden" name="id" value={item.id} /><input
                  type="hidden"
                  name="revision"
                  value={item.revision}
                /><input type="hidden" name="status" value="archived" /><Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={pending === item.id}>Archiver</Button
                >
              </form>{/if}
          </footer>
        </article>{/each}
    </div>{/if}
</main>

<style>
  main {
    max-width: var(--max-content);
    margin: auto;
    padding: var(--space-8) var(--space-6);
  }
  header {
    margin-bottom: var(--space-6);
  }
  h1,
  p {
    margin: 0;
  }
  .list {
    display: grid;
    gap: var(--space-3);
  }
  article {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-card);
  }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    cursor: pointer;
  }
  summary span {
    display: grid;
    gap: var(--space-1);
  }
  small {
    color: var(--text-muted);
  }
  .detail {
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-4);
  }
  dl {
    display: flex;
    gap: var(--space-6);
    margin: 0;
  }
  dt {
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  dd {
    margin: 0;
  }
  .message {
    padding: var(--space-4);
    background: var(--bg-muted);
    white-space: pre-wrap;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding-top: var(--space-4);
  }
  .error {
    padding: var(--space-3);
    background: var(--danger-light);
    color: var(--danger);
  }
</style>
