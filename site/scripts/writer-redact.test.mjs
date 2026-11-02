import './fixtures/no-network.mjs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

import { WriterError } from './writer-error.mjs';
import { assertNoSecrets, findSecret, redact, secretsOf } from './writer-redact.mjs';

const random = () => randomBytes(20).toString('base64url');

const list = (...values) => values.map((value, index) => ({ name: `KEY_${index}`, value }));

test('secretsOf lists key names and values and drops empty ones', () => {
  const vendors = [
    { keyName: 'AUTOWRITER_SECOND_API_KEY', apiKey: 'a1' },
    { keyName: 'AUTOWRITER_OPENAI_API_KEY', apiKey: '' },
    { keyName: 'OTHER', apiKey: '   ' },
  ];
  assert.deepEqual(secretsOf(vendors), [{ name: 'AUTOWRITER_SECOND_API_KEY', value: 'a1' }]);
});

test('redact replaces every occurrence of every secret', () => {
  const [a, b] = [random(), random()];
  const text = `x ${a} y ${b} z ${a}${a}`;
  const out = redact(text, list(a, b));
  assert.equal(out, 'x [redacted:KEY_0] y [redacted:KEY_1] z [redacted:KEY_0][redacted:KEY_0]');
});

test('redact handles the raw and the trimmed form', () => {
  const core = random();
  const secrets = list(`  ${core}\n`);
  assert.equal(redact(`k=${core}`, secrets), 'k=[redacted:KEY_0]');
  assert.equal(redact(`k=  ${core}\n.`, secrets), 'k=[redacted:KEY_0].');
});

test('redact handles a secret that is a substring of another', () => {
  const long = 'sk-' + random();
  const short = long.slice(3, 12);
  for (const secrets of [list(short, long), list(long, short)]) {
    const out = redact(`a ${long} b ${short}`, secrets);
    assert.equal(out.includes(long), false);
    assert.equal(out.includes(short), false);
    assert.ok(out.includes('[redacted:'));
  }
  const out = redact(`${long}`, list(short, long));
  assert.equal(out, '[redacted:KEY_1]');
});

test('redact never rescans its own markers', () => {
  const out = redact('a token b', list('token', 'redacted', 'KEY'));
  assert.equal(out, 'a [redacted:KEY_0] b');
});

test('redact leaves text without secrets alone and ignores empty secrets', () => {
  assert.equal(redact('nothing here', list('zzz', '', '  ')), 'nothing here');
  assert.equal(redact('nothing here', []), 'nothing here');
});

test('redact treats regex metacharacters literally', () => {
  assert.equal(redact('a.*b and axxb', list('a.*b')), '[redacted:KEY_0] and axxb');
});

test('redaction property: no random secret survives, however it is embedded', () => {
  for (let round = 0; round < 200; round += 1) {
    const secrets = list(random(), random(), random());
    const pieces = [];
    for (let index = 0; index < 8; index += 1) {
      const secret = secrets[Math.floor(Math.random() * 3)].value;
      pieces.push(index % 2 ? secret : `<${random()}>${secret.slice(0, 5)}`, secret.slice(5));
    }
    const out = redact(pieces.join(' ') + secrets.map((s) => s.value).join(''), secrets);
    for (const { value } of secrets) assert.equal(out.includes(value), false);
  }
});

test('findSecret finds a secret in a string and names it', () => {
  const [a, b] = [random(), random()];
  assert.deepEqual(findSecret(`aaa ${b} aaa`, list(a, b)), { name: 'KEY_1', path: '$' });
  assert.equal(findSecret('clean', list(a, b)), null);
});

test('findSecret descends into arrays and objects', () => {
  const secret = random();
  const value = { a: [1, { b: ['x', `pre ${secret} post`] }], c: null, d: 4, e: true };
  assert.deepEqual(findSecret(value, list(secret)), { name: 'KEY_0', path: '$.a[1].b[1]' });
});

test('findSecret finds a secret used as an object key and never puts it in the path', () => {
  const secret = random();
  const hit = findSecret({ outer: [{ [`k-${secret}`]: 1 }] }, list(secret));
  assert.equal(hit.name, 'KEY_0');
  assert.equal(hit.path.includes(secret), false);
  assert.equal(hit.path, '$.outer[0]#key');
  assert.equal(findSecret({ [secret]: 1 }, list(secret)).path, '$#key');
});

test('findSecret matches the trimmed form of a padded secret', () => {
  const core = random();
  assert.ok(findSecret({ a: `x${core}y` }, list(` ${core} `)));
});

test('findSecret prefers the longest secret when one contains another', () => {
  const long = random();
  const short = long.slice(2, 10);
  assert.equal(findSecret(long, list(short, long)).name, 'KEY_1');
});

test('findSecret survives cycles and ignores non-plain values', () => {
  const loop = { a: 1 };
  loop.self = loop;
  assert.equal(findSecret(loop, list(random())), null);
  assert.equal(findSecret([undefined, null, 3, true, Symbol('s')], list(random())), null);
});

test('findSecret with no usable secrets finds nothing', () => {
  assert.equal(findSecret('anything', []), null);
  assert.equal(findSecret('anything', list('', '  ')), null);
});

test('assertNoSecrets passes clean values and returns nothing', () => {
  assert.equal(assertNoSecrets({ a: 'b' }, list(random()), 'record'), undefined);
});

test('assertNoSecrets throws a config WriterError naming variable and label, never the value', () => {
  const secret = random();
  let caught = null;
  try {
    assertNoSecrets({ nested: [secret] }, [{ name: 'AUTOWRITER_OPENAI_API_KEY', value: secret }], 'generation record');
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof WriterError);
  assert.equal(caught.kind, 'config');
  assert.deepEqual(caught.variables, ['AUTOWRITER_OPENAI_API_KEY']);
  assert.ok(caught.message.includes('AUTOWRITER_OPENAI_API_KEY'));
  assert.ok(caught.message.includes('generation record'));
  assert.equal(caught.message.includes(secret), false);
});
