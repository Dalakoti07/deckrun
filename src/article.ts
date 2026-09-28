import { createRequire } from "module";
import { Marked } from "marked";
import { MATH_EXTENSIONS } from "./parser.js";
import {
  RICH_CONTENT_CSS,
  RICH_CONTENT_RUNTIME,
  richContentHead,
  type RichFeatures,
} from "./rich-content.js";

const moduleRequire = createRequire(import.meta.url);

/**
 * Markdown articles: a plain `.md` file rendered as one continuous,
 * self-contained HTML page for reading, rather than split into slides.
 *
 * The page carries everything it needs inline: styles, system font stacks,
 * and code already colored at build time. Only KaTeX and Mermaid come off a
 * pinned CDN, and only when the document actually holds math or a diagram.
 */

export type ArticleDesign = "dark" | "plain" | "crimson";

export const DEFAULT_ARTICLE_DESIGN: ArticleDesign = "plain";

interface DesignSpec {
  id: ArticleDesign;
  label: string;
  blurb: string;
  /** Mermaid's own theme that sits best on this background. */
  mermaid: "dark" | "default" | "neutral";
  /** Custom properties the shared stylesheet reads. */
  vars: Record<string, string>;
}

const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Cambria, "Times New Roman", serif';
const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const DESIGNS: DesignSpec[] = [
  {
    id: "dark",
    label: "Dark",
    blurb: "Light text on deep charcoal, with a cool blue accent",
    mermaid: "dark",
    vars: {
      "--bg": "#0f1115",
      "--text": "#d5d9e0",
      "--heading": "#f3f5f9",
      "--muted": "#8a93a3",
      "--accent": "#7aa2f7",
      "--rule": "#262b36",
      "--surface": "#171a21",
      "--code-text": "#d5d9e0",
      "--inline-code-bg": "#1d212a",
      "--quote-bar": "#7aa2f7",
      "--mark": "rgba(122, 162, 247, 0.28)",
      "--font-body": SANS,
      "--font-head": SANS,
      "--tok-keyword": "#bb9af7",
      "--tok-string": "#9ece6a",
      "--tok-number": "#ff9e64",
      "--tok-comment": "#5f6b82",
      "--tok-title": "#7aa2f7",
      "--tok-type": "#2ac3de",
      "--tok-attr": "#e0af68",
      "--tok-meta": "#89ddff",
      "--tok-deletion": "#f7768e",
    },
  },
  {
    id: "plain",
    label: "Plain",
    blurb: "Black on white, quiet and print-friendly",
    mermaid: "neutral",
    vars: {
      "--bg": "#ffffff",
      "--text": "#1f2328",
      "--heading": "#0d1117",
      "--muted": "#59636e",
      "--accent": "#0b57d0",
      "--rule": "#d8dee4",
      "--surface": "#f6f8fa",
      "--code-text": "#1f2328",
      "--inline-code-bg": "#eff1f3",
      "--quote-bar": "#d0d7de",
      "--mark": "rgba(255, 212, 0, 0.35)",
      "--font-body": SANS,
      "--font-head": SANS,
      "--tok-keyword": "#cf222e",
      "--tok-string": "#0a3069",
      "--tok-number": "#0550ae",
      "--tok-comment": "#6e7781",
      "--tok-title": "#8250df",
      "--tok-type": "#953800",
      "--tok-attr": "#0550ae",
      "--tok-meta": "#116329",
      "--tok-deletion": "#82071e",
    },
  },
  {
    id: "crimson",
    label: "Crimson",
    blurb: "Crimson accents on warm cream, set in a book serif",
    mermaid: "default",
    vars: {
      "--bg": "#fbf7f1",
      "--text": "#2b2522",
      "--heading": "#1d1614",
      "--muted": "#76675e",
      "--accent": "#a4161a",
      "--rule": "#e6d9c8",
      "--surface": "#f3ebdf",
      "--code-text": "#2b2522",
      "--inline-code-bg": "#f1e7da",
      "--quote-bar": "#a4161a",
      "--mark": "rgba(164, 22, 26, 0.16)",
      "--font-body": SERIF,
      "--font-head": SERIF,
      "--tok-keyword": "#a4161a",
      "--tok-string": "#5c6b1f",
      "--tok-number": "#b35c00",
      "--tok-comment": "#9a8b80",
      "--tok-title": "#6d2e8c",
      "--tok-type": "#8a4b08",
      "--tok-attr": "#1f5e8c",
      "--tok-meta": "#5f4b8b",
      "--tok-deletion": "#a4161a",
    },
  },
];

const DESIGN_BY_ID = new Map(DESIGNS.map((d) => [d.id, d]));

/** The design with this id, ignoring case, or null for an unknown one. */
export function findArticleDesign(name: string | null | undefined): ArticleDesign | null {
  if (!name) return null;
  const id = name.trim().toLowerCase() as ArticleDesign;
  return DESIGN_BY_ID.has(id) ? id : null;
}

/** Any input resolved to a design that exists, falling back to the default. */
export function resolveArticleDesign(name: string | null | undefined): ArticleDesign {
  return findArticleDesign(name) ?? DEFAULT_ARTICLE_DESIGN;
}

/** What the editor needs to draw its design menu. */
export function articleDesignSummaries(): Array<{
  id: ArticleDesign;
  label: string;
  blurb: string;
  bg: string;
  accent: string;
}> {
  return DESIGNS.map((d) => ({
    id: d.id,
    label: d.label,
    blurb: d.blurb,
    bg: d.vars["--bg"],
    accent: d.vars["--accent"],
  }));
}

/** One line per design, for `deckrun convert --list-designs`. */
export function articleDesignListing(): string[] {
  return DESIGNS.map(
    (d) => `${d.id.padEnd(9)}${d.id === DEFAULT_ARTICLE_DESIGN ? "(default) " : "          "}${d.blurb}`
  );
}

/** The blank-slate article the editor opens with. */
export const WELCOME_ARTICLE = `# Your article title

A plain Markdown file, rendered as one self-contained HTML page. Write or paste
Markdown here, pick a **design** in the top bar, and export the finished page.

## What it handles

- Headings, **bold**, *italic*, [links](https://example.com), and \`inline code\`
- Lists, tables, block quotes, and images
- Code blocks, colored when the page is built
- Math like $e^{i\\pi} + 1 = 0$ and Mermaid diagrams

> Three dashes are just a divider here, not a slide break.

---

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

| Design  | Mood                          |
| ------- | ----------------------------- |
| Dark    | Light on charcoal, blue accent |
| Plain   | Black on white                |
| Crimson | Crimson on cream, serif       |
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  copy: "©", reg: "®", trade: "™", hellip: "…",
  mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  middot: "·", bull: "•", deg: "°", times: "×",
  eacute: "é", egrave: "è", aacute: "á", agrave: "à",
  iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
};

/**
 * Plain text for the title the editor and CLI report. The page's own
 * `<title>` keeps the heading's HTML text as-is instead, so the browser
 * decodes every entity there, not just the ones listed here.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

type HighlightJs = typeof import("highlight.js").default;
let hljsCache: HighlightJs | null = null;

/** Loaded on first use, so commands that never render a page skip its cost. */
function highlighter(): HighlightJs {
  if (!hljsCache) hljsCache = moduleRequire("highlight.js/lib/common") as HighlightJs;
  return hljsCache;
}

export interface ArticleOptions {
  design?: string | null;
  /** Used for `<title>` when the Markdown has no heading. */
  fallbackTitle?: string;
  /**
   * Turns a Markdown image source into what the page should reference. The
   * CLI uses it to inline local files as data URIs; return null to keep the
   * source as written.
   */
  resolveImage?: (src: string) => string | null;
  /**
   * Where KaTeX and Mermaid come from when the page needs them: the pinned
   * CDN for a page that leaves deckrun (the default), or the copies deckrun
   * serves itself for pages it renders locally, which then work offline.
   */
  assets?: "cdn" | "local";
}

export interface RenderedArticle {
  /** The complete HTML document. */
  html: string;
  /** Just what goes inside `<main>`, for updating a page already on screen. */
  body: string;
  /** Plain-text title, taken from the first heading. */
  title: string;
  design: ArticleDesign;
  features: RichFeatures;
}

function markdownToHtml(
  markdown: string,
  resolveImage?: ArticleOptions["resolveImage"]
): { body: string; features: RichFeatures } {
  const features: RichFeatures = { math: false, mermaid: false };
  const md = new Marked({ gfm: true });
  md.use({ extensions: MATH_EXTENSIONS });
  md.use({
    // Read off the tokens, not the output, so prose that merely mentions a
    // class name does not pull in a script the page never uses.
    walkTokens(token) {
      if (token.type === "deckrunBlockMath" || token.type === "deckrunInlineMath") features.math = true;
      else if (token.type === "code" && codeLang(token.lang) === "mermaid") features.mermaid = true;
    },
    renderer: {
      code(code: string, infostring: string | undefined): string {
        const lang = codeLang(infostring);
        // Mermaid stays as source; the page's runtime draws it on load.
        if (lang === "mermaid") {
          return `<pre><code class="language-mermaid">${escapeHtml(code)}</code></pre>\n`;
        }
        const hljs = lang ? highlighter() : null;
        let body: string;
        let cls = "hljs";
        if (hljs && hljs.getLanguage(lang)) {
          body = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          cls += ` language-${escapeHtml(lang)}`;
        } else {
          body = escapeHtml(code);
        }
        return `<pre><code class="${cls}">${body}</code></pre>\n`;
      },
      image(href: string, title: string | null, text: string): string {
        const resolved = (resolveImage && href ? resolveImage(href) : null) ?? href;
        // marked has already escaped the title and alt text; only the source is raw.
        const titleAttr = title ? ` title="${title}"` : "";
        return `<img src="${escapeHtml(resolved)}" alt="${text}"${titleAttr} loading="lazy">`;
      },
    },
  });
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return { body: md.parse(normalized) as string, features };
}

function codeLang(infostring: string | undefined): string {
  return (infostring || "").trim().split(/\s+/)[0].toLowerCase();
}

/** Renders Markdown into one complete, self-contained HTML page. */
export function renderArticle(markdown: string, options: ArticleOptions = {}): RenderedArticle {
  const design = resolveArticleDesign(options.design);
  const spec = DESIGN_BY_ID.get(design)!;
  const { body, features } = markdownToHtml(markdown, options.resolveImage);

  // The heading's text, still HTML-escaped: safe to drop into <title> as is.
  const heading = body.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  const headingHtml = heading ? heading[1].replace(/<[^>]+>/g, "").replace(/</g, "&lt;").trim() : "";
  const fallback = options.fallbackTitle?.trim() || "Untitled";
  const title = (headingHtml && decodeEntities(headingHtml).trim()) || fallback;
  const titleHtml = headingHtml || escapeHtml(fallback);

  const rich = features.math || features.mermaid;
  const vars = Object.entries(spec.vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en" data-design="${design}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="deckrun">
  <meta name="color-scheme" content="${design === "dark" ? "dark" : "light"}">
  <title>${titleHtml}</title>
  ${rich ? richContentHead(features, options.assets === "local" ? "local" : "cdn") : ""}
  <style>
:root {
${vars}
  --font-mono: ${MONO};
}
${ARTICLE_CSS}
${rich ? RICH_CONTENT_CSS : ""}
  </style>
</head>
<body>
<main class="article">
${body}
</main>
${
  rich
    ? `<script>window.deckrunMermaidTheme = ${JSON.stringify(spec.mermaid)};</script>
<script>
${RICH_CONTENT_RUNTIME}
</script>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    if (window.deckrunRenderRichContent) window.deckrunRenderRichContent(document.body);
  });
</script>`
    : ""
}
</body>
</html>
`;

  return { html, body, title, design, features };
}

const ARTICLE_CSS = `
*, *::before, *::after { box-sizing: border-box; }

html {
  background: var(--bg);
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.article {
  max-width: 720px;
  margin: 0 auto;
  padding: 72px 24px 96px;
  overflow-wrap: break-word;
}

.article > :first-child { margin-top: 0; }
.article > :last-child { margin-bottom: 0; }

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-head);
  color: var(--heading);
  line-height: 1.25;
  font-weight: 700;
  margin: 2em 0 0.6em;
  letter-spacing: -0.01em;
}
h1 { font-size: 2.3em; margin-top: 0; letter-spacing: -0.02em; }
h2 { font-size: 1.6em; padding-bottom: 0.3em; border-bottom: 1px solid var(--rule); }
h3 { font-size: 1.3em; }
h4 { font-size: 1.1em; }
h5, h6 { font-size: 1em; color: var(--muted); }

[data-design="crimson"] h1 {
  color: var(--accent);
  padding-bottom: 0.35em;
  border-bottom: 3px double var(--accent);
}
[data-design="crimson"] h2 { border-bottom-color: var(--accent); border-bottom-width: 1px; }

p, ul, ol, dl, table, pre, blockquote, figure { margin: 0 0 1.25em; }

a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}
a:hover { text-decoration-thickness: 2px; }

strong { color: var(--heading); font-weight: 700; }
mark { background: var(--mark); color: inherit; padding: 0 0.15em; border-radius: 2px; }

ul, ol { padding-left: 1.5em; }
li { margin: 0.3em 0; }
li > ul, li > ol { margin: 0.3em 0 0; }
li::marker { color: var(--muted); }
input[type="checkbox"] { margin: 0 0.45em 0 0; accent-color: var(--accent); }

blockquote {
  margin-left: 0;
  margin-right: 0;
  padding: 0.2em 0 0.2em 1.1em;
  border-left: 3px solid var(--quote-bar);
  color: var(--muted);
}
[data-design="crimson"] blockquote { font-style: italic; }
blockquote > :last-child { margin-bottom: 0; }

hr {
  border: 0;
  height: 1px;
  background: var(--rule);
  margin: 2.5em 0;
}

img, video { max-width: 100%; height: auto; border-radius: 6px; }

code, kbd, samp, pre { font-family: var(--font-mono); }

:not(pre) > code {
  font-size: 0.86em;
  padding: 0.15em 0.4em;
  border-radius: 5px;
  background: var(--inline-code-bg);
  color: var(--heading);
}

pre {
  font-size: 0.82em;
  line-height: 1.6;
  padding: 1em 1.2em;
  overflow-x: auto;
  background: var(--surface);
  color: var(--code-text);
  border: 1px solid var(--rule);
  border-radius: 8px;
  tab-size: 2;
}
pre code { background: none; padding: 0; font-size: inherit; color: inherit; }

table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.92em;
}
th, td { padding: 0.5em 0.9em; border: 1px solid var(--rule); text-align: left; }
th { background: var(--surface); color: var(--heading); font-weight: 600; }

kbd {
  font-size: 0.8em;
  padding: 0.1em 0.4em;
  border: 1px solid var(--rule);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--surface);
}

::selection { background: var(--mark); }

/* Code colors, applied at build time so no highlighter loads in the page. */
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-built_in, .hljs-doctag { color: var(--tok-keyword); }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-template-tag, .hljs-template-variable { color: var(--tok-string); }
.hljs-number, .hljs-symbol, .hljs-bullet, .hljs-link { color: var(--tok-number); }
.hljs-comment, .hljs-quote { color: var(--tok-comment); font-style: italic; }
.hljs-title, .hljs-section, .hljs-title.function_ { color: var(--tok-title); }
.hljs-type, .hljs-title.class_, .hljs-class .hljs-title { color: var(--tok-type); }
.hljs-attr, .hljs-attribute, .hljs-variable, .hljs-params, .hljs-property, .hljs-selector-class, .hljs-selector-id { color: var(--tok-attr); }
.hljs-meta, .hljs-name, .hljs-tag { color: var(--tok-meta); }
.hljs-deletion { color: var(--tok-deletion); }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 700; }

@media (max-width: 640px) {
  body { font-size: 17px; }
  .article { padding: 40px 18px 64px; }
  h1 { font-size: 1.9em; }
  h2 { font-size: 1.4em; }
}

@media print {
  body { font-size: 11pt; }
  .article { max-width: none; padding: 0; }
  pre { white-space: pre-wrap; overflow: visible; }
  pre, blockquote, table, img, figure { break-inside: avoid; }
  h1, h2, h3, h4 { break-after: avoid; }
}
`;
