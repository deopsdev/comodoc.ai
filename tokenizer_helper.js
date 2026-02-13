// Simple tokenizer helper (approximate)
// - Uses a fast approximation: tokens ≈ Math.ceil(characters / 4)
// - Provides utilities to count tokens for messages and truncate history to fit a limit

function approxTokenCount(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function countMessageTokens(message) {
  // account for role + content overhead
  const roleOverhead = 3; // small fixed overhead per message
  return roleOverhead + approxTokenCount(message.content || '');
}

function countMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((sum, m) => sum + countMessageTokens(m), 0);
}

function truncateMessagesToTokenLimit(messages, maxTokens) {
  if (!Array.isArray(messages)) return messages;
  // Keep the system prompt (first message) if present
  const sysMsg = messages.find(m => m.role === 'system');
  const others = messages.filter(m => m.role !== 'system');

  // Start with latest messages and prepend system message at the end if exists
  const reversed = [...others].reverse();
  const kept = [];
  let total = sysMsg ? countMessageTokens(sysMsg) : 0;

  for (const msg of reversed) {
    const t = countMessageTokens(msg);
    if (total + t > maxTokens) break;
    kept.push(msg);
    total += t;
  }

  const result = [];
  if (sysMsg) result.push(sysMsg);
  // restore original order for kept messages
  return result.concat(kept.reverse());
}

module.exports = {
  approxTokenCount,
  countMessagesTokens,
  truncateMessagesToTokenLimit
};