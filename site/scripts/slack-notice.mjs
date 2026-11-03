import { postSlackMessage } from './escalate-channels.mjs';
import { describeDelivery, receiptOf, redactorFor } from './escalate.mjs';

export async function deliverNotice({ label, message, env, fetch, instant, stdout, stderr }) {
  const clean = redactorFor(env);
  const outcome = await postSlackMessage({ env, fetch, clean, message });
  const receipt = receiptOf('slack', instant.toISOString(), outcome, clean);
  const line = describeDelivery(`${label}: slack`, receipt);
  if (receipt.delivered) stdout(line);
  else stderr(`::warning::${line}`);
}
