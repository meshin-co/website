import assert from 'node:assert/strict';

import { TITLE_ROOM_CHARS } from '../../src/utils/faq-meta.mjs';
import { CLAIM_FORMATS } from '../autowriter-claims.mjs';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WRITER_TERM_TITLE = /^What (?:is|are) (?:(?:a|an|the) )?(.+)\?$/;

export function assertTopicInvariants(topic) {
  assert.ok(CLAIM_FORMATS.includes(topic.format), topic.format);
  assert.match(topic.slug, SLUG);
  assert.ok(topic.title.length <= TITLE_ROOM_CHARS, topic.title);
  assert.equal(topic.title[0], topic.title[0].toUpperCase());
  for (const word of topic.query.split(/\s+/)) {
    assert.ok(topic.title.toLowerCase().includes(word), word + ' missing from ' + topic.title);
  }
  if (topic.format === 'term') assert.equal(WRITER_TERM_TITLE.exec(topic.title)?.[1], topic.subject);
  else assert.equal(topic.subject, null);
}
