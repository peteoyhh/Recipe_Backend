// routes/index.js
/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app, router) {
    app.use('/api', require('./home.js')(router));

    app.use('/api', require('./users.js')(router));

    app.use('/api', require('./recipes.js')(router));
    
    // GridFS 图片 API (MongoDB 存储)
    app.use('/api', require('./gridfs-images.js')(router));
};