import { build } from 'vite';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(root, '..');
const stage = path.resolve(workspace, '.smart-reader-portable-stage');
const release = path.resolve(workspace, 'release');
const output = path.resolve(release, 'SmartReader-Portable.html');
const readme = path.resolve(release, 'README.txt');

await build({
  configFile: path.resolve(root, 'vite.portable.config.ts'),
  root,
});

try {
  let html = await readFile(path.resolve(stage, 'index.html'), 'utf8');
  const assetFiles = await readdir(path.resolve(stage, 'assets'));
  const scriptFiles = assetFiles.filter((file) => file.endsWith('.js'));
  if (scriptFiles.length !== 1) {
    throw new Error(`Expected one JavaScript bundle, found ${scriptFiles.length}.`);
  }

  const stylesheetTags = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/gi)].map((match) => match[0]);
  for (const tag of stylesheetTags) {
    const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
    if (!href) continue;

    if (href === '/fonts.css' || href === './fonts.css') {
      let fonts = await readFile(path.resolve(stage, 'fonts.css'), 'utf8');
      fonts = await replaceFontUrls(fonts, stage);
      html = html.replace(tag, () => `<style>\n${fonts}\n</style>`);
      continue;
    }

    const stylesheetPath = path.resolve(stage, href.replace(/^\.\//, ''));
    const css = await readFile(stylesheetPath, 'utf8');
    html = html.replace(tag, () => `<style>\n${css}\n</style>`);
  }

  const scriptTag = html.match(/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="([^"]+)")[^>]*>\s*<\/script>/i);
  if (!scriptTag) throw new Error('Could not find the generated JavaScript module tag.');
  const scriptPath = path.resolve(stage, scriptTag[1].replace(/^\.\//, ''));
  const javascript = (await readFile(scriptPath, 'utf8')).replace(/<\/script/gi, '<\\/script');
  html = html.replace(scriptTag[0], () => `<script type="module">\n${javascript}\n</script>`);

  const htmlShell = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>');
  if (/\b(?:src|href)="(?:\.\/)?assets\//i.test(htmlShell)) {
    throw new Error('The generated HTML still references a separate asset file.');
  }
  if (/\b(?:src|href)="\/fonts\.css"/i.test(htmlShell)) {
    throw new Error('The generated HTML still references the external font stylesheet.');
  }

  await mkdir(release, { recursive: true });
  await writeFile(output, html, 'utf8');
  await writeFile(readme, [
    'Smart Reader V2 — Portable edition',
    '',
    'Open SmartReader-Portable.html in a current browser. The HTML file contains the app code, styles, fonts, and demonstration book; it does not need a development server or an installation.',
    '',
    'Each person has a separate library. Books, notes, highlights, and settings are stored in that person’s browser storage and are not included when this HTML file is shared. Import a book or open the demonstration book after launch.',
    '',
    'The standalone file contains no hosted-site visit counter or GoatCounter script.',
    '',
    'Browser support for saving data from a file opened directly from disk varies. Keep your original books and use the app’s study-data export as a separate backup where needed.',
    '',
    'Some online search actions need an internet connection.',
  ].join('\n'), 'utf8');
  console.log(`Portable HTML created: ${output}`);
  console.log(`Size: ${(Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2)} MiB`);
} finally {
  const resolvedWorkspace = path.resolve(workspace) + path.sep;
  if (!stage.startsWith(resolvedWorkspace)) throw new Error('Refusing to remove a build directory outside the workspace.');
  await rm(stage, { recursive: true, force: true });
}

async function replaceFontUrls(css, outputDir) {
  const urls = [...css.matchAll(/url\((['"]?)(fonts\/[^)'\"]+)\1\)/g)];
  for (const match of urls) {
    const fontPath = path.resolve(outputDir, match[2]);
    const extension = path.extname(fontPath).toLowerCase();
    const mime = extension === '.woff2' ? 'font/woff2' : extension === '.woff' ? 'font/woff' : 'font/ttf';
    const data = (await readFile(fontPath)).toString('base64');
    css = css.replace(match[0], `url("data:${mime};base64,${data}")`);
  }
  return css;
}
