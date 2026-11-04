import { CATEGORIES } from '../entry-limits.mjs';
import { selectTopic } from '../topic-selection.mjs';
import { inputsFor, reportOf } from './topic-inputs.mjs';
import { ROUTES, adapterOn, completed, inSequence, reply } from './writer-vendors.mjs';

export const [GOVERNANCE, AGENTIC] = CATEGORIES;

export const QUERY_ACCEPTED = 'how to write an ai incident runbook';
export const QUERY_OTHER = 'how to staff an ai review board';
export const QUERY_REGISTER = 'how to put evals into ci';
export const QUERY_DEFINITION = 'what is a model card';

export const answerWith =
  (query, usage = {}) =>
  () =>
    reply(completed({ text: JSON.stringify({ query }), ...usage }));

export const proposalScene = ({
  answers = [],
  routes = {},
  rotation = [GOVERNANCE, AGENTIC],
  report = reportOf([]),
  ...extra
}) => {
  const inputs = inputsFor(report, { rotation, ...extra });
  const answering = { [ROUTES.responses]: inSequence(...answers), ...routes };
  const { adapter, calls: sent } = adapterOn({ routes: answering });
  return { inputs, decision: selectTopic(inputs), adapter, sent };
};

export const modelRequests = (sent) => sent.filter(({ route }) => route === ROUTES.responses);

export const promptOf = ({ json }) => json.input[0].content;
