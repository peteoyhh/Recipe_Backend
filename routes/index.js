module.exports = function (app, router) {
    app.use('/api', require('./home.js')(router));
    app.use('/api', require('./users.js')(router));
    app.use('/api', require('./recipes.js')(router));
    app.use('/api', require('./gridfs-images.js')(router));
    app.use('/api', require('./verification.js')(router));
    app.use('/api', require('./auth.js')(router));
    app.use('/api', require('./favorites.js')(router));
    app.use('/api', require('./user-recipes.js')(router));
    app.use('/api', require('./chat.js')(router));
};