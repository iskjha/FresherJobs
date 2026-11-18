import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILTERS, filtersToParams, paramsToFilters } from './filterJobs.js';

const roundTrip = (filters) => ({ ...DEFAULT_FILTERS, ...paramsToFilters(new URLSearchParams(filtersToParams(filters).toString())) });

test('filters survive a URL round-trip and defaults are omitted', () => {
  const filters = { ...DEFAULT_FILTERS, query: 'data', roles: ['Sales & Business Development', 'Marketing'], jobType: 'Internship' };
  assert.equal(filtersToParams(filters).has('sort'), false);
  assert.deepEqual(roundTrip(filters), filters);
});

test('All (null) is omitted from the URL while None ([]) survives as an empty param', () => {
  assert.equal(filtersToParams(DEFAULT_FILTERS).toString(), '');
  const none = { ...DEFAULT_FILTERS, cities: [] };
  assert.equal(filtersToParams(none).toString(), 'cities=');
  assert.deepEqual(roundTrip(none), none);
});
