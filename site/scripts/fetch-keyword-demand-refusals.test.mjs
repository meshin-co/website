import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test, { after } from 'node:test';

import {
  KEY,
  KEYWORDS,
  KEY_FORMS,
  PHRASES,
  PREVIOUS,
  THROTTLE,
  answer,
  assertKeyAbsent,
  discardScenes,
  keywordRun,
  refusal,
  reportOf,
  week,
} from './fixtures/keyword-run.mjs';
import { THROTTLE_ATTEMPTS, THROTTLE_WAIT_MS } from './keyword-demand.mjs';
import { readKeywordReport } from './keyword-report.mjs';

after(discardScenes);

function assertRefused(outcome, { status, pattern, requests }) {
  assert.equal(outcome.result.status, status, outcome.result.stderr);
  assert.match(outcome.result.stderr, pattern);
  assert.equal(outcome.requests.length, requests, 'requests made');
  assert.equal(readFileSync(outcome.out, 'utf8'), PREVIOUS, 'a refused run must leave the report as it was');
  assertKeyAbsent([outcome.result.stdout, outcome.result.stderr]);
}

const refused = (options, expectation) => assertRefused(keywordRun({ previous: PREVIOUS, ...options }), expectation);

test('an absent or empty key is refused before any request, naming the variable, the file and the command', () => {
  for (const env of [{}, { BING_WEBMASTER_API_KEY: '' }]) {
    refused(
      { env },
      {
        status: 3,
        pattern:
          /BING_WEBMASTER_API_KEY is not set\. Put the key in site\/\.env; site\/\.env\.example says where to get it\. Then run npm run audit:keywords again\./,
        requests: 0,
      }
    );
  }
});

test('--key-source secret names the repository secret and the workflow, and never the file or the local command', () => {
  const outcome = keywordRun({ env: {}, previous: PREVIOUS, args: ['--key-source', 'secret'] });

  assertRefused(outcome, {
    status: 3,
    pattern: /the repository secret BING_WEBMASTER_API_KEY\. Then run the Write daily workflow again\./,
    requests: 0,
  });
  assert.doesNotMatch(outcome.result.stderr, /site\/\.env|npm run audit:keywords/);
});

test('a key Bing refuses stops the run at its first request with the credential exit code and the key taken out', () => {
  const replies = { [PHRASES[0]]: [refusal(400, { ErrorCode: 3, Message: `ERROR!!! InvalidApiKey ${KEY}` })] };

  refused(
    { replies },
    {
      status: 3,
      pattern: /Bing refused the key in BING_WEBMASTER_API_KEY \(HTTP 400: ERROR!!! InvalidApiKey \[key\]\)/,
      requests: 1,
    }
  );
});

test('a key Bing revokes after some phrases were priced stops the run there and writes nothing', () => {
  const replies = { [PHRASES[2]]: [refusal(401, { Message: 'Unauthorized' })] };

  refused(
    { replies },
    { status: 3, pattern: /Bing refused the key in BING_WEBMASTER_API_KEY \(HTTP 401/, requests: 3 }
  );
});

test('a throttled phrase waits 5 s and then 10 s, is priced on the third try, and the run goes on to write its report', () => {
  const throttled = PHRASES[3];
  const replies = { [throttled]: [THROTTLE, THROTTLE, answer(week('2026-10-31', 3, 4))] };
  const outcome = keywordRun({ replies });

  assert.equal(outcome.result.status, 0, outcome.result.stderr);
  assert.equal(outcome.requests.length, PHRASES.length + 2);
  assert.deepEqual(
    outcome.waits,
    PHRASES.flatMap((phrase, at) => [
      ...(at > 0 ? [KEYWORDS.requestGapMs] : []),
      ...(phrase === throttled ? [THROTTLE_WAIT_MS, THROTTLE_WAIT_MS * 2] : []),
    ])
  );
  const priced = readKeywordReport(reportOf(outcome)).phrases.find(({ phrase }) => phrase === throttled);
  assert.equal(priced.exact, 3);
});

test('a throttle that holds from the first phrase with nothing carried priced nothing, so the run fails, names the phrase and writes nothing', () => {
  const stuck = PHRASES[0];

  refused(
    { replies: { [stuck]: [THROTTLE] } },
    {
      status: 1,
      pattern: new RegExp(
        `Bing throttled the key on "${stuck}" ${THROTTLE_ATTEMPTS} times in a row; no report was written`
      ),
      requests: THROTTLE_ATTEMPTS,
    }
  );
});

test('a server error on the last phrase stops the run with the status named, and no partial report is written', () => {
  const replies = { [PHRASES.at(-1)]: [refusal(503, { Message: 'Service Unavailable' })] };

  refused(
    { replies },
    {
      status: 1,
      pattern: /Bing answered HTTP 503 \(Service Unavailable\); no report was written/,
      requests: PHRASES.length,
    }
  );
  assert.equal(existsSync(keywordRun({ replies }).out), false, 'with no earlier report, none exists after a failure');
});

test('a 200 answer that is not a list of weekly rows stops the run, because an empty read would look like nobody searched', () => {
  const replies = { [PHRASES[1]]: [{ status: 200, body: { rows: [] } }] };

  refused(
    { replies },
    { status: 1, pattern: /Bing answered 200 with no "d" list of weekly rows; no report was written/, requests: 2 }
  );
});

test('a weekly row the command cannot read stops the run instead of counting it as zero', () => {
  const unreadable = { Query: 'q', Date: 'tomorrow', Impressions: 3, BroadImpressions: 4 };

  refused(
    { replies: { [PHRASES[0]]: [answer(unreadable)] } },
    { status: 1, pattern: /Bing answered 200 with a weekly row it cannot read \(/, requests: 1 }
  );
});

test('a request that gets no answer stops the run, with the key taken out of whatever the network error said', () => {
  const [plain, encoded, form] = KEY_FORMS;
  const failure = `connect to https://ssl.bing.com/x?apikey=${form} failed for ${plain} and ${encoded}`;

  refused(
    { replies: { [PHRASES[0]]: [{ failure }] } },
    {
      status: 1,
      pattern:
        /Bing could not be reached \(connect to https:\/\/ssl\.bing\.com\/x\?apikey=\[key\] failed for \[key\] and \[key\]\); no report was written/,
      requests: 1,
    }
  );
});

test('an argument Bing finds out of range points at the configured market and is no credential problem', () => {
  const message = "ERROR!!! Specified argument was out of the range of valid values. (Parameter 'country')";

  refused(
    { replies: { [PHRASES[0]]: [refusal(400, { ErrorCode: 8, Message: message })] } },
    {
      status: 1,
      pattern: /Check keywords\.country and keywords\.language in site\/engine\.config\.json\./,
      requests: 1,
    }
  );
});

test('a core that gives the templates nothing to fill builds no phrase, so the run stops before any request', () => {
  refused(
    { core: '# Core\n' },
    {
      status: 1,
      pattern:
        /no phrase could be built: docs\/SEMANTIC-CORE\.md gives keywords\.templates no concept or glossary title/,
      requests: 0,
    }
  );
});

test('a missing core stops the run before any request and leaves the report as it was', () => {
  refused({ core: null }, { status: 1, pattern: /SEMANTIC-CORE\.md/, requests: 0 });
});

test('a tree that is not a git checkout stops the run before any request, because no commit could be stamped', () => {
  refused(
    { checkout: false },
    { status: 1, pattern: /cannot stamp "Generated-from:" into \.\.\/audits\/keyword-demand\.md/, requests: 0 }
  );
});

test('a keywords section the engine config refuses stops the run before any request, naming the field', () => {
  refused(
    { keywords: { ...KEYWORDS, requestGapMs: -1 } },
    { status: 1, pattern: /keywords\.requestGapMs must be >= 0/, requests: 0 }
  );
});
