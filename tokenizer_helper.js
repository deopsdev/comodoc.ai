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

  const content = message.content;
  if (!content) return roleOverhead;

  // If content is an array (multimodal), count text parts and small cost for media
  if (Array.isArray(content)) {
    let total = roleOverhead;
    for (const part of content) {
      if (!part) continue;
      if (part.type === 'text' && typeof part.text === 'string') {
        total += approxTokenCount(part.text);
      } else if (part.type === 'image_url' || part.type === 'audio' || part.type === 'image') {
        total += 3; // small fixed cost for non-text multimodal parts
      } else if (typeof part === 'string') {
        total += approxTokenCount(part);
      }
    }
    return total;
  }

  // fallback: content is string
  return roleOverhead + approxTokenCount(String(content));
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