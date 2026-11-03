#!/usr/bin/env node
/* Node 18+. Usage: node publish-person-site.mjs data.json [--dry-run]; page allows themeColor/fontFamily/darkMode; locales require sections and project-cards require items.
 * Only avatar/icon/screenshot.url and images items upload relative PNG/JPEG/GIF/WebP/SVG files contained in the real data directory; absolute, .env* segments and symlink escapes are refused; links pass through. */
import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, extname, basename, isAbsolute, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const dryRun = process.argv.includes('--dry-run');
const input = process.argv.slice(2).find(arg => arg !== '--dry-run');
const base = (process.env.APPAI_BASE_URL || 'https://appai.info').replace(/\/$/, '');
const key = process.env.APPAI_API_KEY;
const cache = new Map();
const types = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
async function request(path, body, multipart = false) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
    body: multipart ? body : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${text}`);
    if (response.status === 403 && /limit|plan/i.test(text)) console.error('Plan limit reached: use child pages (parentSlug) and locale variants; remove unused roots or upgrade your plan.');
    throw new Error('Request failed; publishing stopped.');
  }
  return JSON.parse(text);
}
export async function resolveImagePath(url, directory) {
  if (isAbsolute(url) || /^[A-Za-z]:[\\/]/.test(url)) throw new Error('Absolute image paths are not allowed.');
  if (url.split(/[\\/]/).some(part => /^\.env/i.test(part))) throw new Error('Secret .env* path segments are not allowed.');
  if (!Object.hasOwn(types, extname(url).toLowerCase())) throw new Error('Image extension must be .png, .jpg, .jpeg, .gif, .webp or .svg.');
  const root = await realpath(directory);
  const target = await realpath(resolve(root, url));
  const offset = relative(root, target);
  if (!offset || offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new Error('Image must be inside the data directory.');
  if (target.split(/[\\/]/).some(part => /^\.env/i.test(part))) throw new Error('Secret .env* path segments are not allowed.');
  if (!Object.hasOwn(types, extname(target).toLowerCase())) throw new Error('Resolved image extension is not allowed.');
  return target;
}
async function uploadUrl(url, directory) {
  const path = await resolveImagePath(url, directory);
  if (!cache.has(path)) {
    const type = types[extname(path).toLowerCase()];
    const bytes = await readFile(path);
    if (bytes.length > 5 * 1024 * 1024) throw new Error('File exceeds 5 MB.');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), basename(path));
    const uploaded = await request('/api/v1/upload', form, true);
    if (typeof uploaded.url !== 'string') throw new Error('Upload response is missing url.');
    cache.set(path, uploaded.url);
  }
  return cache.get(path);
}
export async function uploadTree(value, directory, upload = uploadUrl, imageItem = false) {
  if (typeof value === 'string') return imageItem && !/^(https?:|\/|#)/i.test(value) ? upload(value, directory) : value;
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) result.push(await uploadTree(item, directory, upload));
    return result;
  }
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [field, child] of Object.entries(value)) {
    if (field === 'url' && imageItem) result[field] = await uploadTree(child, directory, upload, true);
    else if (field === 'images' && Array.isArray(child)) {
      result[field] = [];
      for (const item of child) result[field].push(await uploadTree(item, directory, upload, true));
    } else result[field] = await uploadTree(child, directory, upload, ['avatar', 'icon', 'screenshot'].includes(field) && child !== null && typeof child === 'object' && !Array.isArray(child));
  }
  return result;
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateData(data) {
  if (!object(data)) throw new Error('Data must be an object.');
  if (data.page !== undefined && (!object(data.page) || Object.keys(data.page).some(key => !['themeColor', 'fontFamily', 'darkMode'].includes(key)))) throw new Error('page may only contain themeColor, fontFamily and darkMode.');
  if (!object(data.locales) || !Object.keys(data.locales).length) throw new Error('locales must be a non-empty object.');
  for (const [locale, person] of Object.entries(data.locales)) {
    if (!object(person) || !Array.isArray(person.sections)) throw new Error(`Locale ${locale}: sections must be an array.`);
    for (const section of person.sections) {
      if (!object(section)) throw new Error(`Locale ${locale}: sections must contain objects.`);
      if (section.type === 'project-cards' && (!object(section.data) || !Array.isArray(section.data.items) || section.data.items.some(item => !object(item)))) throw new Error(`Locale ${locale}: project-cards items must be an array of objects.`);
    }
  }
}
function orderedSections(sections) {
  return sections.map(({ id, ...section }, order) => ({ ...section, order, data: { ...section.data, ...(id !== undefined ? { id } : {}) } }));
}
async function publish(payload, url) {
  if (dryRun) {
    const result = await request('/api/v1/pages/preview?upsert=true', payload);
    if (!result.valid) throw new Error(`Invalid payload: ${JSON.stringify(result.errors)}`);
    if (result.warnings?.length) console.error(JSON.stringify(result.warnings));
  } else await request('/api/v1/pages?upsert=true', payload);
  console.log(`${dryRun ? 'Validated: ' : ''}${url}`);
}
async function main() {
  if (!input || !key) throw new Error('Usage: APPAI_API_KEY=... node publish-person-site.mjs data.json [--dry-run]');
  const path = resolve(input);
  if (/^\.env/i.test(basename(path))) throw new Error('Provide a JSON data file.');
  const data = JSON.parse(await readFile(path, 'utf8'));
  validateData(data);
  const directory = dirname(path);
  const locales = Object.entries(data.locales || {});
  if (!locales.length) throw new Error('Provide at least one locale.');
  const roots = [];
  const children = [];
  const projects = [];
  for (const [index, [locale, person]] of locales.entries()) {
    const suffix = index ? `/${locale}` : '';
    const rootPath = `/p/${data.slug}${suffix}`;
    const sections = [];
    const common = { ...data.page, locale, isPublished: true };
    for (const raw of person.sections) {
      const section = { ...raw, data: await uploadTree(raw.data, directory) };
      if (section.type === 'project-cards') {
        const cards = [];
        for (const item of section.data.items) {
          const { page, ...card } = item;
          if (page) {
            if (page.as && !['child', 'root'].includes(page.as)) throw new Error('Project page.as must be child or root.');
            if (!page.slug || !page.linkLabel) throw new Error('Project pages require slug and linkLabel.');
            const child = page.as !== 'root';
            const projectPath = child ? `${rootPath}/${page.slug}` : `/p/${page.slug}${suffix}`;
            const projectSections = [{ type: 'profile-header', data: { name: item.name, avatar: item.icon, eyebrow: item.category, tagline: item.description, links: item.links } }];
            if (item.screenshot) projectSections.push({ type: 'screenshots', data: { images: [item.screenshot] } });
            if (page.entries) projectSections.push({ type: 'entries', data: page.entries });
            (child ? children : projects).push([{ ...common, template: page.template || 'PRODUCT_SHOWCASE', ...(child ? { parentSlug: data.slug } : {}), slug: page.slug, title: item.name, content: { sections: orderedSections(projectSections) } }, `${base}${projectPath}`]);
            card.links = [{ label: page.linkLabel, url: projectPath }, ...(item.links || [])];
          }
          cards.push(card);
        }
        section.data.items = cards;
      }
      sections.push(section);
    }
    const header = sections.find(section => section.type === 'profile-header');
    roots.push([{ ...common, template: 'PERSON', slug: data.slug, title: person.title || header?.data.name, ...(person.metaDescription !== undefined ? { metaDescription: person.metaDescription } : {}), content: { sections: orderedSections(sections) } }, `${base}${rootPath}`]);
  }
  for (const [payload, url] of [...roots, ...children, ...projects]) await publish(payload, url);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
