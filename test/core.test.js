import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseETag,
  formatETag,
  isWeak,
  compareETags,
  matchesIfMatch,
  matchesIfNoneMatch,
  validateETag,
} from '../src/core.js';

test('parseETag parses a strong ETag', () => {
  assert.deepEqual(parseETag('"abc"'), { weak: false, value: 'abc' });
});

test('parseETag parses a weak ETag', () => {
  assert.deepEqual(parseETag('W/"abc"'), { weak: true, value: 'abc' });
});

test('parseETag trims surrounding whitespace', () => {
  assert.deepEqual(parseETag('  "abc"  '), { weak: false, value: 'abc' });
});

test('parseETag rejects unquoted values', () => {
  assert.throws(() => parseETag('abc'), SyntaxError);
});

test('parseETag rejects empty string', () => {
  assert.throws(() => parseETag(''), SyntaxError);
});

test('parseETag rejects mismatched quotes', () => {
  assert.throws(() => parseETag('"abc'), SyntaxError);
});

test('parseETag rejects a double quote inside the value', () => {
  assert.throws(() => parseETag('"a"b"'), SyntaxError);
});

test('parseETag accepts obs-text characters', () => {
  // 0x80 is a valid obs-text character.
  assert.deepEqual(parseETag('"\u0080"'), { weak: false, value: '\u0080' });
});

test('parseETag rejects control characters', () => {
  assert.throws(() => parseETag('"\u0001"'), SyntaxError);
});

test('formatETag round-trips a strong ETag', () => {
  assert.equal(formatETag({ weak: false, value: 'abc' }), '"abc"');
});

test('formatETag round-trips a weak ETag', () => {
  assert.equal(formatETag({ weak: true, value: 'abc' }), 'W/"abc"');
});

test('formatETag rejects invalid value', () => {
  assert.throws(() => formatETag({ weak: false, value: 'a"b' }), SyntaxError);
});

test('isWeak returns true for a weak ETag string', () => {
  assert.equal(isWeak('W/"abc"'), true);
});

test('isWeak returns false for a strong ETag string', () => {
  assert.equal(isWeak('"abc"'), false);
});

test('isWeak works with a parsed object', () => {
  assert.equal(isWeak({ weak: true, value: 'abc' }), true);
});

test('compareETags uses weak comparison, ignoring weakness', () => {
  assert.equal(compareETags('W/"abc"', '"abc"'), true);
});

test('compareETags returns false for different values', () => {
  assert.equal(compareETags('"abc"', '"def"'), false);
});

test('matchesIfMatch requires strong comparison', () => {
  // Weak candidate should not match a strong current tag.
  assert.equal(matchesIfMatch('W/"abc"', '"abc"'), false);
});

test('matchesIfMatch matches strong candidate and strong current', () => {
  assert.equal(matchesIfMatch('"abc"', '"abc"'), true);
});

test('matchesIfMatch with a list matches any strong candidate', () => {
  assert.equal(matchesIfMatch('"x", "abc"', '"abc"'), true);
});

test('matchesIfMatch with * matches any existing entity', () => {
  assert.equal(matchesIfMatch('*', '"abc"'), true);
});

test('matchesIfMatch with * fails when no entity exists', () => {
  assert.equal(matchesIfMatch('*', null), false);
});

test('matchesIfMatch fails when current is null', () => {
  assert.equal(matchesIfMatch('"abc"', null), false);
});

test('matchesIfNoneMatch uses weak comparison', () => {
  // Weak candidate matches strong current under weak comparison.
  assert.equal(matchesIfNoneMatch('W/"abc"', '"abc"'), false);
});

test('matchesIfNoneMatch returns true when no match', () => {
  assert.equal(matchesIfNoneMatch('"def"', '"abc"'), true);
});

test('matchesIfNoneMatch with * fails when entity exists', () => {
  assert.equal(matchesIfNoneMatch('*', '"abc"'), false);
});

test('matchesIfNoneMatch with * passes when no entity exists', () => {
  assert.equal(matchesIfNoneMatch('*', null), true);
});

test('matchesIfNoneMatch passes when current is null', () => {
  assert.equal(matchesIfNoneMatch('"abc"', null), true);
});

test('validateETag returns true for a valid ETag', () => {
  assert.equal(validateETag('"abc"'), true);
});

test('validateETag returns false for an invalid ETag', () => {
  assert.equal(validateETag('abc'), false);
});
