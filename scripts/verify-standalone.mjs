import { readFileSync } from 'node:fs';

const filename = 'dist-standalone/scenia-standalone.html';
const html = readFileSync(filename, 'utf8');
const rootPosition = html.indexOf('<div id="root"></div>');
const scriptPosition = html.indexOf('<script>');

if (rootPosition === -1) {
  throw new Error(`${filename} does not contain the React root element.`);
}
if (scriptPosition === -1 || scriptPosition < rootPosition) {
  throw new Error(`${filename} must load its inline script after the React root element.`);
}
if (html.includes('<script type="module">') || /<script[^>]+src=/.test(html.slice(0, scriptPosition))) {
  throw new Error(`${filename} contains a module or external entry script that cannot run reliably via file://.`);
}

console.log(`Verified standalone HTML: the React root is available before its classic inline script.`);
