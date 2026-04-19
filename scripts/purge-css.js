#!/usr/bin/env node
/**
 * CSS purge step — remove unused selectors from public/*.css using PurgeCSS.
 * Content is scanned from public/**.{js,html} to detect usage (including
 * dynamic `classList.add`, `className = ...`, etc.).
 *
 * Outputs:
 *   - public/style.purged.css
 *   - public/addictionStyles.purged.css
 *
 * Safelist is permissive to avoid FOUC / broken UI for runtime-added classes
 * that PurgeCSS cannot statically detect.
 */

const fs = require('fs');
const path = require('path');
const { PurgeCSS } = require('purgecss');

const PUBLIC = path.resolve(__dirname, '../public');

const CSS_FILES = ['style.css', 'addictionStyles.css'];

// Content sources: every .js and .html file under public/.
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      return walk(p);
    }
    if (e.name.endsWith('.js') || e.name.endsWith('.html')) {
      return [p];
    }
    return [];
  });
}

async function main() {
  const content = walk(PUBLIC).map(file => ({
    raw: fs.readFileSync(file, 'utf8'),
    extension: path.extname(file).slice(1)
  }));
  console.log(`Scanning ${content.length} source files for class usage...`);

  const results = await new PurgeCSS().purge({
    content,
    css: CSS_FILES.map(f => ({ raw: fs.readFileSync(path.join(PUBLIC, f), 'utf8'), name: f })),
    safelist: {
      // Classes we know are added dynamically via string concatenation that
      // PurgeCSS cannot statically detect (confirmed by grepping JS sources).
      standard: [
        'html',
        'body',
        /^is-/,
        /^has-/,
        'active',
        'show',
        'hide',
        'hidden',
        'visible',
        'open',
        'closed',
        'disabled',
        'loading',
        'error',
        'success',
        'warning',
        /^fade/,
        /^slide/,
        /^pop/,
        /^bounce/,
        /^pulse/,
        /^shake/,
        /^glow/,
        // Rarity/tier modifiers composed at runtime (e.g. `mission-card-inner ${rarity}`).
        'common',
        'rare',
        'epic',
        'legendary',
        'mythic'
      ],
      // Preserve selectors matching runtime-built names.
      greedy: [/^@keyframes/]
    },
    keyframes: true,
    variables: true,
    fontFace: true,
    blocklist: [], // add rules we want to force-remove here later
    rejected: true // expose removed selectors on results for audit
  });

  const totals = { before: 0, after: 0 };
  for (const r of results) {
    const name = r.file || r.source || '';
    // Map back to original filename since PurgeCSS returns the `name` we passed.
    const origName = CSS_FILES.find(f => name.endsWith(f)) || CSS_FILES.shift();
    const outFile = path.join(PUBLIC, origName.replace('.css', '.purged.css'));
    const beforeSize = Buffer.byteLength(
      fs.readFileSync(path.join(PUBLIC, origName), 'utf8'),
      'utf8'
    );
    const afterSize = Buffer.byteLength(r.css, 'utf8');
    fs.writeFileSync(outFile, r.css);
    totals.before += beforeSize;
    totals.after += afterSize;
    const pct = ((1 - afterSize / beforeSize) * 100).toFixed(1);
    console.log(
      `${origName}: ${(beforeSize / 1024).toFixed(1)}K -> ${(afterSize / 1024).toFixed(1)}K (-${pct}%)`
    );
  }

  const totalPct = ((1 - totals.after / totals.before) * 100).toFixed(1);
  console.log(
    `TOTAL: ${(totals.before / 1024).toFixed(1)}K -> ${(totals.after / 1024).toFixed(1)}K (-${totalPct}%)`
  );
}

main().catch(err => {
  console.error('CSS purge failed:', err);
  process.exit(1);
});
