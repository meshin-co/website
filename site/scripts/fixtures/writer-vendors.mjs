import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { createAdapter } from '../writer-adapter.mjs';
import { readWriterConfig } from '../writer-config.mjs';

export const MODEL = 'gpt-6.1-terra';
export const RATES = { inputPerMillion: 1, outputPerMillion: 5 };

export const ROUTES = {
  models: 'GET https://api.openai.com/v1/models',
  responses: 'POST https://api.openai.com/v1/responses',
};

export const DRAFT = { title: 'What is a fixture?', body: 'A fixture is a fixed input for a test.' };
export const DRAFT_TEXT = JSON.stringify(DRAFT);

const SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, body: { type: 'string' } },
  required: ['title', 'body'],
  additionalProperties: false,
};

export const REQUEST = {
  system: 'You write short entries for a consulting site.',
  messages: [{ role: 'user', content: 'Write the entry.' }],
  schema: SCHEMA,
  schemaName: 'entry_draft',
  maxOutputTokens: 32000,
};

export const randomSecret = () => `sk-test-${randomBytes(24).toString('base64url')}`;

export const reply = (body, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const outputText = (text) => ({ type: 'output_text', text, annotations: [] });
export const refusalPart = (refusal = 'I cannot help with that.') => ({ type: 'refusal', refusal });
export const messageItem = (...content) => ({
  id: 'msg_0fixture',
  type: 'message',
  role: 'assistant',
  status: 'completed',
  content,
});

export const usageOf = (input, output, details = {}) => ({
  input_tokens: input,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0, ...details },
  output_tokens: output,
  output_tokens_details: { reasoning_tokens: 300 },
  total_tokens: input + output,
});

export const response = ({
  id = 'resp_0fixture',
  model = MODEL,
  status = 'completed',
  incompleteReason = null,
  output = [messageItem(outputText(DRAFT_TEXT))],
  usage = usageOf(1200, 800),
} = {}) => ({
  id,
  object: 'response',
  status,
  incomplete_details: incompleteReason === null ? null : { reason: incompleteReason },
  error: null,
  model,
  output,
  usage,
});

export const completed = ({ text = DRAFT_TEXT, input = 1200, output = 800, ...rest } = {}) =>
  response({ ...rest, output: [messageItem(outputText(text))], usage: usageOf(input, output) });

export const truncated = (options = {}) =>
  completed({ ...options, status: 'incomplete', incompleteReason: 'max_output_tokens' });

export const refused = ({ text, input = 1200, output = 800, ...rest } = {}) =>
  response({ ...rest, output: [messageItem(refusalPart(text))], usage: usageOf(input, output) });

export const modelList = ({ ids = [MODEL], shutdownDates = {} } = {}) => ({
  object: 'list',
  data: ids.map((id) => ({
    id,
    object: 'model',
    created: 1_787_000_000,
    owned_by: 'openai',
    shutdown_date: shutdownDates[id] ?? null,
  })),
});

export const errorBody = ({ code = null, type = 'invalid_request_error', message = 'rejected' } = {}) => ({
  error: { message, type, param: null, code },
});

const lowerCased = (headers = {}) =>
  Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));

function describeCall(url, init = {}) {
  const { origin, pathname, searchParams } = new URL(url);
  const method = init.method ?? 'GET';
  const headers = lowerCased(init.headers);
  return {
    method,
    url,
    route: `${method} ${origin}${pathname}`,
    query: Object.fromEntries(searchParams),
    headers,
    body: init.body,
    json: init.body === undefined ? undefined : JSON.parse(init.body),
    key: headers.authorization?.replace(/^Bearer /, ''),
    redirect: init.redirect,
    answer: null,
  };
}

function vendorFetch(overrides = {}) {
  const routes = {
    [ROUTES.models]: () => reply(modelList()),
    [ROUTES.responses]: () => reply(response()),
    ...overrides,
  };
  const calls = [];
  const fetch = async (url, init) => {
    const call = describeCall(url, init);
    calls.push(call);
    const answer = routes[call.route];
    if (answer === undefined) throw new RangeError(`no fake vendor answers ${call.route}`);
    const result = await answer(call);
    call.answer = await result.clone().text();
    return result;
  };
  return { fetch, calls };
}

export const vendorEntry = ({ apiKey = randomSecret(), model = MODEL, rates = RATES } = {}) =>
  readWriterConfig({
    WRITING_PROVIDER: 'openai',
    OPENAI_WRITING_MODEL: model,
    OPENAI_WRITING_INPUT_USD_PER_MILLION: String(rates.inputPerMillion),
    OPENAI_WRITING_OUTPUT_USD_PER_MILLION: String(rates.outputPerMillion),
    AUTOWRITER_OPENAI_API_KEY: apiKey,
  }).vendor;

export const envOf = ({ id, keyName, apiKey, modelVariable, model, rates }) => ({
  WRITING_PROVIDER: id,
  [modelVariable]: model,
  [rates.inputVariable]: String(rates.inputPerMillion),
  [rates.outputVariable]: String(rates.outputPerMillion),
  [keyName]: apiKey,
});

export function adapterOn({ routes = {}, ...entry } = {}) {
  const vendor = vendorEntry(entry);
  const { fetch, calls } = vendorFetch(routes);
  return { adapter: createAdapter({ vendor, fetch }), calls, vendor, apiKey: vendor.apiKey, fetch, env: envOf(vendor) };
}

export const inSequence = (...answers) => {
  let next = 0;
  return () => answers[Math.min(next++, answers.length - 1)]();
};

export async function failureOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return assert.fail('the call was expected to reject');
}
