const responseTime = (req, res, next) => {
  const start = Date.now();

  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    originalSend.call(this, data);
  };

  next();
};

module.exports = responseTime;
