module.exports = function (router) {

    var homeRoute = router.route('/');
  
    homeRoute.get(function (req, res) {
      res.send(`
        <h2> MP3 API is running successfully!</h2>
        <p>Try visiting:</p>
        <ul>
          <li><a href="/api/users">/api/users</a></li>
          <li><a href="/api/recipes">/api/recipes</a></li>
        </ul>
      `);
    });
  
    return router;
  };