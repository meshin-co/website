import { createHash } from 'node:crypto';

import { costUsd } from './writer-cost.mjs';
import { WriterError } from './writer-error.mjs';
import { checkModel } from './writer-models.mjs';
import * as openai from './writer-openai.mjs';
import { assertNoSecrets, redact, secretsOf } from './writer-redact.mjs';

export const IMPLEMENTATIONS = { openai };

const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value !== '';

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const nameOf = (error) => (typeof error?.name === 'string' && ERROR_NAME.test(error.name) ? error.name : 'Error');

const scrub = (value, secrets) => {
  if (typeof value === 'string') return redact(value, secrets);
  if (Array.isArray(value)) return value.map((item) => scrub(item, secrets));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key, secrets), scrub(item, secrets)]));
};

function sanitized(error, id, secrets) {
  if (!(error instanceof WriterError)) return new WriterError('vendor', `${id} call failed: ${nameOf(error)}`);
  const message = redact(error.message, secrets);
  if (message === error.message) return error;
  return new WriterError(error.kind, message, { variables: error.variables, status: error.status, call: error.call });
}

function httpFailure({ vendor, implementation }, { status, payload, namesModel }) {
  const { id, keyName, modelVariable, model } = vendor;
  if (status === 401 || status === 403) {
    const message = `${keyName} was refused by ${id} (HTTP ${status})`;
    return new WriterError('credential', message, { variables: [keyName], status });
  }
  if (namesModel && (status === 400 || status === 404) && implementation.isUnknownModel(payload)) {
    const message = `${modelVariable} is ${JSON.stringify(model)}, which ${id} does not know (HTTP ${status})`;
    return new WriterError('model', message, { variables: [modelVariable], status });
  }
  return new WriterError('vendor', `${id} answered HTTP ${status}`, { status });
}

function senderFor(context, fetch) {
  const { vendor, implementation, secrets } = context;
  return async ({ method, url, body }, { namesModel = false } = {}) => {
    assertNoSecrets({ url, body }, secrets, 'the request');
    const headers = { ...implementation.requestHeaders(vendor.apiKey) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    let text;
    try {
      response = await fetch(url, { method, headers, body, redirect: 'error' });
      text = await response.text();
    } catch (error) {
      throw new WriterError('vendor', `${vendor.id} request failed: ${nameOf(error)}`);
    }
    const payload = parseJson(text);
    const { status } = response;
    if (!response.ok) throw httpFailure(context, { status, payload, namesModel });
    if (isObject(payload)) return payload;
    throw new WriterError('vendor', `${vendor.id} answered HTTP ${status} without a JSON object`, { status });
  };
}

function callOf({ vendor, secrets }, read, requestDigest) {
  const { rates } = vendor;
  const usage = { input: read.usage.input, output: read.usage.output };
  return {
    text: redact(read.text, secrets),
    responseId: redact(read.responseId, secrets),
    resolvedModel: redact(read.resolvedModel, secrets),
    usage,
    stopReason: redact(read.stopReason, secrets),
    costUsd: costUsd(rates, usage),
    price: { inputPerMillion: rates.inputPerMillion, outputPerMillion: rates.outputPerMillion },
    requestDigest,
  };
}

function answerOf(context, payload, requestDigest) {
  const { vendor, implementation, secrets } = context;
  const { id } = vendor;
  const read = implementation.readMessage(payload);
  if (!isText(read.responseId) || !isText(read.resolvedModel)) {
    throw new WriterError('vendor', `${id} answered without a response id or a model`);
  }
  const failed = (call) => new WriterError(read.failure.kind, `${id} ${read.failure.reason}`, { call });
  let call;
  try {
    call = callOf(context, read, requestDigest);
  } catch (error) {
    if (error.kind === 'price' && read.failure?.kind === 'output') throw failed(null);
    throw error;
  }
  if (read.failure) throw failed(call);
  const json = parseJson(read.text);
  if (!isObject(json)) throw new WriterError('output', `${id} answered with text that is not a JSON object`, { call });
  return { json: scrub(json, secrets), ...call };
}

export function createAdapter({ vendor, fetch = globalThis.fetch }) {
  const { id, keyName, modelVariable, model, rates } = vendor;
  if (!Object.hasOwn(IMPLEMENTATIONS, id)) {
    const supported = Object.keys(IMPLEMENTATIONS).join(', ');
    throw new WriterError('config', `no writer adapter for provider ${JSON.stringify(id)} (supported: ${supported})`);
  }
  if (typeof vendor.apiKey !== 'string' || vendor.apiKey.trim() === '') {
    throw new WriterError('credential', `${keyName} is not set`, { variables: [keyName] });
  }
  const implementation = IMPLEMENTATIONS[id];
  const secrets = secretsOf([vendor]);
  const context = { vendor, implementation, secrets };
  const send = senderFor(context, fetch);

  const guarded = async (work) => {
    try {
      return await work();
    } catch (error) {
      throw sanitized(error, id, secrets);
    }
  };

  const verify = async () => checkModel({ model, modelVariable, models: await implementation.listModels(send) });
  let verification = null;
  const verifyModel = () => (verification ??= guarded(verify));

  const complete = (request) =>
    guarded(async () => {
      await verifyModel();
      const { url, body } = implementation.messageRequest({ ...request, model });
      const text = JSON.stringify(body);
      const payload = await send({ method: 'POST', url, body: text }, { namesModel: true });
      return answerOf(context, payload, createHash('sha256').update(text).digest('hex'));
    });

  return { id, keyName, modelVariable, model, rates: { ...rates }, verifyModel, complete };
}
