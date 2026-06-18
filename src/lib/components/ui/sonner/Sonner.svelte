<script lang="ts">
  import { Toaster as Sonner, type ToasterProps } from 'svelte-sonner'

  let { ...restProps }: ToasterProps = $props()
</script>

<!-- Toaster global : monté une seule fois dans le layout racine. Stylé via les
     tokens du design system (couleurs, radius). `toast()` est importé depuis
     'svelte-sonner' partout où on veut afficher une confirmation. -->
<Sonner
  position="bottom-center"
  toastOptions={{
    style:
      'background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius-md);',
  }}
  {...restProps}
/>
