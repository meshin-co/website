import { common, createStarryNight } from '@wooorm/starry-night';
import { toHtml } from 'hast-util-to-html';
import { h } from 'hastscript';

let starryNight;

export async function highlightedCode(text, language) {
  starryNight ??= createStarryNight(common);
  const night = await starryNight;
  const scope = night.flagToScope(language);
  if (scope === undefined) {
    throw new Error(`no grammar for the language "${language}" in the starry-night common set`);
  }
  return toHtml(h('code', { className: [`language-${language}`] }, night.highlight(text, scope).children));
}
