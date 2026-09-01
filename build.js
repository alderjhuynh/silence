#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const DEFAULT_WRITING_DIR = path.resolve(SCRIPT_DIR, '../../../writing/deafening silence/writing');
const DEFAULT_SITE_DIR = path.resolve(SCRIPT_DIR);

function parseArgs(argv) {
  const args = { source: DEFAULT_WRITING_DIR, site: DEFAULT_SITE_DIR, check: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source' && argv[i + 1]) args.source = path.resolve(argv[++i]);
    else if (a.startsWith('--source=')) args.source = path.resolve(a.split('=')[1]);
    else if (a === '--site' && argv[i + 1]) args.site = path.resolve(argv[++i]);
    else if (a.startsWith('--site=')) args.site = path.resolve(a.split('=')[1]);
    else if (a === '--check') args.check = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else console.warn(`unknown arg: ${a}`);
  }
  return args;
}

function printHelp() {
  console.log(`
build.js: md to site

Usage:
  node build.js [options]

Options:
  --source <path>  Writing folder containing "chapter N.md" files
                   default: ${DEFAULT_WRITING_DIR}
  --site <path>    Silence site root (contains index.html, 1/, 2/, css/, etc.)
                   default: ${DEFAULT_SITE_DIR}
  --check          Verify generated output matches disk (no writes)
  --help, -h       Show this help
`);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMdToHtml(s) {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+?)_/g, '<em>$1</em>');
  return out;
}

function parseChapterFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  let num = null;
  let titleLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s*(\d+)\s*$/);
    if (m) {
      num = parseInt(m[1], 10);
      titleLineIdx = i;
      break;
    }
    const m2 = lines[i].match(/^#\s*.*?(\d+)\s*$/);
    if (m2 && i === 0) {
      num = parseInt(m2[1], 10);
      titleLineIdx = i;
      break;
    }
  }
  if (num == null) {
    const base = path.basename(filePath);
    const fm = base.match(/(\d+)/);
    if (fm) num = parseInt(fm[1], 10);
    else throw new Error(`Cannot determine chapter number for ${filePath}`);
    titleLineIdx = -1;
  }

  let start = titleLineIdx >= 0 ? titleLineIdx + 1 : 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  const body = lines.slice(start).join('\n').trim();

  const rawParas = body ? body.split(/\n\s*\n/) : [];
  const paragraphs = rawParas.map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);

  const words = body ? body.split(/\s+/).filter(Boolean).length : 0;

  return { num, paragraphs, words, rawBody: body };
}

function buildChapterHtml(num, paragraphs, allNumsSorted) {
  const sorted = [...allNumsSorted].sort((a, b) => a - b);
  const idx = sorted.indexOf(num);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  const navLinks = [
    `    <a class="nav-link" href="../index.html#outline">Outline</a>`,
    ...sorted.map(n => {
      if (n === num) return `    <a class="nav-link is-active" href="./">Chapter ${n}</a>`;
      return `    <a class="nav-link" href="../${n}/">Chapter ${n}</a>`;
    }),
    `    <a class="nav-link" href="https://www.auraea.fyi" target="_blank" rel="noopener">auraea.fyi</a>`,
  ].join('\n');

  const tocLinks = sorted.map(n => {
    if (n === num) return `      <li><a href="./" class="is-active">Chapter ${n}</a></li>`;
    return `      <li><a href="../${n}/">Chapter ${n}</a></li>`;
  }).join('\n');

  let tocFootInner = `      <p style="margin:0 0 8px;"><strong style="color:var(--plum);">Deafening Silence</strong></p>\n`;
  if (prev && next) {
    tocFootInner += `      <p style="margin:0;"><a href="../${prev}/">Prev: Chapter ${prev}</a> · <a href="../${next}/">Next: Chapter ${next}</a></p>`;
  } else if (prev) {
    tocFootInner += `      <p style="margin:0;"><a href="../${prev}/">Prev: Chapter ${prev}</a></p>`;
  } else if (next) {
    tocFootInner += `      <p style="margin:0;"><a href="../${next}/">Next: Chapter ${next}</a></p>`;
  } else {
    tocFootInner += `      <p style="margin:0;">The beginning</p>`;
  }

  let nextCardInner = '';
  if (prev && next) {
    nextCardInner = `<p><a href="../${prev}/">← Chapter ${prev}</a> &nbsp;·&nbsp; <a href="../${next}/">Chapter ${next} →</a> &nbsp;·&nbsp; <a href="../index.html#chapters">Back to overview</a></p>`;
  } else if (prev) {
    nextCardInner = `<p><a href="../${prev}/">← Chapter ${prev}</a> &nbsp;·&nbsp; <a href="../index.html#chapters">Back to overview</a></p>`;
  } else if (next) {
    nextCardInner = `<p><a href="../${next}/">Continue to Chapter ${next} →</a> &nbsp;·&nbsp; <a href="../index.html#chapters">Back to overview</a></p>`;
  } else {
    nextCardInner = `<p><a href="../index.html#chapters">Back to overview</a></p>`;
  }

  const proseHtml = paragraphs.map((p, i) => {
    const html = inlineMdToHtml(p);
    const cls = i === 0 ? ' class="lead"' : '';
    return `      <p${cls}>${html}</p>`;
  }).join('\n\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chapter ${num}</title>
<link rel="canonical" href="https://silence.auraea.fyi/${num}/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../css/style.css">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="alternate icon" type="image/png" href="../favicon.png">
<style>

.chapter-hero{
  position:relative; overflow:hidden; isolation:isolate;
  padding:56px 24px 36px;
  background:var(--hero-bg);
  color:var(--cream);
  text-align:center;
  border-bottom:1px solid rgba(255,255,255,0.08);
}
.chapter-hero::before{
  content:""; position:absolute; inset:0; z-index:-1;
  background:
    linear-gradient(180deg, rgba(26,22,28,0.55) 0%, rgba(15,15,22,0.78) 100%),
    url("../assets/fraying-silk.png");
  background-size:cover; background-position:50% 42%;
  filter:saturate(1.02) contrast(1.03);
  opacity:0.9;
}
.chapter-hero-inner{ max-width:720px; margin:0 auto; }
.chapter-eyebrow{
  display:inline-flex; align-items:center; gap:10px;
  font-family:var(--font-mono); font-size:.68rem; letter-spacing:.18em; text-transform:uppercase;
  color:var(--blush); margin-bottom:14px;
}
.chapter-eyebrow::before, .chapter-eyebrow::after{ content:""; width:18px; height:1px; background:var(--blush); opacity:.6; }
.chapter-hero h1{
  font-family:var(--font-display); font-weight:500; font-style:italic;
  font-size:clamp(2.6rem, 6vw, 4rem); line-height:.95; margin:0 0 12px;
  letter-spacing:-.02em; text-shadow:0 2px 18px rgba(0,0,0,0.35);
}
.chapter-hero h1 span{ font-style:normal; font-weight:600; }
.chapter-meta{
  font-family:var(--font-mono); font-size:.70rem; letter-spacing:.08em; text-transform:uppercase;
  color:color-mix(in srgb, var(--cream) 72%, transparent);
  display:flex; flex-wrap:wrap; justify-content:center; gap:8px 16px;
}
.chapter-meta em{ font-style:normal; color:var(--paper-2); }
.chapter-actions{ margin-top:22px; display:flex; flex-wrap:wrap; justify-content:center; gap:10px; }
.prose .chapter-num{
  display:block; font-family:var(--font-mono); font-size:.68rem; letter-spacing:.16em; text-transform:uppercase;
  color:var(--rose-deep); margin-bottom:8px;
}
.prose .chapter-title{
  font-family:var(--font-display); font-size:2rem; font-weight:600; line-height:1.1;
  margin:0 0 6px; border:none; padding:0;
}
.prose .chapter-subtitle{
  font-family:var(--font-serif); font-style:italic; font-size:1.05rem; color:var(--plum-soft);
  margin:0 0 22px; line-height:1.5;
}
.prose .lead::first-letter{
  float:left; font-family:var(--font-display); font-size:3.1rem; line-height:.82;
  padding:6px 10px 0 0; color:var(--rose-deep); font-weight:600;
}
.prose .scene-break{
  text-align:center; margin:28px auto; color:var(--rose-muted);
  font-size:12px; letter-spacing:.35em;
}
.next-card{
  margin-top:28px; padding:18px 20px;
  border:1px dashed var(--line-strong); border-radius:var(--radius);
  background:color-mix(in srgb, var(--paper) 85%, white);
  text-align:center;
}
.next-card p{ font-family:var(--font-body) !important; font-size:.88rem !important; color:var(--ink-soft) !important; margin:0 !important; }
.next-card a{ color:var(--rose-deep); text-decoration:none; font-weight:600; }
.next-card a:hover{ text-decoration:underline; }
</style>
</head>
<body>
<div class="grain" aria-hidden="true"></div>

<header class="site-header">
  <a class="brand" href="../index.html" aria-label="Deafening Silence home">
    <span class="brand-name">Deafening Silence</span>
  </a>
  <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
  <nav class="site-nav" id="siteNav">
${navLinks}
  </nav>
</header>

<section class="chapter-hero">
  <div class="chapter-hero-inner">
    <h1><em>Chapter <span>${num}</span></em></h1>
    <div class="chapter-meta">
    </div>
    <div class="chapter-actions">
      <a class="btn-ghost" href="../index.html#chapters">Back to planning docs</a>
    </div>
  </div>
</section>

<div class="wrap reader" id="read">
  <aside class="toc" aria-label="Chapter navigation">
    <ol>
${tocLinks}
    </ol>
    <div class="toc-foot">
${tocFootInner}
    </div>
  </aside>

  <article class="prose">
    <div class="paper-sheet">
      <h2 class="chapter-title">${num}</h2>

${proseHtml}

      <div class="scene-break" aria-hidden="true">&nbsp; ✦ &nbsp;</div>

      <div class="next-card" id="continue">
        ${nextCardInner}
      </div>

    </div>
  </article>
</div>

<footer class="site-footer">
  <div class="footer-links">
    <a href="https://www.auraea.fyi">www.auraea.fyi</a>
    <a href="https://silence.auraea.fyi">silence.auraea.fyi</a>
    </div>
  <div>© <span id="year"></span> lexie</div>
</footer>

<button class="to-top" id="toTop" aria-label="Back to top">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 15l-6-6-6 6"/></svg>
</button>

<script src="../js/render.js"></script>
</body>
</html>
`;
}

function updateHomepage(siteDir, chapters) {
  const indexPath = path.join(siteDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`  homepage not found at ${indexPath}, skipping`);
    return false;
  }
  let html = fs.readFileSync(indexPath, 'utf8');
  const original = html;

  const sortedNums = [...chapters].sort((a, b) => a.num - b.num).map(c => c.num);
  const existingGridHrefs = [...html.matchAll(/href="(\d+)\/"/g)].map(m => parseInt(m[1], 10));
  const existingUnique = [...new Set(existingGridHrefs)].sort((a, b) => a - b);
  const _gridStart = html.indexOf('<div class="doc-grid">');
  const _divider = html.indexOf('<div class="thread-divider"', _gridStart);
  if (_gridStart !== -1 && _divider !== -1) {
    const gridSlice = html.slice(_gridStart, _divider);
    const gridHrefs = [...gridSlice.matchAll(/href="(\d+)\/"/g)].map(m => parseInt(m[1], 10)).sort((a,b)=>a-b);
    const gridMatches = gridHrefs.length === sortedNums.length && gridHrefs.every((v,i)=>v===sortedNums[i]);
    if (gridMatches) {
      const asideReTmp = /(<aside class="toc"[^>]*>\s*<ol>)([\s\S]*?)(<li style="margin:6px 0 10px; height:1px;)/;
      const asideMatchTmp = html.match(asideReTmp);
      if (asideMatchTmp) {
        const asideHrefs = [...asideMatchTmp[2].matchAll(/href="(\d+)\/"/g)].map(m=>parseInt(m[1],10)).sort((a,b)=>a-b);
        const asideMatches = asideHrefs.length === sortedNums.length && asideHrefs.every((v,i)=>v===sortedNums[i]);
        if (asideMatches) return false;
      } else {
        return false;
      }
    }
  }

  const gridStartTag = '<div class="doc-grid">';
  const dividerTag = '<div class="thread-divider"';
  const startIdx = html.indexOf(gridStartTag);
  const dividerIdx = html.indexOf(dividerTag, startIdx);
  if (startIdx !== -1 && dividerIdx !== -1) {
    const sorted = [...chapters].sort((a, b) => a.num - b.num);
    const existingLabels = new Map();
    const gridSliceForLabels = html.slice(startIdx, dividerIdx);
    for (const ch of sorted) {
      const re = new RegExp(`href="${ch.num}/"[\\s\\S]*?<span>~([^<]+) words<\\/span>[\\s\\S]*?<span>~([^<]+) min read<\\/span>`);
      const m = gridSliceForLabels.match(re);
      if (m) existingLabels.set(ch.num, { wordsLabel: m[1], minsLabel: m[2] });
    }
    const cards = sorted.map(ch => {
      let wordLabel, minsLabel;
      if (existingLabels.has(ch.num)) {
        wordLabel = `~${existingLabels.get(ch.num).wordsLabel} words`;
        minsLabel = `~${existingLabels.get(ch.num).minsLabel} min read`;
      } else {
        const words = ch.words;
        const mins = Math.max(1, Math.ceil(words / 200));
        let rounded = Math.round(words / 100) * 100;
        if (rounded === 0) rounded = words; // tiny chapters (tests) — show exact
        wordLabel = `~${rounded.toLocaleString()} words`;
        minsLabel = `~${mins} min read`;
      }
      return `    <a class="doc-card doc-card--featured" href="${ch.num}/">
      <div class="doc-top">
        <span class="doc-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
        <span>Chapter ${ch.num}</span>
      </div>
      <h3>Chapter ${ch.num}</h3>
      <div class="doc-meta">
        <span>${wordLabel}</span>
        <span>·</span>
        <span>${minsLabel}</span>
      </div>
    </a>`;
    }).join('\n');

    const newGridBlock = `<div class="doc-grid">\n${cards}\n  </div>\n</div>\n\n`;
    const prefix = html.slice(0, startIdx);
    const suffix = html.slice(dividerIdx);
    html = prefix + newGridBlock + suffix;
  } else {
    console.warn('  could not locate doc-grid to patch (structure changed), skipping homepage grid update');
  }

  const asideRe = /(<aside class="toc"[^>]*>\s*<ol>)([\s\S]*?)(<li style="margin:6px 0 10px; height:1px;)/;
  const asideMatch = html.match(asideRe);
  if (asideMatch) {
    const sorted = [...chapters].sort((a, b) => a.num - b.num);
    const newItems = sorted.map(n => `      <li><a href="${n.num}/" style="color:var(--rose-deep); font-weight:600;">${n.num}</a></li>`).join('\n');
    html = html.replace(asideRe, `$1\n${newItems}\n      $3`);
  } else {
  }

  if (html !== original) {
    fs.writeFileSync(indexPath, html, 'utf8');
    return true;
  }
  return false;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('Deafening Silence — Markdown → site build');
  console.log(`  source: ${args.source}`);
  console.log(`  site:   ${args.site}`);
  if (args.check) console.log('  mode:   check (no writes)');

  if (!fs.existsSync(args.source)) {
    console.error(`error: source dir not found: ${args.source}`);
    process.exit(1);
  }
  if (!fs.existsSync(args.site)) {
    console.error(`error: site dir not found: ${args.site}`);
    process.exit(1);
  }

  const files = fs.readdirSync(args.source).filter(f => /^chapter\s*\d+\.md$/i.test(f));
  if (files.length === 0) {
    console.error(`no chapter files matched "chapter <N>.md" in ${args.source}`);
    console.error(`found: ${fs.readdirSync(args.source).join(', ')}`);
    process.exit(1);
  }

  const chapters = [];
  for (const f of files) {
    const fp = path.join(args.source, f);
    const data = parseChapterFile(fp);
    chapters.push(data);
    console.log(`  parsed: ${f} → chapter ${data.num} (${data.paragraphs.length} paras, ${data.words} words)`);
  }

  const allNums = chapters.map(c => c.num).sort((a, b) => a - b);
  console.log(`  chapters: [${allNums.join(', ')}]`);

  let wrote = 0;
  let mismatched = 0;

  for (const ch of chapters) {
    const targetDir = path.join(args.site, String(ch.num));
    const targetFile = path.join(targetDir, 'index.html');
    const html = buildChapterHtml(ch.num, ch.paragraphs, allNums);

    if (args.check) {
      if (!fs.existsSync(targetFile) || fs.readFileSync(targetFile, 'utf8') !== html) {
        console.log(`  ✗ mismatch: ${ch.num}/index.html`);
        mismatched++;
      } else {
        console.log(`  ✓ ok: ${ch.num}/index.html`);
      }
    } else {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(targetFile, html, 'utf8');
      console.log(`  wrote: ${path.relative(args.site, targetFile)}`);
      wrote++;
    }
  }

  if (!args.check) {
    const didUpdate = updateHomepage(args.site, chapters);
    if (didUpdate) console.log('  updated: index.html (chapter grid)');
    else console.log('  homepage: no changes');
  } else {
    const indexPath = path.join(args.site, 'index.html');
    if (fs.existsSync(indexPath)) {
      const before = fs.readFileSync(indexPath, 'utf8');
      const tmp = fs.readFileSync(indexPath, 'utf8');
      void before; void tmp;
    }
  }

  if (args.check) {
    if (mismatched > 0) {
      console.error(`\ncheck failed: ${mismatched} file(s) differ. run without --check to fix.`);
      process.exit(1);
    } else {
      console.log('\ncheck passed — all generated files match disk.');
    }
  } else {
    console.log(`\ndone. ${wrote} chapter page(s) written.`);
  }
}

if (require.main === module) main();

module.exports = { parseChapterFile, inlineMdToHtml, buildChapterHtml, escapeHtml };
