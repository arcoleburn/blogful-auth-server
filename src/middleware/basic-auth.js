'use strict';

function requireAuth(req, res, next) {
  console.log('req auth');
  console.log(req.get('Authorization'));
  const authToken = req.get('Authorization') || '';
  let basicToken;
  if (!authToken.toLowerCase().startsWith('basic')) {
    return res.status(401).json({ error: 'missing basic token' });
  } else {
    basicToken = authToken.slice('basic '.length, authToken.length);
  }
  const [tokenUserName, tokenPassword] = Buffer.from(
    basicToken,
    'base64'
  )
    .toString()
    .split(':');

  if (!tokenUserName || !tokenPassword) {
    return res.status(401).json({ error: 'unauthorized request' });
  }

  req.app
    .get('db')('blogful_users')
    .where({ user_name: tokenUserName })
    .first()
    .then((user) => {
      if (!user) {
        return res
          .status(401)
          .json({ error: 'unauthorized request' });
      }
    });
  next();
}

module.exports = {
  requireAuth,
};
