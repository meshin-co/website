export async function readResponseText(response, maxBytes) {
  const decoder = new TextDecoder();
  let text = '';
  let bytesRead = 0;
  for await (const chunk of response.body ?? []) {
    const kept = chunk.subarray(0, maxBytes - bytesRead);
    text += decoder.decode(kept, { stream: true });
    bytesRead += kept.length;
    if (bytesRead >= maxBytes) break;
  }
  return text;
}
