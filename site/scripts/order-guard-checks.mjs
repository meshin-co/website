import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = {
  selection: 'scripts/topic-selection.mjs',
  scene: 'scripts/fixtures/topic-inputs.mjs',
  limits: 'scripts/entry-limits.mjs',
};
const PILOTS = 'why do AI pilots fail to reach production';
const EVALS = 'how to put evals for AI agents into CI';
const BOARD = 'board memo AI strategy one page';
const REFUSED_ORDERS = [
  { kind: 'prompt', number: 11 },
  { kind: 'prompt', number: 31 },
  { kind: 'title', text: 'How to put evals into CI' },
];
const SURVIVING_ORDER = { kind: 'title', text: 'Why AI steering committees stall' };

const pass = (reason) => ({ ok: true, reason });
const fail = (reason) => ({ ok: false, reason });
const nameOf = (order) => (order.kind === 'prompt' ? `prompt ${order.number}` : JSON.stringify(order.text));
const writtenBy = ({ entries }) => entries.map(({ topic }) => JSON.stringify(topic.title)).join(', ') || 'nothing';

function sceneInputs({ scene, limits }, order) {
  const prompts = [scene.prompt(9, PILOTS), scene.prompt(11, EVALS), scene.prompt(30, BOARD)];
  return scene.inputsFor(scene.reportOf(prompts), { rotation: limits.CATEGORIES.slice(0, 2), order });
}

function terminalProblem(decision, ladderTitle, name) {
  if (decision.decision !== 'none') {
    return `a refused order (${name}) ended in a ${decision.decision} decision that writes ${writtenBy(decision)}`;
  }
  if (decision.entries.length > 0) return `a refused order (${name}) still holds ${decision.entries.length} entry`;
  if (decision.fallback !== null) return `a refused order (${name}) left a category rotation for a model call to try`;
  if (decision.strengthen !== null || decision.advisories.length > 0 || decision.proposals.length > 0) {
    return `a refused order (${name}) still reported other topics`;
  }
  if (!decision.reason.includes(name) || !decision.reason.includes('refused')) {
    return `a refused order (${name}) gave a reason that does not name the order and its refusal`;
  }
  if (JSON.stringify(decision).includes(ladderTitle))
    return `a refused order (${name}) names ${JSON.stringify(ladderTitle)}`;
  return null;
}

export function orderRefusalCheck(modules) {
  const { selectTopic } = modules.selection;
  const ladder = selectTopic(sceneInputs(modules, null));
  if (ladder.decision !== 'write') {
    return fail(`the scene offers no topic to fall back to: the ladder gave a ${ladder.decision} decision`);
  }
  const ladderTitle = ladder.entries[0].topic.title;
  for (const order of REFUSED_ORDERS) {
    const problem = terminalProblem(selectTopic(sceneInputs(modules, order)), ladderTitle, nameOf(order));
    if (problem !== null) return fail(problem);
  }
  const { decision, entries } = selectTopic(sceneInputs(modules, SURVIVING_ORDER));
  if (decision !== 'write' || entries.length !== 1 || entries[0].origin !== 'ordered') {
    return fail('an order that passes every check was not the only entry written, marked ordered');
  }
  return pass(
    'a refused order ends in none with no entry, no strengthen, no proposal, no category rotation and no mention of ' +
      `${JSON.stringify(ladderTitle)}, which the ladder writes without it; an order that passes every check is the only entry written, marked ordered`
  );
}

export const ORDER_CHECKS = {
  'order-refusal-is-terminal': orderRefusalCheck,
};

export async function loadOrderModules(copySite) {
  const loaded = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => [key, await import(pathToFileURL(join(copySite, file)).href)])
  );
  return Object.fromEntries(loaded);
}

export async function runOrderCheck(name, copySite) {
  if (!Object.hasOwn(ORDER_CHECKS, name)) throw new Error(`no order check named ${name}`);
  return ORDER_CHECKS[name](await loadOrderModules(copySite));
}
