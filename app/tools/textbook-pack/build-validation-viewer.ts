import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CanonicalTextbookPack, GroupedPage, NormalizedPage, SourceReference } from './schema.ts'

interface CliOptions {
  proofPath: string
  normalizedRoot: string
  groupedRoot: string
  outDir: string
}

interface ViewerItem {
  id: string
  kind: 'vocabulary' | 'grammar' | 'content' | 'exercise' | 'answer' | 'script' | 'image'
  label: string
  text: string
  sourceRef: SourceReference
  ownerId?: string
}

interface ViewerPage {
  sourceId: string
  pageNumber: number
  pageKind: string
  sectionLabel: string | null
  width: number
  height: number
  image: string
  blocks: Array<{
    id: string
    type: string
    text: string
    coordinates: [number, number, number, number] | null
  }>
}

interface ViewerData {
  title: string
  generatedAt: string
  pages: ViewerPage[]
  items: ViewerItem[]
}

const options = parseArgs(process.argv.slice(2))
const proof = await readJson<CanonicalTextbookPack>(resolveAppPath(options.proofPath))
const data = await buildViewerData(proof)
const outDir = resolveAppPath(options.outDir)

await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'index.html'), renderHtml(data), 'utf8')
console.log(`wrote ${path.relative(process.cwd(), path.join(outDir, 'index.html'))}`)
console.log(JSON.stringify({ pages: data.pages.length, items: data.items.length }, null, 2))

async function buildViewerData(pack: CanonicalTextbookPack): Promise<ViewerData> {
  const lesson = pack.lessons[0]
  if (!lesson) throw new Error('Proof pack does not contain a lesson')

  const items: ViewerItem[] = [
    ...lesson.vocabulary.map((entry) => ({
      id: entry.id,
      kind: 'vocabulary' as const,
      label: entry.surface,
      text: [entry.reading, entry.meaning].filter(Boolean).join(' - '),
      sourceRef: entry.sourceRef,
    })),
    ...lesson.grammar.map((entry) => ({
      id: entry.id,
      kind: 'grammar' as const,
      label: entry.pattern,
      text: entry.meaning,
      sourceRef: entry.sourceRef,
    })),
    ...lesson.contentBlocks.map((entry) => ({
      id: entry.id,
      kind: 'content' as const,
      label: entry.title ?? entry.type,
      text: entry.text ?? '',
      sourceRef: entry.sourceRef,
    })),
    ...lesson.contentBlocks.flatMap((entry) =>
      entry.imageSourceRef
        ? [
            {
              id: `${entry.id}:image`,
              kind: 'image' as const,
              label: `${entry.title ?? entry.type} image`,
              text: entry.imageFile ?? '',
              sourceRef: entry.imageSourceRef,
              ownerId: entry.id,
            },
          ]
        : [],
    ),
    ...lesson.exercises.map((entry) => ({
      id: entry.id,
      kind: 'exercise' as const,
      label: entry.label,
      text: entry.prompt ?? '',
      sourceRef: entry.sourceRef,
    })),
    ...lesson.exercises.flatMap((entry) => [
      ...(entry.imageSourceRef
        ? [
            {
              id: `${entry.id}:image`,
              kind: 'image' as const,
              label: `${entry.label} image`,
              text: entry.imageFile ?? '',
              sourceRef: entry.imageSourceRef,
              ownerId: entry.id,
            },
          ]
        : []),
      ...answerRefs(entry).map((ref, index) => ({
        id: `${entry.id}:answer:${index + 1}`,
        kind: 'answer' as const,
        label: `${entry.label} answer ${index + 1}`,
        text: entry.answerKey?.sourceText ?? '',
        sourceRef: ref,
        ownerId: entry.id,
      })),
      ...(entry.listeningScriptRef
        ? [
            {
              id: `${entry.id}:script`,
              kind: 'script' as const,
              label: `${entry.label} listening script`,
              text: '',
              sourceRef: entry.listeningScriptRef,
              ownerId: entry.id,
            },
          ]
        : []),
    ]),
  ]

  const pageRefs = uniqueRefs(items.map((item) => item.sourceRef))
  const pages = await Promise.all(pageRefs.map((ref) => buildPage(ref)))

  return {
    title: `${pack.title} - ${lesson.title}`,
    generatedAt: new Date().toISOString(),
    pages: pages.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.pageNumber - b.pageNumber),
    items,
  }
}

function answerRefs(entry: { answerKeyRef?: SourceReference; answerKeyRefs?: SourceReference[] }): SourceReference[] {
  if (entry.answerKeyRefs?.length) return entry.answerKeyRefs
  return entry.answerKeyRef ? [entry.answerKeyRef] : []
}

async function buildPage(ref: SourceReference): Promise<ViewerPage> {
  const normalized = await readJson<NormalizedPage>(pageJsonPath(options.normalizedRoot, ref.sourceId, ref.pageNumber))
  const grouped = await readJson<GroupedPage>(pageJsonPath(options.groupedRoot, ref.sourceId, ref.pageNumber))
  const image = `pages/${ref.sourceId}/page-${String(ref.pageNumber).padStart(4, '0')}.png`
  return {
    sourceId: ref.sourceId,
    pageNumber: ref.pageNumber,
    pageKind: grouped.pageKind,
    sectionLabel: grouped.section.label,
    width: normalized.image.width,
    height: normalized.image.height,
    image,
    blocks: grouped.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      text: block.text,
      coordinates: block.boundingBox,
    })),
  }
}

function renderHtml(data: ViewerData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title)} Validation Viewer</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f4ef;
      --panel: #ffffff;
      --ink: #23201c;
      --muted: #6e665c;
      --line: #d9d2c6;
      --accent: #c6452d;
      --accent-soft: rgba(198, 69, 45, 0.14);
      --blue: #246b8f;
      --green: #4f7d39;
      --amber: #b66d10;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--bg);
    }
    button, input, select { font: inherit; }
    .app {
      display: grid;
      grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
      min-height: 100vh;
    }
    aside {
      border-right: 1px solid var(--line);
      background: var(--panel);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      padding: 18px 18px 14px;
      border-bottom: 1px solid var(--line);
    }
    h1 {
      font-size: 18px;
      line-height: 1.25;
      margin: 0 0 8px;
      font-weight: 720;
      letter-spacing: 0;
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 12px;
    }
    .controls {
      display: grid;
      gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
    }
    .segmented {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
      background: #faf8f3;
    }
    .segmented button {
      border: 0;
      border-right: 1px solid var(--line);
      min-width: 0;
      padding: 8px 6px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }
    .segmented button:last-child { border-right: 0; }
    .segmented button.active {
      background: var(--ink);
      color: #fff;
    }
    input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px 10px;
      background: #fff;
      color: var(--ink);
    }
    .item-list {
      overflow: auto;
      padding: 8px;
      display: grid;
      gap: 6px;
    }
    .item {
      text-align: left;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 10px;
      background: transparent;
      cursor: pointer;
    }
    .item:hover, .item.active {
      border-color: var(--line);
      background: #faf8f3;
    }
    .item.active { border-color: var(--accent); }
    .item-kind {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 3px;
    }
    .item-label {
      font-size: 15px;
      line-height: 1.25;
      font-weight: 680;
    }
    .item-text {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      max-height: 48px;
      overflow: hidden;
    }
    main {
      min-width: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 100vh;
    }
    .pagebar {
      display: flex;
      gap: 8px;
      align-items: center;
      overflow-x: auto;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.72);
    }
    .page-tab {
      flex: 0 0 auto;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 10px;
      background: #fff;
      color: var(--ink);
      cursor: pointer;
      min-width: 92px;
    }
    .page-tab.active {
      border-color: var(--accent);
      box-shadow: inset 0 -2px 0 var(--accent);
    }
    .page-tab span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stage-wrap {
      min-height: 0;
      overflow: auto;
      padding: 22px;
    }
    .stage {
      position: relative;
      width: min(100%, 920px);
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 8px 28px rgba(60, 46, 33, 0.16);
    }
    .stage img {
      display: block;
      width: 100%;
      height: auto;
    }
    .overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .box {
      position: absolute;
      border: 1.5px solid rgba(36, 107, 143, 0.72);
      background: rgba(36, 107, 143, 0.08);
    }
    .box.vocabulary { border-color: rgba(79, 125, 57, 0.76); background: rgba(79, 125, 57, 0.1); }
    .box.grammar { border-color: rgba(182, 109, 16, 0.82); background: rgba(182, 109, 16, 0.12); }
    .box.exercise { border-color: rgba(198, 69, 45, 0.78); background: var(--accent-soft); }
    .box.selected {
      border-width: 3px;
      z-index: 4;
      background: rgba(198, 69, 45, 0.18);
    }
    .block-box {
      border-style: dashed;
      opacity: 0.45;
    }
    .details {
      width: min(100%, 920px);
      margin: 14px auto 0;
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 6px;
      padding: 12px;
      color: var(--muted);
      line-height: 1.45;
    }
    .details strong { color: var(--ink); }
    @media (max-width: 860px) {
      .app { grid-template-columns: 1fr; }
      aside { min-height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      .item-list { max-height: 340px; }
      .stage-wrap { padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <header>
        <h1 id="title"></h1>
        <div class="meta">
          <span id="page-count"></span>
          <span id="item-count"></span>
        </div>
      </header>
      <div class="controls">
        <div class="segmented" id="kind-tabs">
          <button data-kind="all" class="active">All</button>
          <button data-kind="vocabulary">Vocab</button>
          <button data-kind="grammar">Grammar</button>
          <button data-kind="exercise">Exercise</button>
        </div>
        <input id="search" type="search" placeholder="Filter extracted items">
      </div>
      <div class="item-list" id="items"></div>
    </aside>
    <main>
      <nav class="pagebar" id="pages"></nav>
      <div class="stage-wrap">
        <div class="stage" id="stage">
          <img id="page-image" alt="">
          <div class="overlay" id="overlay"></div>
        </div>
        <div class="details" id="details"></div>
      </div>
    </main>
  </div>
  <script id="viewer-data" type="application/json">${json}</script>
  <script>
    const data = JSON.parse(document.getElementById('viewer-data').textContent)
    let selectedKind = 'all'
    let selectedItem = data.items[0]
    let selectedPage = data.pages.find((page) => selectedItem && isSamePageRef(selectedItem.sourceRef, page)) || data.pages[0]

    const title = document.getElementById('title')
    const pageCount = document.getElementById('page-count')
    const itemCount = document.getElementById('item-count')
    const pagesEl = document.getElementById('pages')
    const itemsEl = document.getElementById('items')
    const searchEl = document.getElementById('search')
    const imageEl = document.getElementById('page-image')
    const overlayEl = document.getElementById('overlay')
    const detailsEl = document.getElementById('details')

    title.textContent = data.title
    pageCount.textContent = data.pages.length + ' pages'
    itemCount.textContent = data.items.length + ' items'

    document.getElementById('kind-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('button')
      if (!button) return
      selectedKind = button.dataset.kind
      document.querySelectorAll('#kind-tabs button').forEach((node) => node.classList.toggle('active', node === button))
      renderItems()
    })
    searchEl.addEventListener('input', renderItems)

    function renderPages() {
      pagesEl.innerHTML = ''
      for (const page of data.pages) {
        const button = document.createElement('button')
        button.className = 'page-tab' + (isSamePage(page, selectedPage) ? ' active' : '')
        button.innerHTML = '<strong>p.' + page.pageNumber + '</strong><span>' + page.sourceId.replaceAll('_', ' ') + '</span>'
        button.addEventListener('click', () => {
          selectedPage = page
          const pageItem = data.items.find((item) => isSamePageRef(item.sourceRef, page))
          if (pageItem) selectedItem = pageItem
          renderAll()
        })
        pagesEl.appendChild(button)
      }
    }

    function renderItems() {
      const query = searchEl.value.trim().toLowerCase()
      const filtered = data.items.filter((item) => {
        const kindOk = selectedKind === 'all' || item.kind === selectedKind
        const haystack = (item.label + ' ' + item.text + ' ' + item.sourceRef.sourceId + ' ' + item.sourceRef.pageNumber).toLowerCase()
        return kindOk && (!query || haystack.includes(query))
      })
      itemsEl.innerHTML = ''
      for (const item of filtered) {
        const button = document.createElement('button')
        button.className = 'item' + (selectedItem && selectedItem.id === item.id ? ' active' : '')
        button.innerHTML = '<div class="item-kind">' + item.kind + ' · ' + item.sourceRef.sourceId + ' p.' + item.sourceRef.pageNumber + '</div>' +
          '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
          '<div class="item-text">' + escapeHtml(item.text) + '</div>'
        button.addEventListener('click', () => {
          selectedItem = item
          selectedPage = data.pages.find((page) => isSamePageRef(item.sourceRef, page)) || selectedPage
          renderAll()
        })
        itemsEl.appendChild(button)
      }
    }

    function renderStage() {
      if (!selectedPage) return
      imageEl.src = selectedPage.image
      imageEl.alt = selectedPage.sourceId + ' page ' + selectedPage.pageNumber
      overlayEl.innerHTML = ''
      for (const block of selectedPage.blocks) {
        if (!block.coordinates) continue
        overlayEl.appendChild(makeBox(block.coordinates, 'block-box', selectedPage))
      }
      for (const item of data.items.filter((candidate) => isSamePageRef(candidate.sourceRef, selectedPage) && candidate.sourceRef.coordinates)) {
        const selected = selectedItem && item.id === selectedItem.id
        overlayEl.appendChild(makeBox(item.sourceRef.coordinates, item.kind + (selected ? ' selected' : ''), selectedPage))
      }
      if (selectedItem) {
        detailsEl.innerHTML = '<strong>' + escapeHtml(selectedItem.label) + '</strong><br>' +
          escapeHtml(selectedItem.text || '(no text)') + '<br>' +
          '<span>' + selectedItem.kind + ' · ' + selectedItem.sourceRef.sourceId + ' p.' + selectedItem.sourceRef.pageNumber + '</span>'
      }
    }

    function makeBox(coords, className, page) {
      const [x1, y1, x2, y2] = coords
      const box = document.createElement('div')
      box.className = 'box ' + className
      box.style.left = (x1 / page.width * 100) + '%'
      box.style.top = (y1 / page.height * 100) + '%'
      box.style.width = ((x2 - x1) / page.width * 100) + '%'
      box.style.height = ((y2 - y1) / page.height * 100) + '%'
      return box
    }

    function renderAll() {
      renderPages()
      renderItems()
      renderStage()
    }

    function isSamePage(a, b) {
      return a && b && a.sourceId === b.sourceId && a.pageNumber === b.pageNumber
    }

    function isSamePageRef(ref, page) {
      return ref && page && ref.sourceId === page.sourceId && ref.pageNumber === page.pageNumber
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
    }

    renderAll()
  </script>
</body>
</html>
`
}

function uniqueRefs(refs: SourceReference[]): SourceReference[] {
  const seen = new Set<string>()
  const output: SourceReference[] = []
  for (const ref of refs) {
    const key = `${ref.sourceId}:${ref.pageNumber}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(ref)
  }
  return output
}

function pageJsonPath(root: string, sourceId: string, pageNumber: number): string {
  return resolveAppPath(path.join(root, sourceId, 'pages', `page-${String(pageNumber).padStart(4, '0')}.json`))
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    proofPath: 'tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json',
    normalizedRoot: 'tools/textbook-pack/out/normalized',
    groupedRoot: 'tools/textbook-pack/out/grouped',
    outDir: 'tools/textbook-pack/out/validation-viewer/genki_1_lesson_1',
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--proof') options.proofPath = rawArgs[++index] ?? options.proofPath
    if (arg === '--normalized-root') options.normalizedRoot = rawArgs[++index] ?? options.normalizedRoot
    if (arg === '--grouped-root') options.groupedRoot = rawArgs[++index] ?? options.groupedRoot
    if (arg === '--out') options.outDir = rawArgs[++index] ?? options.outDir
  }

  return options
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

function resolveAppPath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(process.cwd(), filePath)
}
