const fs = require('fs');
const path = require('path');

const JSON_INDENT_SPACES = 2;

/**
 * Serializes a spec object to pretty-printed JSON and writes it to disk,
 * creating any missing parent directories.
 */
const writeJsonFile = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const json = `${JSON.stringify(data, null, JSON_INDENT_SPACES)}\n`;
  fs.writeFileSync(filePath, json, 'utf8');

  return Buffer.byteLength(json, 'utf8');
};

module.exports = { writeJsonFile };
