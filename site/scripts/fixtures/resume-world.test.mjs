import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { foreignCommit } from '../pr-classify.mjs';
import { capture, personCommit, rehomed } from './resume-world.mjs';

const RAW = readFileSync(new URL('./pr-resume/escalated-pull-request.json', import.meta.url), 'utf8');
const OTHER_SITE_BOT = 'autowriter-bot@field-notes.example';

const changedLines = (before, after) => {
  const was = before.split('\n');
  const now = after.split('\n');
  assert.equal(now.length, was.length);
  return now.filter((line, index) => line !== was[index]).map((line) => line.trim());
};

test("the capture of the pull request carries the bot of the site under test, so every commit of it is the bot's", () => {
  const { commits } = capture('escalated-pull-request');
  assert.ok(commits.length > 0);
  assert.equal(foreignCommit(commits), undefined);
});

test("a person's commit is still a person's next to the commits of the capture", () => {
  const { commits } = capture('escalated-pull-request');
  const person = personCommit('c'.repeat(40));
  assert.equal(foreignCommit([...commits, person]), person);
});

test('moving the capture to another site changes the mailbox of the bot and no other line of it', () => {
  const moved = JSON.parse(rehomed(RAW, OTHER_SITE_BOT));
  assert.ok(moved.commits.length > 0);
  for (const { commit } of moved.commits) {
    assert.equal(commit.author.email, OTHER_SITE_BOT);
    assert.equal(commit.committer.email, OTHER_SITE_BOT);
  }
  assert.deepEqual(
    [...new Set(changedLines(RAW, rehomed(RAW, OTHER_SITE_BOT)))],
    ['"email": "' + OTHER_SITE_BOT + '",']
  );
});

test('moving the capture leaves the mailbox of a person where it was', () => {
  const text = '{"email": "owner@example.com", "other": "xautowriter-bot"}';
  assert.equal(rehomed(text, OTHER_SITE_BOT), text);
});
