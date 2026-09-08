const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);)/g;

export function escapeHtmlText(text) {
  return text.replace(BARE_AMPERSAND, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
