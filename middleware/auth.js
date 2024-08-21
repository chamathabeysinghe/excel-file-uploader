function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); // User is authenticated, proceed to the next middleware/route handler
  }
  res.redirect('/authentication/sign-in'); // User is not authenticated, redirect to the login page
}

module.exports = isAuthenticated;