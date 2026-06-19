<script lang="ts">
  // Aperçu « boîte de réception » : reproduit une ligne d'inbox (façon Gmail) pour
  // visualiser objet + texte d'aperçu tels qu'ils apparaîtront avant ouverture.
  // 100 % réactif Svelte (pas d'iframe) → mise à jour instantanée sans flicker.
  let {
    sender,
    subject,
    previewText,
    color = '#0073e6',
  }: {
    sender: string
    subject: string
    previewText: string
    color?: string
  } = $props()

  const initial = $derived((sender.trim().charAt(0) || '?').toUpperCase())
</script>

<div class="inbox">
  <div class="avatar" style="background:{color};">{initial}</div>
  <div class="content">
    <div class="line-top">
      <span class="sender">{sender || 'Ludothèque'}</span>
      <span class="time">maintenant</span>
    </div>
    <div class="line-sub">
      {#if subject}
        <span class="subject">{subject}</span>
      {:else}
        <span class="subject empty">(objet vide)</span>
      {/if}
      {#if previewText}
        <span class="preview"> — {previewText}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .inbox {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .avatar {
    flex: none;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: var(--weight-bold);
    font-size: var(--text-body);
  }
  .content {
    flex: 1;
    min-width: 0;
  }
  .line-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .sender {
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    font-size: var(--text-body);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .time {
    flex: none;
    color: var(--text-muted);
    font-size: var(--text-small);
  }
  .line-sub {
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--text-small);
  }
  .subject {
    font-weight: var(--weight-medium);
    color: var(--text-main);
  }
  .subject.empty {
    font-style: italic;
    font-weight: var(--weight-normal);
    color: var(--text-muted);
  }
  .preview {
    color: var(--text-muted);
  }
</style>
