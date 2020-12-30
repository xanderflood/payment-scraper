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

module.exports = { errString }
