import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLabels } from './score.js';

function fixture() {
  const items = Array.from({ length: 50 }, (_, i) => ({
    id: `post:${i}`,
    truth: { role: 'Software Engineering', city: 'Pune', isFresher: true },
    llm: { role: 'Other', city: 'Remote', isFresher: false },
  }));
  const docs = items.map((x) => ({ _id: x.id, ...x.truth }));
  return { items, docs };
}

test('scores all 50 current predictions, not the saved sample predictions', () => {
  const { items, docs } = fixture();
  docs[0].role = 'Other';
  docs[1].city = 'Remote';
  docs[1].isFresher = false;
  const result = scoreLabels(items, docs);
  assert.equal(result.sampleSize, 50);
  assert.deepEqual(result.accuracy, { role: 98, city: 98, roleAndCity: 96, fresherFlag: 98 });
  assert.equal(result.errors.length, 2);
  assert.equal(items[0].llm.city, 'Remote');
  const sameSample = scoreLabels([...items].reverse(), docs);
  assert.equal(sameSample.sampleHash, result.sampleHash);
  items[0].truth.city = 'Mumbai';
  assert.notEqual(scoreLabels(items, docs).sampleHash, result.sampleHash);
});

test('refuses partial, duplicate or incompletely reviewed samples', () => {
  const { items, docs } = fixture();
  assert.throws(() => scoreLabels(items.slice(1), docs), /at least 50/);
  assert.throws(() => scoreLabels([...items.slice(1), items[1]], docs), /duplicate/);
  items[0].truth.isFresher = undefined;
  assert.throws(() => scoreLabels(items, docs), /invalid hand labels/);
});

test('missing current jobs cannot fall back to stale saved predictions', () => {
  const { items, docs } = fixture();
  assert.throws(() => scoreLabels(items, docs.slice(1)), /refusing to reuse saved/);
  docs[0].isFresher = 'false';
  assert.throws(() => scoreLabels(items, docs), /invalid current prediction/);
});
