import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escalationMessage } from './escalation-slack.mjs';
import { blockKitProblems } from './fixtures/block-kit.mjs';

const ESCALATION = {
  id: 'esc-1',
  kind: 'credential',
  title: 'Token expired',
  detail: 'The token was refused.',
  raisedAt: '2026-11-03T08:00:00.000Z',
  receipts: [],
};
const PATH = 'audits/autowriter/post-one.json';
const RUN = { label: 'run 777', url: 'https://github.test/o/r/actions/runs/777' };
const PULL_REQUEST = { label: '#72', url: 'https://github.test/o/r/pull/72' };
const ISSUE = { label: '#41', url: 'https://github.test/o/r/issues/41' };
const NONE = { pullRequest: null, run: null, issue: null };
const build = ({ escalation = ESCALATION, ledgerPath = PATH, links = { ...NONE, run: RUN, issue: ISSUE } } = {}) =>
  escalationMessage({ escalation, ledgerPath, links });

const prose = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const columns = (...texts) => ({ type: 'section', fields: texts.map((text) => ({ type: 'mrkdwn', text })) });
const small = (...texts) => ({ type: 'context', elements: texts.map((text) => ({ type: 'mrkdwn', text })) });
const header = (text) => ({ type: 'header', text: { type: 'plain_text', text } });
const DIVIDER = { type: 'divider' };
const FOOTER = small(
  'Escalation esc-1 (credential), raised 2026-11-03T08:00:00.000Z',
  'Ledger `audits/autowriter/post-one.json`'
);
const RUN_FIELD = '*Workflow run*\n<https://github.test/o/r/actions/runs/777|run 777>';
const ISSUE_FIELD = '*Issue*\n<https://github.test/o/r/issues/41|#41>';
const PULL_REQUEST_FIELD = '*Pull request*\n<https://github.test/o/r/pull/72|#72>';

test('the blocks of an escalation: the kind, the title, the detail, the links in columns and the ledger', () => {
  assert.deepEqual(build().blocks, [
    header('Autowriter escalation: credential'),
    prose('*Token expired*'),
    prose('The token was refused.'),
    DIVIDER,
    columns(RUN_FIELD, ISSUE_FIELD),
    FOOTER,
  ]);
});

test('the fallback text keeps the title and the detail and adds the links, so a notification is complete without blocks', () => {
  assert.equal(
    build().text,
    [
      'Autowriter escalation (credential): Token expired',
      'The token was refused.',
      'Workflow run: <https://github.test/o/r/actions/runs/777|run 777>',
      'Issue: <https://github.test/o/r/issues/41|#41>',
      'Ledger: audits/autowriter/post-one.json',
    ].join('\n')
  );
});

test('a pull request the detail does not name is a column of its own, the first of the links', () => {
  const { blocks, text } = build({ links: { pullRequest: PULL_REQUEST, run: RUN, issue: ISSUE } });
  assert.deepEqual(blocks[4], columns(PULL_REQUEST_FIELD, RUN_FIELD, ISSUE_FIELD));
  assert.match(text, /\nPull request: <https:\/\/github\.test\/o\/r\/pull\/72\|#72>\nWorkflow run: /);
});

test('an address the detail already carries is a link there and is not repeated as a column or a line', () => {
  const detail = [
    'The watcher judged head abc123: escalate, attempt-cap.',
    'Failing: content (gate:content).',
    'Pull request: https://github.test/o/r/pull/72',
  ].join('\n');
  const { blocks, text } = build({
    escalation: { ...ESCALATION, kind: 'no-convergence', title: 'Autowriter pull request #72: stopped', detail },
    links: { pullRequest: PULL_REQUEST, run: RUN, issue: ISSUE },
  });
  assert.equal(
    blocks[2].text.text,
    'The watcher judged head abc123: escalate, attempt-cap.\nFailing: content (gate:content).\nPull request: <https://github.test/o/r/pull/72|#72>'
  );
  assert.deepEqual(blocks[4], columns(RUN_FIELD, ISSUE_FIELD));
  assert.equal(text.match(/pull\/72/g).length, 1);
  assert.ok(
    text.endsWith(
      'Workflow run: <https://github.test/o/r/actions/runs/777|run 777>\nIssue: <https://github.test/o/r/issues/41|#41>\nLedger: audits/autowriter/post-one.json'
    )
  );
});

test('an address in the detail becomes a link named for what it is, and the punctuation after it stays outside', () => {
  const detail =
    'Repair run: https://github.test/o/r/actions/runs/9001, issue https://github.test/o/r/issues/5 and ' +
    'https://docs.example.org/a/very/long/path/that/goes/on/and/on/forever/and/ever/and/more.';
  const { blocks, text } = build({ escalation: { ...ESCALATION, detail } });
  const linked =
    'Repair run: <https://github.test/o/r/actions/runs/9001|run 9001>, issue <https://github.test/o/r/issues/5|#5> and ' +
    '<https://docs.example.org/a/very/long/path/that/goes/on/and/on/forever/and/ever/and/more|docs.example.org/a/very/long/path/that/…>.';
  assert.equal(blocks[2].text.text, linked);
  assert.ok(text.includes(`\n${linked}\n`));
});

test('an issue known by number only is that number, and with nothing known there are no columns and no rule', () => {
  const numbered = build({ links: { ...NONE, issue: { label: '#41', url: null } } });
  assert.deepEqual(numbered.blocks[4], columns('*Issue*\n#41'));
  assert.ok(numbered.text.endsWith('\nIssue: #41\nLedger: audits/autowriter/post-one.json'));
  const bare = build({ links: NONE });
  assert.deepEqual(
    bare.blocks.map(({ type }) => type),
    ['header', 'section', 'section', 'context']
  );
  assert.equal(
    bare.text,
    'Autowriter escalation (credential): Token expired\nThe token was refused.\nLedger: audits/autowriter/post-one.json'
  );
});

test('whatever a title or a detail says, no markup in it is read and no mention can be raised', () => {
  const hostile = '<!channel> & <https://evil.test|click> <@U123>';
  const { blocks, text } = build({ escalation: { ...ESCALATION, title: hostile, detail: hostile } });
  for (const shown of [blocks[1].text.text, blocks[2].text.text, text])
    assert.ok(shown.includes('&lt;!channel&gt; &amp; &lt;'), shown);
  assert.equal(text.includes('<!channel>'), false);
  assert.equal(text.includes('<@U123>'), false);
  assert.deepEqual(blockKitProblems({ text, blocks }), []);
});

test('a detail longer than a section holds is split across sections, and none of it is lost', () => {
  const detail = Array.from({ length: 120 }, (_, at) => `line ${at}: ${'detail '.repeat(10).trim()}`).join('\n');
  const message = build({ escalation: { ...ESCALATION, detail } });
  const parts = message.blocks.filter(({ type, text }) => type === 'section' && text?.text.startsWith('line'));
  assert.ok(parts.length > 1);
  assert.equal(parts.map(({ text }) => text.text).join('\n'), detail);
  assert.deepEqual(blockKitProblems(message), []);
});

test('every escalation kind and every set of links is a payload Slack accepts', () => {
  for (const kind of ['credential', 'no-convergence', 'spend-ceiling', 'hard-stop', 'unrepairable'])
    for (const links of [NONE, { pullRequest: PULL_REQUEST, run: RUN, issue: ISSUE }, { ...NONE, run: RUN }])
      assert.deepEqual(blockKitProblems(build({ escalation: { ...ESCALATION, kind }, links })), [], kind);
});

test('a title longer than a header may hold is cut in the header and whole in the section under it', () => {
  const title = `Autowriter pull request #72: ${'the same rule failed '.repeat(20)}`.trim();
  const { blocks } = build({ escalation: { ...ESCALATION, title } });
  assert.equal(blocks[1].text.text, `*${title}*`);
  assert.deepEqual(blockKitProblems(build({ escalation: { ...ESCALATION, title } })), []);
});

test('a message that does not say where the ledger is, or has no title, is refused', () => {
  assert.throws(() => build({ ledgerPath: '' }), /ledger/);
  assert.throws(() => build({ escalation: { ...ESCALATION, title: ' ' } }), /title/);
});
