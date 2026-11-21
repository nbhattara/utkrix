const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getPageOptions,
  setPaginationHeaders,
} = require('../utils/pagination');

test('pagination defaults to the first page and default page size', () => {
  assert.deepEqual(getPageOptions({}), {
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    skip: 0,
  });
});

test('pagination computes offsets and caps requested page size', () => {
  assert.deepEqual(getPageOptions({ page: '3', limit: '10' }), {
    page: 3,
    limit: 10,
    skip: 20,
  });
  assert.deepEqual(getPageOptions({ page: '2', limit: '500' }), {
    page: 2,
    limit: MAX_PAGE_SIZE,
    skip: MAX_PAGE_SIZE,
  });
});

test('pagination response headers report total count and page metadata', () => {
  const headers = {};
  const response = { set: (values) => Object.assign(headers, values) };

  setPaginationHeaders(response, { page: 2, limit: 10 }, 21);

  assert.deepEqual(headers, {
    'X-Total-Count': '21',
    'X-Page': '2',
    'X-Page-Size': '10',
    'X-Total-Pages': '3',
  });
});
