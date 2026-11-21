const express = require('express');
const app = require('../server');

// Allow the API to be served under a /backend path prefix on the same domain
// (e.g. https://elearning-master-backend.vercel.app/backend/api/v1/...)
const wrapper = express();
wrapper.use((req, res, next) => {
  if (req.url === '/backend' || req.url.startsWith('/backend/')) {
    req.url = req.url.slice('/backend'.length) || '/';
  }
  next();
});
wrapper.use(app);

module.exports = wrapper;
