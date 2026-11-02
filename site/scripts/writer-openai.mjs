import { normalizeOpenAiModels } from './writer-models.mjs';

const ORIGIN = 'https://api.openai.com';
const MESSAGES_URL = `${ORIGIN}/v1/responses`;
const MODELS_URL = `${ORIGIN}/v1/models`;

const REFUSED = { kind: 'output', reason: 'refused to answer' };
const UNFINISHED = { kind: 'output', reason: 'did not finish its answer' };
const TRUNCATED = {
  kind: 'output',
  reason: 'cut its answer off at max_output_tokens, a limit that reasoning tokens share',
};
const CACHE_WRITE = { kind: 'price', reason: 'billed a cache write, which the configured rates do not cover' };

const listOf = (value) => (Array.isArray(value) ? value : []);
const isText = (value) => typeof value === 'string' && value !== '';

export const requestHeaders = (apiKey) => ({ Authorization: `Bearer ${apiKey}` });

export const listModels = async (send) => normalizeOpenAiModels(await send({ method: 'GET', url: MODELS_URL }));

export const messageRequest = ({ model, system, messages, schema, schemaName, maxOutputTokens }) => ({
  url: MESSAGES_URL,
  body: {
    model,
    instructions: system,
    input: messages,
    text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
    max_output_tokens: maxOutputTokens,
    store: false,
    prompt_cache_options: { mode: 'explicit' },
  },
});

export const isUnknownModel = (payload) => payload?.error?.code === 'model_not_found';

const messageContent = (output) =>
  listOf(output)
    .filter((item) => item?.type === 'message')
    .flatMap((item) => listOf(item.content));

const textOf = (content) =>
  content
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');

const stopReasonOf = ({ status, incomplete_details: incomplete }, refused) => {
  if (refused) return 'refusal';
  if (status === 'incomplete' && isText(incomplete?.reason)) return incomplete.reason;
  return isText(status) ? status : 'unknown';
};

const failureOf = ({ status, incomplete_details: incomplete }, { refused, cacheWrites }) => {
  if (cacheWrites > 0) return CACHE_WRITE;
  if (refused) return REFUSED;
  if (status === 'completed') return null;
  return status === 'incomplete' && incomplete?.reason === 'max_output_tokens' ? TRUNCATED : UNFINISHED;
};

export function readMessage(payload) {
  const content = messageContent(payload.output);
  const refused = [...listOf(payload.output), ...content].some((part) => part?.type === 'refusal');
  const cacheWrites = payload.usage?.input_tokens_details?.cache_write_tokens;
  return {
    responseId: payload.id,
    resolvedModel: payload.model,
    text: textOf(content),
    usage: { input: payload.usage?.input_tokens, output: payload.usage?.output_tokens },
    stopReason: stopReasonOf(payload, refused),
    failure: failureOf(payload, { refused, cacheWrites }),
  };
}
