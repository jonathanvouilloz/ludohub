<script lang="ts">
  import { tick } from 'svelte'
  import BoldIcon from '@lucide/svelte/icons/bold'
  import ItalicIcon from '@lucide/svelte/icons/italic'
  import LinkIcon from '@lucide/svelte/icons/link'
  import ListIcon from '@lucide/svelte/icons/list'
  import ListOrderedIcon from '@lucide/svelte/icons/list-ordered'
  import QuoteIcon from '@lucide/svelte/icons/quote'
  import RedoIcon from '@lucide/svelte/icons/redo-2'
  import UndoIcon from '@lucide/svelte/icons/undo-2'

  type TextStyle = 'p' | 'h2' | 'h3' | 'h4'

  let {
    id,
    name,
    value = $bindable(''),
    ariaLabel = 'Contenu',
    placeholder = 'Écrivez votre contenu ici…',
    disabled = false,
  }: {
    id: string
    name: string
    value?: string
    ariaLabel?: string
    placeholder?: string
    disabled?: boolean
  } = $props()

  let editor = $state<HTMLDivElement>()
  let linkInput = $state<HTMLInputElement>()
  let activeStyle = $state<TextStyle>('p')
  let showLinkField = $state(false)
  let linkUrl = $state('')
  let linkError = $state('')
  let savedRange: Range | null = null
  let previousValue = $state<string | null>(null)

  const allowedLink = /^(?:https?:\/\/|mailto:|\/)/i

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function inlineHtml(value: string) {
    const links: string[] = []
    const escaped = escapeHtml(value).replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]+)\)/g,
      (_match, label: string, href: string) => {
        const index = links.push(`<a href="${href}" rel="noopener noreferrer">${label}</a>`) - 1
        return `\uE000${index}\uE001`
      },
    )

    return escaped
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
      .replace(/\uE000(\d+)\uE001/g, (_match, index: string) => links[Number(index)] ?? '')
  }

  function markdownToEditorHtml(markdown: string) {
    if (!markdown.trim()) return ''

    const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
    const blocks: string[] = []
    let index = 0

    const unordered = (line: string) => /^\s*[-*+]\s+/.test(line)
    const ordered = (line: string) => /^\s*\d+\.\s+/.test(line)

    while (index < lines.length) {
      const line = lines[index]
      if (!line.trim()) {
        index += 1
        continue
      }

      const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
      if (heading) {
        const level = Math.min(4, Math.max(2, heading[1].length))
        blocks.push(`<h${level}>${inlineHtml(heading[2].trim())}</h${level}>`)
        index += 1
        continue
      }

      if (unordered(line) || ordered(line)) {
        const isOrdered = ordered(line)
        const items: string[] = []
        while (
          index < lines.length &&
          (isOrdered ? ordered(lines[index]) : unordered(lines[index]))
        ) {
          const content = lines[index].replace(isOrdered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/, '')
          items.push(`<li>${inlineHtml(content.trim())}</li>`)
          index += 1
        }
        blocks.push(`<${isOrdered ? 'ol' : 'ul'}>${items.join('')}</${isOrdered ? 'ol' : 'ul'}>`)
        continue
      }

      if (/^\s*>\s?/.test(line)) {
        const quote: string[] = []
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^\s*>\s?/, '').trim())
          index += 1
        }
        blocks.push(`<blockquote><p>${inlineHtml(quote.join(' '))}</p></blockquote>`)
        continue
      }

      const paragraph: string[] = []
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^\s*#{1,6}\s+/.test(lines[index]) &&
        !unordered(lines[index]) &&
        !ordered(lines[index]) &&
        !/^\s*>\s?/.test(lines[index])
      ) {
        paragraph.push(lines[index].trim())
        index += 1
      }
      blocks.push(`<p>${inlineHtml(paragraph.join(' '))}</p>`)
    }

    return blocks.join('')
  }

  function inlineMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.replaceAll('\u00a0', ' ') ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const element = node as HTMLElement
    const content = Array.from(element.childNodes).map(inlineMarkdown).join('')
    switch (element.tagName.toLowerCase()) {
      case 'strong':
      case 'b':
        return content ? `**${content}**` : ''
      case 'em':
      case 'i':
        return content ? `*${content}*` : ''
      case 'a': {
        const href = element.getAttribute('href')?.trim() ?? ''
        return content && allowedLink.test(href) ? `[${content}](${href})` : content
      }
      case 'br':
        return '\n'
      default:
        return content
    }
  }

  function blockMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const element = node as HTMLElement
    const content = Array.from(element.childNodes).map(inlineMarkdown).join('').trim()
    switch (element.tagName.toLowerCase()) {
      case 'h2':
        return content ? `## ${content}` : ''
      case 'h3':
        return content ? `### ${content}` : ''
      case 'h4':
        return content ? `#### ${content}` : ''
      case 'ul':
        return Array.from(element.querySelectorAll(':scope > li'))
          .map((item) => `- ${Array.from(item.childNodes).map(inlineMarkdown).join('').trim()}`)
          .join('\n')
      case 'ol':
        return Array.from(element.querySelectorAll(':scope > li'))
          .map(
            (item, index) =>
              `${index + 1}. ${Array.from(item.childNodes).map(inlineMarkdown).join('').trim()}`,
          )
          .join('\n')
      case 'blockquote':
        return content
          .split(/\n+/)
          .filter(Boolean)
          .map((line) => `> ${line}`)
          .join('\n')
      default:
        return content
    }
  }

  function syncValue() {
    if (!editor) return
    value = Array.from(editor.childNodes).map(blockMarkdown).filter(Boolean).join('\n\n').trim()
    updateActiveStyle()
  }

  function updateActiveStyle() {
    if (!editor || typeof window === 'undefined') return
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const parent = node instanceof Element ? node : node?.parentElement
    const block = parent?.closest('h2, h3, h4, p, div')?.tagName.toLowerCase()
    activeStyle = block === 'h2' || block === 'h3' || block === 'h4' ? block : 'p'
  }

  function focusEditor() {
    editor?.focus()
  }

  function runCommand(command: string, commandValue?: string) {
    if (disabled || typeof document === 'undefined') return
    focusEditor()
    if (savedRange && typeof window !== 'undefined') {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(savedRange)
    }
    document.execCommand(command, false, commandValue)
    savedRange = null
    syncValue()
  }

  function changeStyle(event: Event) {
    const style = (event.currentTarget as HTMLSelectElement).value as TextStyle
    activeStyle = style
    runCommand('formatBlock', style)
  }

  function rememberSelection() {
    if (!editor || typeof window === 'undefined') return
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (range && editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange()
  }

  async function openLinkField() {
    rememberSelection()
    linkUrl = ''
    linkError = ''
    showLinkField = true
    await tick()
    linkInput?.focus()
  }

  function normalizeLink(value: string) {
    const trimmed = value.trim()
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`
    return trimmed
  }

  function addLink() {
    const href = normalizeLink(linkUrl)
    if (!allowedLink.test(href)) {
      linkError = 'Utilisez une adresse qui commence par https://, http://, mailto: ou /.'
      return
    }
    if (!savedRange || typeof window === 'undefined' || typeof document === 'undefined') {
      linkError = 'Sélectionnez d’abord le texte à rendre cliquable.'
      return
    }

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedRange)
    document.execCommand('createLink', false, href)
    syncValue()
    showLinkField = false
    savedRange = null
    linkUrl = ''
    focusEditor()
  }

  function pastePlainText(event: ClipboardEvent) {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (typeof document !== 'undefined') document.execCommand('insertText', false, text)
    syncValue()
  }

  $effect(() => {
    if (!editor || value === previousValue || document.activeElement === editor) return
    editor.innerHTML = markdownToEditorHtml(value)
    previousValue = value
  })
</script>

<div class="rich-editor" class:disabled>
  <input type="hidden" {name} {value} />
  <div class="toolbar" role="toolbar" aria-label="Mise en forme du texte">
    <label class="style-picker" for={`${id}-style`}>
      <span class="sr-only">Style du paragraphe</span>
      <select
        id={`${id}-style`}
        value={activeStyle}
        onmousedown={rememberSelection}
        onchange={changeStyle}
        {disabled}
      >
        <option value="p">Texte normal</option>
        <option value="h2">Titre de section</option>
        <option value="h3">Sous-titre</option>
        <option value="h4">Petit titre</option>
      </select>
    </label>
    <span class="toolbar-divider" aria-hidden="true"></span>
    <button
      type="button"
      title="Gras"
      aria-label="Gras"
      onmousedown={rememberSelection}
      onclick={() => runCommand('bold')}
      {disabled}><BoldIcon size={17} aria-hidden="true" /></button
    >
    <button
      type="button"
      title="Italique"
      aria-label="Italique"
      onmousedown={rememberSelection}
      onclick={() => runCommand('italic')}
      {disabled}><ItalicIcon size={17} aria-hidden="true" /></button
    >
    <button
      type="button"
      title="Ajouter un lien"
      aria-label="Ajouter un lien"
      onmousedown={rememberSelection}
      onclick={openLinkField}
      {disabled}><LinkIcon size={17} aria-hidden="true" /></button
    >
    <span class="toolbar-divider" aria-hidden="true"></span>
    <button
      type="button"
      title="Liste à puces"
      aria-label="Liste à puces"
      onmousedown={rememberSelection}
      onclick={() => runCommand('insertUnorderedList')}
      {disabled}><ListIcon size={17} aria-hidden="true" /></button
    >
    <button
      type="button"
      title="Liste numérotée"
      aria-label="Liste numérotée"
      onmousedown={rememberSelection}
      onclick={() => runCommand('insertOrderedList')}
      {disabled}><ListOrderedIcon size={17} aria-hidden="true" /></button
    >
    <button
      type="button"
      title="Citation"
      aria-label="Citation"
      onmousedown={rememberSelection}
      onclick={() => runCommand('formatBlock', 'blockquote')}
      {disabled}><QuoteIcon size={17} aria-hidden="true" /></button
    >
    <span class="toolbar-divider" aria-hidden="true"></span>
    <button
      type="button"
      title="Annuler"
      aria-label="Annuler"
      onmousedown={rememberSelection}
      onclick={() => runCommand('undo')}
      {disabled}><UndoIcon size={17} aria-hidden="true" /></button
    >
    <button
      type="button"
      title="Rétablir"
      aria-label="Rétablir"
      onmousedown={rememberSelection}
      onclick={() => runCommand('redo')}
      {disabled}><RedoIcon size={17} aria-hidden="true" /></button
    >
  </div>

  {#if showLinkField}
    <div class="link-field">
      <label for={`${id}-link`}>Adresse du lien</label>
      <input
        bind:this={linkInput}
        id={`${id}-link`}
        type="text"
        inputmode="url"
        bind:value={linkUrl}
        placeholder="https://exemple.ch"
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            addLink()
          }
          if (event.key === 'Escape') showLinkField = false
        }}
      />
      <button type="button" onclick={addLink}>Ajouter</button>
      <button
        type="button"
        class="link-cancel"
        onclick={() => {
          showLinkField = false
          savedRange = null
        }}>Annuler</button
      >
      {#if linkError}<p role="alert">{linkError}</p>{/if}
    </div>
  {/if}

  <div
    bind:this={editor}
    {id}
    class="editor"
    contenteditable={!disabled}
    tabindex={disabled ? -1 : 0}
    role="textbox"
    aria-multiline="true"
    aria-label={ariaLabel}
    aria-placeholder={placeholder}
    data-placeholder={placeholder}
    oninput={syncValue}
    onkeyup={updateActiveStyle}
    onmouseup={updateActiveStyle}
    onpaste={pastePlainText}
  ></div>
</div>

<style>
  .rich-editor {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
  }
  .rich-editor:focus-within {
    box-shadow: var(--shadow-focus);
  }
  .rich-editor.disabled {
    opacity: 0.64;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2);
    border-bottom: 1px solid var(--border);
    background: var(--bg-muted);
  }
  .style-picker select,
  .toolbar button,
  .link-field button {
    min-height: 36px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-main);
    font: inherit;
    cursor: pointer;
  }
  .style-picker select {
    max-width: 10.8rem;
    padding: 0 var(--space-2);
  }
  .toolbar button {
    display: grid;
    width: 36px;
    place-items: center;
  }
  .toolbar button:hover:not(:disabled),
  .toolbar button:focus-visible,
  .style-picker select:focus-visible,
  .link-field button:hover,
  .link-field button:focus-visible {
    outline: none;
    background: var(--primary-light);
    color: var(--primary-dark);
  }
  .toolbar button:disabled,
  .style-picker select:disabled {
    cursor: not-allowed;
  }
  .toolbar-divider {
    width: 1px;
    height: 24px;
    margin-inline: var(--space-1);
    background: var(--border-strong);
  }
  .link-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
  }
  .link-field label {
    color: var(--text-main);
    font-size: var(--text-small);
    font-weight: var(--weight-medium);
  }
  .link-field input {
    min-width: 0;
    min-height: 36px;
    padding-inline: var(--space-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg-input, var(--bg-card));
    color: var(--text-main);
    font: inherit;
  }
  .link-field button {
    padding-inline: var(--space-3);
    background: var(--primary);
    color: var(--text-inverse);
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  .link-field .link-cancel {
    background: transparent;
    color: var(--text-muted);
  }
  .link-field p {
    grid-column: 2 / -1;
    margin: 0;
    color: var(--danger);
    font-size: var(--text-small);
  }
  .editor {
    min-height: 13rem;
    padding: var(--space-3);
    color: var(--text-main);
    line-height: 1.65;
    outline: none;
    overflow-wrap: anywhere;
  }
  .editor:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    pointer-events: none;
  }
  .editor :global(p),
  .editor :global(h2),
  .editor :global(h3),
  .editor :global(h4),
  .editor :global(ul),
  .editor :global(ol),
  .editor :global(blockquote) {
    margin: 0 0 var(--space-3);
  }
  .editor :global(h2),
  .editor :global(h3),
  .editor :global(h4) {
    color: var(--text-main);
    line-height: 1.2;
  }
  .editor :global(h2) {
    font-size: var(--text-h2);
  }
  .editor :global(h3) {
    font-size: var(--text-h3);
  }
  .editor :global(h4) {
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
  }
  .editor :global(ul),
  .editor :global(ol) {
    padding-left: var(--space-6);
  }
  .editor :global(blockquote) {
    padding-left: var(--space-3);
    border-left: 3px solid var(--primary);
    color: var(--text-muted);
  }
  .editor :global(a) {
    color: var(--primary-dark);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  @media (max-width: 560px) {
    .link-field {
      grid-template-columns: 1fr auto auto;
    }
    .link-field label,
    .link-field p {
      grid-column: 1 / -1;
    }
  }
</style>
