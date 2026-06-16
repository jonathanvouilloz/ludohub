<script lang="ts">
  import type { LudothequeRow, MemberRow } from '$lib/server/schema.js'

  let {
    ludo,
    member,
    compact = false,
  }: { ludo: LudothequeRow; member: MemberRow; compact?: boolean } = $props()
</script>

<div class="ludo-badge" class:ludo-badge--compact={compact}>
  <span class="dot" style="background: var(--ludo-color)" aria-hidden="true"></span>
  {#if !compact}
    <span class="meta">
      <span class="ludo-name">{ludo.name}</span>
      <span class="member-name">{member.name}</span>
    </span>
  {/if}
</div>

<style>
  .ludo-badge {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .ludo-badge--compact {
    justify-content: center;
  }
  .dot {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: var(--radius-pill);
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ludo-name {
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .member-name {
    font-size: var(--text-small);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
