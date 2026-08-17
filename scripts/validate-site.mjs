import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve(process.argv[2] || 'public');
const siteOrigin = 'https://subhash.net';
const legacyDomain = ['subhashdasyam', 'com'].join('.');
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(item));
    else files.push(item);
  }
  return files;
}

async function text(file) {
  return readFile(file, 'utf8');
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function publicPath(file) {
  return path.relative(outputRoot, file).split(path.sep).join('/');
}

function expectedCanonical(relative) {
  if (relative === 'index.html') return `${siteOrigin}/`;
  const route = relative.endsWith('/index.html')
    ? relative.slice(0, -'index.html'.length)
    : relative;
  return new URL(`/${route}`, siteOrigin).href;
}

function internalTarget(value, sourceFile) {
  if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('mailto:') || value.startsWith('tel:')) return null;
  let url;
  try {
    const sourceURL = new URL(`/${sourceFile.replace(/index\.html$/, '')}`, siteOrigin);
    url = new URL(value.replace(/&amp;/g, '&'), sourceURL);
  } catch {
    return null;
  }
  if (url.origin !== siteOrigin) return null;
  let target = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!target || target.endsWith('/')) target += 'index.html';
  else if (!path.posix.extname(target)) target += '/index.html';
  return target;
}

const required = [
  'index.html',
  'about/index.html',
  'posts/index.html',
  'search/index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'index.xml',
  'index.json',
  'search-index.json',
  'llms.txt',
  'site.webmanifest',
  '_headers',
];

let publicFiles = [];
try {
  publicFiles = await walk(outputRoot);
} catch (error) {
  console.error(`Cannot read build output at ${outputRoot}: ${error.message}`);
  process.exit(1);
}

const publicNames = new Set(publicFiles.map(publicPath));
for (const file of required) check(publicNames.has(file), `Missing generated file: ${file}`);

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.txt', '.xml']);
for (const file of publicFiles) {
  if (!textExtensions.has(path.extname(file))) continue;
  const body = await text(file);
  const relative = publicPath(file);
  check(!/[\u2013\u2014]/u.test(body), `Unicode dash found in generated file: ${relative}`);
  check(!body.includes(legacyDomain), `Legacy domain found in generated file: ${relative}`);
}

const htmlFiles = publicFiles.filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const body = await text(file);
  const relative = publicPath(file);
  const isAlias = /<meta http-equiv=(?:"refresh"|refresh)\b/i.test(body);
  if (isAlias) {
    check(/<link rel=(?:"canonical"|canonical)\b/i.test(body), `${relative} alias has no canonical target`);
    continue;
  }

  const h1Count = (body.match(/<h1\b/gi) || []).length;
  check(h1Count === 1, `${relative} has ${h1Count} h1 elements`);
  check(/<meta name=(?:"description"|description)\s+content=/i.test(body), `${relative} has no description`);
  check(/<meta property=(?:"og:title"|og:title)\s+content=/i.test(body), `${relative} has no Open Graph title`);

  const jsonLD = body.match(/<script type=(?:"application\/ld\+json"|application\/ld\+json)>(.+?)<\/script>/is)?.[1];
  check(Boolean(jsonLD), `${relative} has no JSON-LD`);
  if (jsonLD) {
    try {
      JSON.parse(jsonLD);
    } catch (error) {
      errors.push(`${relative} has invalid JSON-LD: ${error.message}`);
    }
  }

  const canonicalMatch = body.match(/<link rel=(?:"canonical"|canonical)\s+href=(?:"([^"]+)"|([^\s>]+))/i);
  const canonical = canonicalMatch?.[1] || canonicalMatch?.[2];
  if (relative === '404.html') {
    check(!canonical, '404.html must not declare a canonical URL');
    check(/<meta name=(?:"robots"|robots)\s+content="?noindex,follow"?/i.test(body), '404.html must be noindex');
  } else {
    check(canonical === expectedCanonical(relative), `${relative} has incorrect canonical: ${canonical || 'missing'}`);
  }

  if (relative === 'search/index.html') {
    check(/<meta name=(?:"robots"|robots)\s+content="?noindex,follow"?/i.test(body), 'Search page must be noindex');
  }

  const attributes = body.matchAll(/\b(?:href|src)=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi);
  for (const match of attributes) {
    const value = match[1] || match[2] || match[3];
    const target = internalTarget(value, relative);
    if (target) check(publicNames.has(target), `${relative} links to missing file: ${target}`);
  }
}

const articlePages = [...publicNames].filter((name) =>
  name.startsWith('posts/') && name.endsWith('/index.html') && name !== 'posts/index.html' && !name.includes('/page/')
);
for (const article of articlePages) {
  const markdown = article.replace(/index\.html$/, 'index.md');
  check(publicNames.has(markdown), `Article has no Markdown output: ${article}`);
}

try {
  const feed = JSON.parse(await text(path.join(outputRoot, 'index.json')));
  check(feed.version === 'https://jsonfeed.org/version/1.1', 'JSON Feed has the wrong version');
  check(Array.isArray(feed.items), 'JSON Feed items must be an array');
  check(feed.items.length === articlePages.length, 'JSON Feed article count does not match HTML article count');
} catch (error) {
  errors.push(`Invalid JSON Feed: ${error.message}`);
}

try {
  const searchIndex = JSON.parse(await text(path.join(outputRoot, 'search-index.json')));
  check(Array.isArray(searchIndex), 'Search index must be an array');
  check(searchIndex.length === articlePages.length, 'Search index article count does not match HTML article count');
} catch (error) {
  errors.push(`Invalid search index: ${error.message}`);
}

try {
  const manifest = JSON.parse(await text(path.join(outputRoot, 'site.webmanifest')));
  check(manifest.name === 'Subhash Dasyam', 'Web manifest has the wrong name');
  check(manifest.short_name === 'Subhash', 'Web manifest has the wrong short name');
} catch (error) {
  errors.push(`Invalid web manifest: ${error.message}`);
}

const robots = await text(path.join(outputRoot, 'robots.txt'));
check(robots.includes('Allow: /'), 'robots.txt must allow crawling');
check(robots.includes('Content-Signal: ai-train=yes, search=yes, ai-input=yes'), 'robots.txt has no affirmative Content Signal');
check(robots.includes('Sitemap: https://subhash.net/sitemap.xml'), 'robots.txt has the wrong sitemap URL');

const sitemap = await text(path.join(outputRoot, 'sitemap.xml'));
check(sitemap.includes('<loc>https://subhash.net/</loc>'), 'Sitemap is missing the homepage');
check(sitemap.includes('<loc>https://subhash.net/about/</loc>'), 'Sitemap is missing the About page');
check(!sitemap.includes('/search/'), 'Sitemap must not include the search page');
check(!sitemap.includes('/tags/'), 'Sitemap must not include taxonomy archives');

const llms = await text(path.join(outputRoot, 'llms.txt'));
check(llms.includes('# Subhash Dasyam'), 'llms.txt has the wrong title');
check(llms.includes('https://subhash.net/about/'), 'llms.txt is missing the About page');
const markdownLinks = (llms.match(/Raw Markdown:/g) || []).length;
check(markdownLinks === articlePages.length, 'llms.txt article count does not match HTML article count');

const headers = await text(path.join(outputRoot, '_headers'));
check(headers.includes('Link: </llms.txt>'), '_headers has no llms.txt Link header');
check(headers.includes('X-Robots-Tag: noindex'), '_headers has no noindex rule for alternate formats');

const sourceRoots = ['archetypes', 'config', 'content', 'layouts', 'scripts', 'themes'];
for (const sourceRoot of sourceRoots) {
  let files = [];
  try {
    files = await walk(path.resolve(sourceRoot));
  } catch {
    continue;
  }
  for (const file of files) {
    if (!textExtensions.has(path.extname(file))) continue;
    const body = await text(file);
    const relative = path.relative(process.cwd(), file);
    check(!/[\u2013\u2014]/u.test(body), `Unicode dash found in source file: ${relative}`);
    check(!body.includes(legacyDomain), `Legacy domain found in active source file: ${relative}`);
  }
}

if (errors.length) {
  console.error(`Site validation failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Site validation passed: ${htmlFiles.length} HTML pages, ${articlePages.length} published posts.`);
