import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { COLLECTION_FEED_MAX_BYTES, FEED_WINDOW } from '../src/utils/feeds.mjs';
import { LLMS_FILE_MAX_BYTES, LLMS_FULL_MAX_BYTES } from '../src/utils/llms-collections.mjs';

const GATE = 'gate:machine';
const UNIT_GATE = 'test:llms';
const PADDING = 'padding ';
const POST_ENTRY_LINE = /^\[(https?:\/\/[^\]]+\/blog\/[^\]]+)\]\(\1\)\n\n/m;
const FEED_ITEM = /<item>[\s\S]*?<\/item>/g;
const COLLECTION_SOURCE = 'src/utils/llms-collections.mjs';
const TIE_BREAK = /\s*\|\|\s*compare\(a\.id,\s*b\.id\)/;
const RENDERER_DECLARATION = 'export function llmsCollectionFiles(';
const CLOCK_WRAPPER = `
export const llmsCollectionFiles = (request) =>
  renderedCollectionFiles(request).map((file) => ({ ...file, text: \`\${file.text}\${new Date().toISOString()}\\n\` }));
`;
const DOT_REPORTER = { NODE_OPTIONS: '--test-reporter=dot' };

const paddingPast = (limit) => PADDING.repeat(Math.ceil(limit / PADDING.length) + 1);

export async function firstPostUrl(copySite, shard = 'post-1') {
  const text = await readFile(join(copySite, `dist/llms/${shard}.txt`), 'utf8');
  return POST_ENTRY_LINE.exec(text)[1];
}

const stampEveryFile = (text) => {
  const renamed = text.replace(RENDERER_DECLARATION, 'function renderedCollectionFiles(');
  return renamed === text ? text : `${renamed}${CLOCK_WRAPPER}`;
};

const withExtraFeedItems = (text) => {
  const items = text.match(FEED_ITEM) ?? [];
  const copies = items[0].repeat(Math.max(1, FEED_WINDOW + 1 - items.length));
  return text.replace('</channel>', () => `${copies}</channel>`);
};

export const boundedIndexSpecimens = ({ editFile }) => ({
  machineLlmsShardOverBudget: {
    gate: GATE,
    token: `bytes, over the ${LLMS_FILE_MAX_BYTES} byte guard`,
    plant: (copySite) =>
      editFile(join(copySite, 'dist/llms/post-1.txt'), (text) => `${text}\n${paddingPast(LLMS_FILE_MAX_BYTES)}\n`),
  },
  machineLlmsFullOverBudget: {
    gate: GATE,
    token: `bytes, over the ${LLMS_FULL_MAX_BYTES} byte guard`,
    plant: (copySite) =>
      editFile(join(copySite, 'dist/llms-full.txt'), (text) => `${text}\n${paddingPast(LLMS_FULL_MAX_BYTES)}\n`),
  },
  machineLlmsFullInlinesEntries: {
    gate: GATE,
    token: 'llms-full.txt lists /blog/',
    plant: async (copySite) => {
      const url = await firstPostUrl(copySite);
      return editFile(
        join(copySite, 'dist/llms-full.txt'),
        (text) => `${text}\n- [Inlined](${url}): an entry listed inline\n`
      );
    },
  },
  machineLlmsShardOmitsEntry: {
    gate: GATE,
    token: '/llms/post.txt omits /blog/',
    plant: (copySite) => editFile(join(copySite, 'dist/llms/post-2.txt'), (text) => text.replace(POST_ENTRY_LINE, '')),
  },
  machineLlmsIndexCarriesEntry: {
    gate: GATE,
    token: 'is an index of shards but lists',
    plant: async (copySite) => {
      const url = await firstPostUrl(copySite);
      return editFile(join(copySite, 'dist/llms/post.txt'), (text) => `${text}\n[${url}](${url})\n`);
    },
  },
  machineLlmsFullCountDrifts: {
    gate: GATE,
    token: 'llms-full.txt says',
    plant: (copySite) =>
      editFile(join(copySite, 'dist/llms-full.txt'), (text) =>
        text.replace(/(llms\/post\.txt\): )(\d+)/, (_, lead, count) => `${lead}${Number(count) + 1}`)
      ),
  },
  machineFeedOverWindow: {
    gate: GATE,
    token: `items, window is ${FEED_WINDOW}`,
    plant: (copySite) => editFile(join(copySite, 'dist/blog/rss.xml'), withExtraFeedItems),
  },
  machineFeedOverBudget: {
    gate: GATE,
    token: `bytes, over the ${COLLECTION_FEED_MAX_BYTES} byte guard`,
    plant: (copySite) =>
      editFile(join(copySite, 'dist/blog/rss.xml'), (text) =>
        text.replace('</channel>', () => `<!--${paddingPast(COLLECTION_FEED_MAX_BYTES)}--></channel>`)
      ),
  },
  llmsDropsTheIdTieBreak: {
    gate: UNIT_GATE,
    env: DOT_REPORTER,
    token: 'generating twice from one fixture is byte-identical for every file, in any input order',
    plant: (copySite) => editFile(join(copySite, COLLECTION_SOURCE), (text) => text.replace(TIE_BREAK, '')),
  },
  llmsAppendsATimestamp: {
    gate: UNIT_GATE,
    env: DOT_REPORTER,
    token: 'the generator reads no clock: a second run a day later is byte-identical',
    plant: (copySite) => editFile(join(copySite, COLLECTION_SOURCE), stampEveryFile),
  },
});
