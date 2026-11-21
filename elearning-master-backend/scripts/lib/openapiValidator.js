const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

/**
 * Walks an arbitrary OpenAPI node and collects every `$ref` string it contains.
 */
const collectRefs = (node, refs) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectRefs(item, refs));
    return refs;
  }

  if (node !== null && typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => {
      if (key === '$ref' && typeof value === 'string') {
        refs.add(value);
      } else {
        collectRefs(value, refs);
      }
    });
  }

  return refs;
};

/**
 * Decodes a JSON Pointer segment (RFC 6901) e.g. `~1` -> `/`, `~0` -> `~`.
 */
const decodePointerSegment = (segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~');

/**
 * Resolves a local (`#/...`) JSON Pointer reference against the spec document.
 */
const resolveLocalRef = (spec, ref) => {
  if (!ref.startsWith('#/')) {
    return undefined;
  }

  return ref
    .slice(2)
    .split('/')
    .map(decodePointerSegment)
    .reduce((node, segment) => {
      if (node === null || node === undefined || typeof node !== 'object') {
        return undefined;
      }
      return node[segment];
    }, spec);
};

/**
 * Returns every `$ref` in the spec that does not resolve to a real node.
 * Dangling refs break Swagger UI rendering, so we surface them explicitly.
 */
const findDanglingRefs = (spec) => {
  const refs = collectRefs(spec, new Set());

  return [...refs].filter((ref) => resolveLocalRef(spec, ref) === undefined).sort();
};

/**
 * Counts the meaningful parts of a spec so a generated file can be sanity checked.
 */
const summarizeSpec = (spec) => {
  const pathItems = Object.values(spec.paths || {});

  const operations = pathItems.reduce(
    (total, pathItem) => total + HTTP_METHODS.filter((method) => pathItem[method]).length,
    0
  );

  return {
    paths: Object.keys(spec.paths || {}).length,
    operations,
    schemas: Object.keys((spec.components && spec.components.schemas) || {}).length,
    tags: (spec.tags || []).length,
  };
};

module.exports = { findDanglingRefs, resolveLocalRef, summarizeSpec };
