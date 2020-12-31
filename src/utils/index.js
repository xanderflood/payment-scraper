function replaceErrors(key, value) {
  if (value instanceof Error) {
    var error = {};

    Object.getOwnPropertyNames(value).forEach(function (key) {
        error[key] = value[key];
    });

    return error;
  }

  return value;
}

function errString(error) {
  return JSON.stringify(error, replaceErrors)
}

function statsdPath (path) {
  return function (req, res, next) {
    var method = req.method || 'unknown_method';
    req.statsdKey = ['http', method.toLowerCase(), path].join('.');
    next();
  };
}

module.exports = { errString, statsdPath }
