import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GENERATED_BEGIN, GENERATED_END } from './autowriter-claims.mjs';
import { casedForms, casingTexts, restoreCase } from './topic-casing.mjs';

const CORE = [
  '# Semantic core',
  '',
  GENERATED_BEGIN,
  '',
  '### glossary (1)',
  '',
  '| Route | Query | Title |',
  '| ----- | ----- | ----- |',
  '| `/glossary/nist-ai-rmf` | nist ai rmf | What is the NIST AI RMF? — meshin.co |',
  '',
  GENERATED_END,
  '',
  '#### Concept register (2)',
  '',
  '| Concept | Defined by | Definition |',
  '| ------- | ---------- | ---------- |',
  '| AI register | `/glossary/ai-register` | An inventory. |',
  '| Evals | `/glossary/evals` | Repeatable tests. |',
  '',
].join('\n');

test('casedForms keeps acronyms and mixed-case brand names under their lower-case key', () => {
  const forms = casedForms(['AI EU NIST RMF MCP LLM ISO', 'OpenAI and SaaS']);
  for (const token of ['AI', 'EU', 'NIST', 'RMF', 'MCP', 'LLM', 'ISO', 'OpenAI', 'SaaS']) {
    assert.equal(forms.get(token.toLowerCase()), token);
  }
  assert.equal(forms.size, 9);
});

test('casedForms ignores words that are only capitalised at the start', () => {
  const forms = casedForms(['What is Data governance', 'A', 'I']);
  assert.equal(forms.size, 0);
});

test('casedForms returns an empty map for no texts and for texts without a qualifying token', () => {
  assert.equal(casedForms([]).size, 0);
  assert.equal(casedForms(['plain words only', '']).size, 0);
});

test('casedForms splits on punctuation and keeps digits out of the keys', () => {
  const forms = casedForms(['ISO 42001', 'ISO/IEC 42001, (NIST)']);
  assert.equal(forms.get('iso'), 'ISO');
  assert.equal(forms.get('iec'), 'IEC');
  assert.equal(forms.get('nist'), 'NIST');
  assert.equal(forms.has('42001'), false);
});

test('casedForms reads unicode letters as letters', () => {
  const forms = casedForms(['Über ÖPNV und ÅngströmUnit']);
  assert.equal(forms.get('öpnv'), 'ÖPNV');
  assert.equal(forms.get('ångströmunit'), 'ÅngströmUnit');
  assert.equal(forms.has('über'), false);
});

test('casedForms lets the most frequent spelling win', () => {
  const forms = casedForms(['OpenAi', 'OpenAI', 'OpenAI']);
  assert.equal(forms.get('openai'), 'OpenAI');
});

test('casedForms gives a tie to the spelling seen first', () => {
  assert.equal(casedForms(['OpenAi', 'OpenAI']).get('openai'), 'OpenAi');
  assert.equal(casedForms(['OpenAI', 'OpenAi']).get('openai'), 'OpenAI');
});

test('restoreCase restores acronyms in a lower-cased query and keeps punctuation', () => {
  const forms = casedForms(['NIST AI RMF']);
  assert.equal(restoreCase('what is nist ai rmf?', forms), 'what is NIST AI RMF?');
  assert.equal(restoreCase('nist/ai-rmf (rmf), ai', forms), 'NIST/AI-RMF (RMF), AI');
});

test('restoreCase matches whole tokens only', () => {
  const forms = casedForms(['AI']);
  assert.equal(restoreCase('said maid again', forms), 'said maid again');
});

test('restoreCase leaves a token that already carries upper case as the caller wrote it', () => {
  const forms = casedForms(['NIST', 'AI']);
  assert.equal(restoreCase('Nist Ai nIST', forms), 'Nist Ai nIST');
});

test('restoreCase never changes the first letter of a word that is not in the forms', () => {
  const forms = casedForms(['NIST']);
  assert.equal(restoreCase('what is the nist act', forms), 'what is the NIST act');
  assert.equal(restoreCase('', forms), '');
});

test('casingTexts lists concept names first, then generated titles, unstripped', () => {
  assert.deepEqual(casingTexts(CORE), ['AI register', 'Evals', 'What is the NIST AI RMF? — meshin.co']);
});

test('a core restores the casing of a Search Console query from its concept names and generated titles', () => {
  const forms = casedForms(casingTexts(CORE));
  assert.equal(restoreCase('what is the nist ai rmf', forms), 'what is the NIST AI RMF');
  for (const token of ['ai', 'nist', 'rmf']) assert.equal(forms.get(token), token.toUpperCase());
});
