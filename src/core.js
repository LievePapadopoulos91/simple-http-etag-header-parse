const WEAK_PREFIX = 'W/';

/**
 * Parses a single entity-tag from a string, optionally allowing leading/trailing whitespace.
 * Returns an object with `weak` (boolean) and `value` (string, the opaque quoted content without quotes).
 * Throws on malformed input.
 *
 * The grammar is intentionally strict per RFC 7232: entity-tag = [ weak ] opaque-tag, weak = %x57.2F, opaque-tag = DQUOTE *etagc DQUOTE,
 * etagc = %x21 / %x23-7E / obs-text. We accept only printable ASCII plus obs-text (0x80-0xFF) inside the quotes.
 */
export function parseETag(input) {
  if (typeof input !== 'string') {
    throw new TypeError('ETag must be a string');
  }
  let s = input;
  // RFC allows optional whitespace around the entity-tag in header fields, but the grammar itself
  // does not include it. We trim to be permissive with real-world header values.
  s = s.trim();
  if (s.length === 0) {
    throw new SyntaxError('Empty ETag');
  }

  let weak = false;
  if (s.startsWith(WEAK_PREFIX)) {
    weak = true;
    s = s.slice(WEAK_PREFIX.length);
  }

  if (s.length < 2 || s[0] !== '"' || s[s.length - 1] !== '"') {
    throw new SyntaxError('ETag must be a quoted string');
  }

  const value = s.slice(1, -1);
  // Validate etagc: %x21 / %x23-7E / obs-text. That means any char except DQUOTE (0x22),
  // and control characters are not allowed. obs-text is 0x80-0xFF.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x22) {
      throw new SyntaxError('ETag value must not contain a double quote');
    }
    if (code < 0x21 || (code > 0x7e && code < 0x80) || code > 0xff) {
      throw new SyntaxError('ETag value contains invalid character');
    }
  }

  return { weak, value };
}

/**
 * Formats an entity-tag object back into its string representation.
 * The object must have `weak` (boolean) and `value` (string).
 * The value is validated the same way as in parseETag.
 */
export function formatETag(etag) {
  if (etag === null || typeof etag !== 'object') {
    throw new TypeError('ETag must be an object');
  }
  const { weak, value } = etag;
  if (typeof weak !== 'boolean') {
    throw new TypeError('ETag.weak must be a boolean');
  }
  if (typeof value !== 'string') {
    throw new TypeError('ETag.value must be a string');
  }
  // Reuse validation logic by constructing a string and parsing it back.
  // This keeps the validation in one place; the cost is negligible.
  const candidate = (weak ? WEAK_PREFIX : '') + '"' + value + '"';
  parseETag(candidate);
  return candidate;
}

/**
 * Returns true if the given entity-tag is weak.
 * Accepts either a parsed object or a string.
 */
export function isWeak(etag) {
  if (typeof etag === 'string') {
    return parseETag(etag).weak;
  }
  if (etag === null || typeof etag !== 'object') {
    throw new TypeError('ETag must be a string or an object');
  }
  if (typeof etag.weak !== 'boolean') {
    throw new TypeError('ETag.weak must be a boolean');
  }
  return etag.weak;
}

/**
 * Compares two entity-tags for equality using the weak comparison function.
 * The weak comparison function ignores the weakness indicator, so W/"a" and "a" are equal.
 *
 * This is the comparison used by If-None-Match.
 */
export function compareETags(a, b) {
  const ea = typeof a === 'string' ? parseETag(a) : a;
  const eb = typeof b === 'string' ? parseETag(b) : b;
  if (ea === null || typeof ea !== 'object' || eb === null || typeof eb !== 'object') {
    throw new TypeError('ETags must be strings or objects');
  }
  return ea.value === eb.value;
}

/**
 * Evaluates an If-Match header against a current entity-tag.
 * If-Match uses the strong comparison function: both must be strong and values must match.
 * Returns true if the condition passes (i.e., the request should proceed).
 *
 * If the header is "*", it matches any existing entity.
 * If the current entity-tag is null (no current entity), the condition fails unless header is "*".
 */
export function matchesIfMatch(header, currentETag) {
  if (typeof header !== 'string') {
    throw new TypeError('header must be a string');
  }
  header = header.trim();
  if (header === '*') {
    return currentETag !== null && currentETag !== undefined;
  }
  const current = normalizeETag(currentETag);
  if (current === null) {
    return false;
  }
  const candidates = parseETagList(header);
  for (const candidate of candidates) {
    if (!candidate.weak && !current.weak && candidate.value === current.value) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates an If-None-Match header against a current entity-tag.
 * If-None-Match uses the weak comparison function: weakness is ignored.
 * Returns true if the condition passes (i.e., the request should proceed).
 *
 * If the header is "*", it fails if any current entity exists.
 * If the current entity-tag is null, the condition passes (no match).
 */
export function matchesIfNoneMatch(header, currentETag) {
  if (typeof header !== 'string') {
    throw new TypeError('header must be a string');
  }
  header = header.trim();
  if (header === '*') {
    return currentETag === null || currentETag === undefined;
  }
  const current = normalizeETag(currentETag);
  if (current === null) {
    return true;
  }
  const candidates = parseETagList(header);
  for (const candidate of candidates) {
    if (candidate.value === current.value) {
      return false;
    }
  }
  return true;
}

/**
 * Validates an ETag string, returning true if it is well-formed, false otherwise.
 * This is a convenience wrapper that catches the SyntaxError from parseETag.
 */
export function validateETag(input) {
  try {
    parseETag(input);
    return true;
  } catch (_e) {
    return false;
  }
}

// -- internal helpers --

function normalizeETag(etag) {
  if (etag === null || etag === undefined) {
    return null;
  }
  if (typeof etag === 'string') {
    return parseETag(etag);
  }
  if (typeof etag === 'object') {
    if (typeof etag.weak !== 'boolean' || typeof etag.value !== 'string') {
      throw new TypeError('Invalid ETag object');
    }
    return etag;
  }
  throw new TypeError('ETag must be a string, object, null, or undefined');
}

function parseETagList(header) {
  // Split on commas that are not inside quotes. This is a small state machine.
  const parts = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < header.length; i++) {
    const ch = header[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(header.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(header.slice(start));

  const etags = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      // Empty list elements are allowed by the grammar (e.g., trailing comma).
      // We skip them.
      continue;
    }
    etags.push(parseETag(trimmed));
  }
  return etags;
}
