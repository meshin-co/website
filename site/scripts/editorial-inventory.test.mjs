import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  collectionRows,
  componentRows,
  constantRows,
  renderedRows,
  mergeRows,
  unrowedStrings,
  reviewGaps,
  deadCopy,
  untraceableText,
} from './editorial-inventory.mjs';

test('a collection entry yields one row per editable text field, keyed by file and field', () => {
  const rows = collectionRows([
    {
      file: 'src/data/faq/example.md',
      frontmatter: { title: 'What a CAIO does', shortAnswer: 'A short answer.', updatedDate: '2026-09-01' },
      body: 'The body prose.\n\nA second paragraph.',
    },
  ]);
  assert.deepEqual(rows.map((row) => row.location).sort(), ['body', 'frontmatter.shortAnswer', 'frontmatter.title']);
  assert.equal(
    rows.every((row) => row.file === 'src/data/faq/example.md' && row.status === 'unreviewed'),
    true
  );
});

test('a date is not a text row, because there is nothing to edit in it', () => {
  const rows = collectionRows([
    { file: 'a.md', frontmatter: { updatedDate: '2026-09-01', sources: ['https://example.com'] }, body: '' },
  ]);
  assert.deepEqual(rows, []);
});

test('component copy is found in text nodes and in the attributes that carry prose', () => {
  const rows = componentRows([
    {
      file: 'src/components/Nav.astro',
      source:
        '<a href="/about" aria-label="About the practice">About</a>\n<input placeholder="Search the site" />\n<img alt="A diagram" src="x.png" />',
    },
  ]);
  assert.deepEqual(rows.map((row) => row.text).sort(), ['A diagram', 'About', 'About the practice', 'Search the site']);
  assert.equal(rows.find((row) => row.text === 'About the practice').location, 'attribute.aria-label');
});

test('markup, class names, urls and expressions are not copy', () => {
  const rows = componentRows([
    {
      file: 'x.astro',
      source: '<div class="mt-3 flex">{title}</div>\n<a href="/pricing">{label}</a>\n<span>{i18n.key}</span>',
    },
  ]);
  assert.deepEqual(rows, []);
});

test('string constants in code are rowed with their key path', () => {
  const rows = constantRows([
    { file: 'src/data/home.ts', source: "export const hero = { title: 'Ship AI safely', cta: 'Book a call' };" },
  ]);
  assert.deepEqual(rows.map((row) => [row.location, row.text]).sort(), [
    ['constant.cta', 'Book a call'],
    ['constant.title', 'Ship AI safely'],
  ]);
});

test('a rendered route contributes its title, description and visible prose', () => {
  const rows = renderedRows([
    {
      route: '/about',
      html: '<html><head><title>About · meshin.co</title><meta name="description" content="Who runs this."></head><body><main><h1>About</h1><p>One sentence of prose.</p></main></body></html>',
    },
  ]);
  const byLocation = Object.fromEntries(rows.map((row) => [row.location, row.text]));
  assert.equal(byLocation['head.title'], 'About · meshin.co');
  assert.equal(byLocation['head.description'], 'Who runs this.');
  assert.equal(byLocation['body.h1'], 'About');
});

test('one string used on many pages collapses to a single row listing every usage', () => {
  const merged = mergeRows([
    { file: 'a.astro', location: 'text', text: 'Book a call', status: 'unreviewed' },
    { file: 'b.astro', location: 'text', text: 'Book a call', status: 'unreviewed' },
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].usedIn, ['a.astro', 'b.astro']);
});

test('a string present in the build but absent from the inventory is reported, which is what proves nothing was skipped', () => {
  const missing = unrowedStrings(
    [{ route: '/x', html: '<main><p>An unrowed sentence that ships.</p></main>' }],
    [{ text: 'Something else entirely', usedIn: ['a.astro'] }]
  );
  assert.deepEqual(missing, [{ route: '/x', text: 'An unrowed sentence that ships.' }]);
});

test('a row still unreviewed fails the gate, and a dispositioned row does not', () => {
  const gaps = reviewGaps([
    { text: 'a', status: 'unreviewed', usedIn: ['a'] },
    { text: 'b', status: 'rewritten', usedIn: ['b'] },
    { text: 'c', status: 'owner-blocked', reason: 'needs a real client name', usedIn: ['c'] },
  ]);
  assert.deepEqual(
    gaps.map((gap) => gap.text),
    ['a']
  );
});

test('owner-blocked without a reason is a gap, because a blocked row must say who is blocked on what', () => {
  assert.equal(reviewGaps([{ text: 'c', status: 'owner-blocked', usedIn: ['c'] }]).length, 1);
});

test('source copy that no page ships is dead copy, and is reported', () => {
  const dead = deadCopy(
    [{ text: 'A sentence no page renders.', usedIn: ['src/data/home.ts'] }],
    [{ route: '/', html: '<main><p>What the page really says.</p></main>' }]
  );
  assert.deepEqual(dead, [{ text: 'A sentence no page renders.', usedIn: ['src/data/home.ts'] }]);
});

test('source copy the build does ship is not dead, even when the page wraps it in markup', () => {
  const dead = deadCopy(
    [{ text: 'Book a call', usedIn: ['x.astro'] }],
    [{ route: '/', html: '<main><p>Ready? <a href="/contact">Book a call</a> today.</p></main>' }]
  );
  assert.deepEqual(dead, []);
});

test('a shipped paragraph that traces to no source row is untraceable, which is how a skipped text is caught', () => {
  const untraceable = untraceableText(
    [{ route: '/x', html: '<main><p>Copy that exists in no source file.</p></main>' }],
    [{ text: 'Something else', usedIn: ['a.astro'] }]
  );
  assert.deepEqual(untraceable, [{ route: '/x', text: 'Copy that exists in no source file.' }]);
});

test('a shipped paragraph assembled from a source row counts as traceable', () => {
  const untraceable = untraceableText(
    [{ route: '/x', html: '<main><p>The body prose.</p></main>' }],
    [{ text: 'The body prose.\n\nAnd more of it.', usedIn: ['a.md'] }]
  );
  assert.deepEqual(untraceable, []);
});

test('any frontmatter value that is a sentence is copy, whatever the field is called', () => {
  const rows = collectionRows([
    {
      file: 'g.md',
      frontmatter: {
        shortDefinition: 'AI governance is the accountability layer above an AI system.',
        definition: 'A longer block of prose.\n\nWith two paragraphs.',
        slug: 'ai-governance',
        updatedDate: '2026-09-01',
        relatedTerms: ['model-risk'],
        draft: false,
        sources: ['https://example.com'],
      },
      body: '',
    },
  ]);
  assert.deepEqual(rows.map((row) => row.location).sort(), ['frontmatter.definition', 'frontmatter.shortDefinition']);
});

test('a one-word or identifier-shaped value is not copy, so slugs and tags stay out of the ledger', () => {
  const rows = collectionRows([
    { file: 'g.md', frontmatter: { category: 'governance', title: 'Two words here' }, body: '' },
  ]);
  assert.deepEqual(
    rows.map((row) => row.location),
    ['frontmatter.title']
  );
});

test('an apostrophe inside a double-quoted constant does not hide the string', () => {
  const rows = constantRows([
    { file: 'src/data/home.ts', source: `  sub: "I'm the officer your org chart can point at.",` },
  ]);
  assert.deepEqual(
    rows.map((row) => row.text),
    ["I'm the officer your org chart can point at."]
  );
});

test('a template literal constant is copy too', () => {
  const rows = constantRows([{ file: 'x.ts', source: 'title: `Two or more words`,' }]);
  assert.deepEqual(
    rows.map((row) => row.text),
    ['Two or more words']
  );
});

test('prose passed as a component prop is copy, whatever the prop is called', () => {
  const rows = componentRows([
    {
      file: 'src/pages/index.astro',
      source:
        '<Section\n    lead="Three ways in. Each one ends with an artifact."\n    class="mt-3 flex gap-4"\n    href="/services"\n  />',
    },
  ]);
  assert.deepEqual(
    rows.map((row) => [row.location, row.text]),
    [['attribute.lead', 'Three ways in. Each one ends with an artifact.']]
  );
});

test('structural attributes are never copy, however wordy they look', () => {
  const rows = componentRows([
    {
      file: 'x.astro',
      source: '<img src="/og/a.png" id="hero card" style="color: red" datetime="2026-09-01" width="12" />',
    },
  ]);
  assert.deepEqual(rows, []);
});

test('render-composed metadata lines are not authored copy, so they do not count as untraceable', () => {
  const untraceable = untraceableText(
    [
      { route: '/blog', html: '<main><p>08 Sept 2026 · 6 min read · AI governance</p></main>' },
      { route: '/blog', html: '<main><p>acceptable-use-policy · ai-governance · shadow-ai</p></main>' },
    ],
    []
  );
  assert.deepEqual(untraceable, []);
});

test('a source line stays composed metadata however many words the publisher name holds', () => {
  const untraceable = untraceableText(
    [
      { route: '/a', html: '<main><p>European Commission · retrieved 2026-10-02</p></main>' },
      { route: '/b', html: '<main><p>UK Financial Conduct Authority · retrieved 2026-10-02</p></main>' },
      {
        route: '/c',
        html: '<main><p>European Commission, AI Act Service Desk · retrieved 2026-10-02</p></main>',
      },
    ],
    []
  );
  assert.deepEqual(untraceable, []);
});

test('a sentence that merely mentions retrieval is still authored copy', () => {
  const untraceable = untraceableText(
    [
      {
        route: '/x',
        html: '<main><p>The European Commission retrieved the register before 2026-10-02 and published it.</p></main>',
      },
    ],
    []
  );
  assert.equal(untraceable.length, 1);
});

test('a real sentence is still untraceable even when it contains a date or a separator', () => {
  const untraceable = untraceableText(
    [
      {
        route: '/x',
        html: '<main><p>I published the register template on 08 Sept 2026 after two client reviews.</p></main>',
      },
    ],
    []
  );
  assert.equal(untraceable.length, 1);
});

test('prose nested inside a frontmatter list is copy, so a post FAQ block cannot hide', () => {
  const rows = collectionRows([
    {
      file: 'p.md',
      frontmatter: {
        faq: [{ question: 'Does this need a policy?', answer: 'Yes. Once more than one person can install it.' }],
      },
      body: '',
    },
  ]);
  assert.deepEqual(rows.map((row) => row.location).sort(), ['frontmatter.faq.0.answer', 'frontmatter.faq.0.question']);
});

test('a paragraph built around an inline link traces to the source sentence it was assembled from', () => {
  const untraceable = untraceableText(
    [{ route: '/x', html: '<main><p>Or browse every article by <a href="/blog/tags">tag</a>.</p></main>' }],
    [{ text: 'Or browse every article by', usedIn: ['a.astro'] }]
  );
  assert.deepEqual(untraceable, []);
});

test('a space left before punctuation by an inline link does not make a sentence untraceable', () => {
  const untraceable = untraceableText(
    [
      {
        route: '/x',
        html: '<main><p>The version is public at <a href="/ai-policy">my AI policy</a> , one page long.</p></main>',
      },
    ],
    [{ text: 'The version is public at [my AI policy](/ai-policy), one page long.', usedIn: ['p.md'] }]
  );
  assert.deepEqual(untraceable, []);
});

test('a bare hostname rendered from a source url is not authored copy', () => {
  assert.deepEqual(untraceableText([{ route: '/x', html: '<main><p>iso.org</p></main>' }], []), []);
});

test('svg geometry is not copy, however many letters it contains', () => {
  const rows = componentRows([
    { file: 'LogoMark.astro', source: '<path d="M704.67 424.1A305 305 0 0 1 703.13 443.73L532.18 424.71" />' },
  ]);
  assert.deepEqual(rows, []);
});

test('a code fragment caught between quotes is not copy', () => {
  const rows = constantRows([
    { file: 'pipeline.mjs', source: 'const http = "&& url.protocol !==";\n  const label = "Read the register";' },
  ]);
  assert.deepEqual(
    rows.map((row) => row.text),
    ['Read the register']
  );
});

test('text shipped in a meta attribute counts as shipped, so a description is not dead copy', () => {
  const dead = deadCopy(
    [{ text: 'AI governance is the decisions, roles and controls.', usedIn: ['g.md'] }],
    [
      {
        route: '/x',
        html: '<head><meta name="description" content="AI governance is the decisions, roles and controls."></head><body></body>',
      },
    ]
  );
  assert.deepEqual(dead, []);
});

test('text shipped only in a machine surface counts as shipped', () => {
  const dead = deadCopy(
    [{ text: 'Platform engineer working as a Fractional Chief AI Officer.', usedIn: ['machine-text.mjs'] }],
    [{ route: '/llms.txt', html: 'Platform engineer working as a Fractional Chief AI Officer.' }]
  );
  assert.deepEqual(dead, []);
});

test('a source comment is never copy, in a component or in code', () => {
  assert.deepEqual(
    componentRows([
      {
        file: 'x.astro',
        source:
          '---\n// Single source of truth for applying the theme.\n/* a block comment with words */\n---\n<p>Real copy here</p>',
      },
    ]).map((row) => row.text),
    ['Real copy here']
  );
  assert.deepEqual(
    constantRows([{ file: 'x.mjs', source: "// label = 'Commented out copy'\nconst label = 'Live copy here';" }]).map(
      (row) => row.text
    ),
    ['Live copy here']
  );
});

test('prose shipped inside a link title or aria-label counts as shipped', () => {
  const dead = deadCopy(
    [{ text: 'meshin.co — JSON Feed', usedIn: ['CommonMeta.astro'] }],
    [{ route: '/x', html: '<head><link rel="alternate" title="meshin.co — JSON Feed" href="/feed.json"></head>' }]
  );
  assert.deepEqual(dead, []);
});

test('type annotations and expressions from a component script are not copy', () => {
  const notCopy = [
    '; secondaryLinks: Array',
    'source.publisher ?? new URL(source.url).hostname.replace(/^www./, )',
    'items?.map((item) => item.title)',
  ];
  for (const source of notCopy) {
    assert.deepEqual(constantRows([{ file: 'x.astro', source: `key: "${source}"` }]), [], source);
  }
});

test('real copy containing a parenthesis or a question mark survives', () => {
  const rows = constantRows([
    { file: 'x.astro', source: 'lead: "Is my company too small? Probably not (thirty people is enough)."' },
  ]);
  assert.equal(rows.length, 1);
});

test('a class list is not copy, whichever extractor sees it', () => {
  assert.deepEqual(constantRows([{ file: 'x.astro', source: 'class: "w-6 h-6 lg:w-5 lg:inline-block"' }]), []);
  assert.deepEqual(constantRows([{ file: 'x.astro', source: 'wrapper: "mt-3 flex items-center gap-4"' }]), []);
});

test('a structural key never yields copy even when its value reads like words', () => {
  assert.deepEqual(constantRows([{ file: 'x.astro', source: 'id: "hero card wide"' }]), []);
});

test('script and style bodies are never copy', () => {
  const rows = componentRows([
    {
      file: 'Header.astro',
      source:
        '<script>const header = document.querySelector("#header"); const toggle = 1;</script>\n<style>.a { color: red }</style>\n<p>Real copy</p>',
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.text),
    ['Real copy']
  );
});

test('a structural media query is not copy', () => {
  assert.deepEqual(
    componentRows([
      {
        file: 'Layout.astro',
        source: '<meta name="theme-color" content="#fbfaf7" media="(prefers-color-scheme: light)" />',
      },
    ]).map((row) => row.location),
    []
  );
});

test('a font stack is a design token, not copy', () => {
  assert.deepEqual(constantRows([{ file: 'og-template.mjs', source: "const SANS_FONT = 'IBM Plex Sans';" }]), []);
  assert.deepEqual(
    constantRows([{ file: 'x.mjs', source: "const stack = 'ui-sans-serif, system-ui, sans-serif';" }]),
    []
  );
  assert.equal(constantRows([{ file: 'x.mjs', source: "const label = 'Read the register';" }]).length, 1);
});

test('prose inside an array literal is copy, keyed by the array it belongs to', () => {
  const rows = constantRows([
    {
      file: 'categories.mjs',
      source:
        "  body: [\n    'An agent demo is easy and production is not.',\n    'Start with evaluation, before the prompt.',\n  ],",
    },
  ]);
  assert.deepEqual(
    rows.map((row) => [row.location, row.text]),
    [
      ['constant.body', 'An agent demo is easy and production is not.'],
      ['constant.body', 'Start with evaluation, before the prompt.'],
    ]
  );
});

test('an array of slugs or tokens is not copy', () => {
  assert.deepEqual(constantRows([{ file: 'x.mjs', source: "tags: ['ai-governance', 'shadow-ai']," }]), []);
});

test('prose about a new AI tool is copy; a constructor call is not', () => {
  const rows = collectionRows([
    {
      file: 'p.md',
      frontmatter: {
        fullAnswer: 'A policy earns its place once it decides who approves a new AI tool and which data may reach it.',
        junk: 'const url = new URL(source.url).hostname',
      },
      body: '',
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.location),
    ['frontmatter.fullAnswer']
  );
});

test('a one-word label is not an untraceable paragraph, but a real short sentence still is', () => {
  assert.deepEqual(untraceableText([{ route: '/x', html: '<main><p>Concerns</p></main>' }], []), []);
  assert.equal(untraceableText([{ route: '/x', html: '<main><p>Nobody owns this yet.</p></main>' }], []).length, 1);
});

test('a template sentence split by an interpolation traces to its longest source fragment', () => {
  assert.deepEqual(
    untraceableText(
      [{ route: '/x', html: '<main><p>Every article tagged AI governance, newest first.</p></main>' }],
      [{ text: 'Every article tagged', usedIn: ['tag.astro'] }]
    ),
    []
  );
  assert.equal(
    untraceableText(
      [{ route: '/x', html: '<main><p>Every article tagged AI governance, newest first.</p></main>' }],
      [{ text: 'newest first', usedIn: ['tag.astro'] }]
    ).length,
    1
  );
});

test('a leaked code fragment is not copy', () => {
  assert.deepEqual(
    constantRows([
      { file: 'x.astro', source: 'const posts = data.filter((d) => !d.draft); const byCategory = new Map();' },
    ]),
    []
  );
});

test('a template literal yields its literal parts, not the interpolation', () => {
  const rows = constantRows([
    { file: 'tag.astro', source: 'const lead = `Every article tagged ${title}, newest first.`;' },
  ]);
  assert.deepEqual(rows.map((row) => row.text).sort(), ['Every article tagged']);
});

test('prose citing a legal article with a clause number is copy', () => {
  const rows = collectionRows([
    { file: 'g.md', frontmatter: { definition: 'Article 6(1) covers the first route into the category.' }, body: '' },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(constantRows([{ file: 'x.mjs', source: "const n = 'node.querySelector(sel).value';" }]), []);
});

test('a teaser that adds a full stop still traces to the sentence it was cut from', () => {
  assert.deepEqual(
    untraceableText(
      [{ route: '/faq', html: '<main><p>A named officer on your security reviews.</p></main>' }],
      [{ text: 'A named officer on your security reviews and your board', usedIn: ['a.md'] }]
    ),
    []
  );
});

test('text shipped only inside json-ld counts as shipped', () => {
  assert.deepEqual(
    deadCopy(
      [{ text: 'LLM evaluation', usedIn: ['jsonld.mjs'] }],
      [
        {
          route: '/x',
          html: '<script type="application/ld+json">{"knowsAbout":["LLM evaluation"]}</script><main></main>',
        },
      ]
    ),
    []
  );
});

test('a sentence split around an inline link traces by word overlap', () => {
  assert.deepEqual(
    untraceableText(
      [{ route: '/x', html: '<main><p>Email hello@meshin.co with what you found and how to reproduce it.</p></main>' }],
      [
        {
          text: 'with what you found and how to reproduce it. I reply within two working days.',
          usedIn: ['security.astro'],
        },
      ]
    ),
    []
  );
  assert.equal(
    untraceableText(
      [{ route: '/x', html: '<main><p>A sentence sharing almost nothing with the source row.</p></main>' }],
      [{ text: 'with what you found and how to reproduce it', usedIn: ['security.astro'] }]
    ).length,
    1
  );
});

test('a code tail leaking from a component script is not copy', () => {
  assert.deepEqual(
    constantRows([{ file: 'pricing.astro', source: "const g = 'serviceNode(site, service, links)), ]; ---';" }]),
    []
  );
});
