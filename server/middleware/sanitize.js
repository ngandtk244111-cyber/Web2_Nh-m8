// Chặn NoSQL injection: bỏ các khoá bắt đầu bằng "$" (vd {"otp": {"$ne": ""}}) trong body khách gửi lên.
function stripOperators(value) {
  if (Array.isArray(value)) return value.map(stripOperators);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$')) delete value[key];
      else value[key] = stripOperators(value[key]);
    }
  }
  return value;
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') stripOperators(req.body);
  next();
}

module.exports = { sanitizeBody, stripOperators };
