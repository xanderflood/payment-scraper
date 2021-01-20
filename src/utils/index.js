function replaceErrors(key, value) {
  if (value instanceof Error) {
    const error = {};

    Object.getOwnPropertyNames(value).forEach((prop) => {
      error[prop] = value[prop];
    });

    return error;
  }

  return value;
}

function errString(error) {
  return JSON.stringify(error, replaceErrors);
}

function statsdPath(path) {
  return function (req, res, next) {
    const method = req.method || 'unknown_method';
    req.statsdKey = ['http', method.toLowerCase(), path].join('.');
    next();
  };
}

module.exports = { errString, statsdPath };
