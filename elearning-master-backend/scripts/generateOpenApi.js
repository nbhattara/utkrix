const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// config/swagger.js resolves its `apis` glob relative to the process cwd,
// so make sure it always runs from the project root.
process.chdir(PROJECT_ROOT);

const swaggerSpec = require('../config/swagger');
const { writeJsonFile } = require('./lib/openapiWriter');
const { findDanglingRefs, summarizeSpec } = require('./lib/openapiValidator');

const OUTPUT_PATH = path.join(PROJECT_ROOT, 'openapi.json');

const reportSummary = (summary, outputPath) => {
  console.log(`OpenAPI spec written to ${outputPath}`);
  console.log(`  paths      : ${summary.paths}`);
  console.log(`  operations : ${summary.operations}`);
  console.log(`  schemas    : ${summary.schemas}`);
  console.log(`  tags       : ${summary.tags}`);
};

const reportDanglingRefs = (danglingRefs) => {
  if (danglingRefs.length === 0) {
    console.log('  refs       : all $ref targets resolve');
    return;
  }

  console.error(`\nFound ${danglingRefs.length} dangling $ref target(s):`);
  danglingRefs.forEach((ref) => console.error(`  - ${ref}`));
  process.exitCode = 1;
};

const generateOpenApiJson = () => {
  const summary = summarizeSpec(swaggerSpec);
  const danglingRefs = findDanglingRefs(swaggerSpec);

  const bytesWritten = writeJsonFile(OUTPUT_PATH, swaggerSpec);

  reportSummary(summary, OUTPUT_PATH);
  console.log(`  size       : ${bytesWritten} bytes`);
  reportDanglingRefs(danglingRefs);
};

generateOpenApiJson();
