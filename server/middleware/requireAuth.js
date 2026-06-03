// Redirects unauthenticated requests for /app/* and /api/* to the landing page.
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  return res.redirect('/');
}

module.exports = requireAuth;
