# simple-http-etag-header-parse

Parses and compares HTTP entity-tags (ETags), handling weak (`W/`) prefixes, quoted-string syntax, and the If-Match / If-None-Match validation rules.

## Usage

```js
import {
  parseETag,
  formatETag,
  isWeak,
  compareETags,
  matchesIfMatch,
  matchesIfNoneMatch,
  validateETag,
} from 'simple-http-etag-header-parse';

// Parse a single entity-tag
const etag = parseETag('W/"abc"');
// { weak: true, value: 'abc' }

// Format it back
formatETag(etag); // 'W/"abc"'

// Check weakness
isWeak(etag); // true

// Weak comparison (ignores weakness)
compareETags('W/"abc"', '"abc"'); // true

// If-Match uses strong comparison
matchesIfMatch('"abc"', '"abc"'); // true
matchesIfMatch('W/"abc"', '"abc"'); // false

// If-None-Match uses weak comparison
matchesIfNoneMatch('W/"abc"', '"abc"'); // false
matchesIfNoneMatch('"def"', '"abc"'); // true

// Validate a string
validateETag('"abc"'); // true
validateETag('abc'); // false
```

## Why this library exists

HTTP ETag handling is small but full of subtle rules: the weak prefix, the required quotes, the difference between strong and weak comparison, and the special `*` value in conditional headers. This library implements exactly those rules from RFC 7232 in a dependency-free way. The trade-off is that it does not attempt to be a general HTTP header parser; it focuses only on entity-tags and the two conditional request headers that use them.

## Edge cases

- `parseETag` trims leading and trailing whitespace, because real-world header values often include it even though the grammar does not.
- `matchesIfMatch` and `matchesIfNoneMatch` accept a header string that is a comma-separated list of entity-tags, and they handle quoted commas correctly.
- `matchesIfMatch` with a `*` header matches any non-null current entity-tag; `matchesIfNoneMatch` with a `*` header fails if a current entity-tag exists.
- The `value` inside the quotes may contain any printable ASCII except `"`, plus obs-text (0x80–0xFF). Control characters are rejected.
