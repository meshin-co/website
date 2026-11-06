import { readEngineConfig } from './engine-config.mjs';
import { WRITING_ROLES, callRecord } from './generation-record.mjs';

export const CORRECTION_ROUNDS = readEngineConfig().loop.correctionRounds;

export const countedCorrections = (rounds) => `${rounds} correction${rounds === 1 ? '' : 's'}`;

export function meter(adapter, calls) {
  return async (role, request) => {
    try {
      const result = await adapter.complete(request);
      calls.push(callRecord({ role, adapter, result }));
      return result;
    } catch (error) {
      if (error.call) calls.push(callRecord({ role, adapter, result: error.call }));
      throw error;
    }
  };
}

export async function draftEntry({
  adapter,
  request,
  check,
  correct,
  calls,
  roles = WRITING_ROLES,
  rounds = CORRECTION_ROUNDS,
}) {
  const ask = meter(adapter, calls);
  const messages = [{ role: 'user', content: request.user }];
  for (let round = 0; ; round += 1) {
    const result = await ask(roles[round === 0 ? 0 : 1], {
      system: request.system,
      messages: messages.map((message) => ({ ...message })),
      schema: request.schema,
      schemaName: request.schemaName,
      maxOutputTokens: request.maxOutputTokens,
    });
    const { draft, problems } = check(result.json);
    const finalCall = calls.at(-1);
    if (problems.length === 0) return { draft, problems, finalCall };
    if (round === rounds) return { draft: null, problems, finalCall };
    messages.push({ role: 'assistant', content: result.text }, { role: 'user', content: correct(problems) });
  }
}
