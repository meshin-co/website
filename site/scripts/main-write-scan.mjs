const PROTECTED = '(?:refs\\/heads\\/)?(?:main|master)';
const REMOVED_SCRIPT = ['commit', 'to', 'main'].join('-');

const PATTERNS = [
  ['commit-ref-main', new RegExp(`--ref(?:=|\\s+)["']?${PROTECTED}\\b`)],
  ['push-head-to-main', new RegExp(`HEAD:["']?${PROTECTED}\\b`)],
  ['push-origin-main', new RegExp(`\\bpush\\b[^\\n]*?\\s\\+?["']?${PROTECTED}["']?(?:\\s|$)`)],
  ['push-array-main', new RegExp(`["']push["'][^\\]\\n]*["']\\+?(?:HEAD:)?${PROTECTED}["']`)],
  ['push-source-without-destination', new RegExp(`\\bpush\\b[^\\n&|;]*?\\s["']?(?:HEAD|@)["']?(?:\\s|$)`)],
  ['push-source-without-destination', new RegExp(`["']push["'][^\\]\\n]*["'](?:HEAD|@)["']`)],
  ['ref-update-main', new RegExp(`git\\/refs\\/heads\\/(?:main|master)\\b`)],
  ['removed-commit-script', new RegExp(REMOVED_SCRIPT)],
];

const GIT_PUSH = /\bgit push\b([^\n]*)/;
const COMMAND_END = /&&|\|\||[|;]/;
const TEXT_ONLY_LINE = /^\s*(?:#|\/\/|(?:-\s+)?(?:description|name|run-name):)/;
const WORKFLOW_DISPATCH = /\bgh workflow run\b[^&|;\n]*/g;

const hasNoRefspec = (line) => {
  const arguments_ = GIT_PUSH.exec(line)?.[1];
  if (arguments_ === undefined) return false;
  const positional = arguments_
    .split(COMMAND_END)[0]
    .split(/\s+/)
    .filter((word) => word !== '' && !word.startsWith('-'));
  return positional.length < 2;
};

const ruleOf = (line) =>
  PATTERNS.find(([, pattern]) => pattern.test(line))?.[0] ?? (hasNoRefspec(line) ? 'push-without-refspec' : null);

function logicalLines(text) {
  const lines = [];
  let pending = null;
  text.split('\n').forEach((physical, index) => {
    const joined = pending === null ? { line: index + 1, text: physical } : pending;
    if (pending !== null) joined.text = `${joined.text} ${physical.trim()}`;
    if (joined.text.endsWith('\\')) {
      joined.text = joined.text.slice(0, -1).trimEnd();
      pending = joined;
    } else {
      lines.push(joined);
      pending = null;
    }
  });
  if (pending !== null) lines.push(pending);
  return lines;
}

const executableOf = (content) => (TEXT_ONLY_LINE.test(content) ? '' : content.replace(WORKFLOW_DISPATCH, ''));

export const mainWriteFindings = (files) =>
  files.flatMap(({ path, text }) =>
    logicalLines(text).flatMap(({ line, text: content }) => {
      const rule = ruleOf(executableOf(content));
      return rule === null ? [] : [{ rule, path, line, text: content.trim() }];
    })
  );
