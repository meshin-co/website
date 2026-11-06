import { REPAIR_ROLES } from './generation-record.mjs';
import { removalProblems } from './repair-guard.mjs';
import { RepairStop } from './repair-outcome.mjs';
import { CORRECTION_ROUNDS, countedCorrections, draftEntry } from './write-draft.mjs';
import { WriterError } from './writer-error.mjs';
import { OUTPUT_SCHEMA_NAME, outputSchema, parseOutput } from './writer-output.mjs';
import { loadPreflightContext, preflight } from './writer-preflight.mjs';
import { buildRepairPrompt, repairCorrectionMessage } from './writer-prompt-repair.mjs';

const rulesOf = (problems) => [...new Set(problems.map(({ rule }) => rule))].join(', ');

function parsed(json, format) {
  try {
    return { draft: parseOutput(json, { format }), problems: [] };
  } catch (error) {
    if (error instanceof WriterError && error.kind === 'output')
      return { draft: null, problems: [{ rule: 'output-shape', detail: error.message }] };
    throw error;
  }
}

export async function rewriteEntry({
  repoRoot,
  adapter,
  claim,
  before,
  runDate,
  findings,
  allowances,
  attempt,
  calls,
}) {
  const context = loadPreflightContext(repoRoot);
  const prompt = buildRepairPrompt({ repoRoot, claim, before, findings, allowances, attempt });
  const request = {
    system: prompt.system,
    user: prompt.user,
    schema: outputSchema(claim.format),
    schemaName: OUTPUT_SCHEMA_NAME,
    maxOutputTokens: prompt.maxOutputTokens,
  };
  const check = (json) => {
    const { draft, problems } = parsed(json, claim.format);
    if (draft === null) return { draft, problems };
    return {
      draft,
      problems: [
        ...preflight({ draft, claim, context, runDate }),
        ...removalProblems({ before, after: draft, may: allowances }),
      ],
    };
  };
  const outcome = await draftEntry({
    adapter,
    request,
    check,
    correct: repairCorrectionMessage,
    calls,
    roles: REPAIR_ROLES,
  });
  if (outcome.draft === null)
    throw new RepairStop(
      'unrepairable',
      'no rewrite of ' +
        claim.slug +
        " passed the repair's own checks after " +
        countedCorrections(CORRECTION_ROUNDS) +
        ': ' +
        rulesOf(outcome.problems)
    );
  return { draft: outcome.draft, prompt };
}
