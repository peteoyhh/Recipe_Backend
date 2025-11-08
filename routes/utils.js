// routes/utils.js
function buildQuery(model, req) {
    let query = model.find();
  
    // WHERE
    if (req.query.where) {
      try {
        const whereObj = JSON.parse(req.query.where);
        query = query.find(whereObj);
      } catch {
        throw new Error('Invalid JSON in "where" parameter');
      }
    }
  
    // SORT
    if (req.query.sort) {
      try {
        const sortObj = JSON.parse(req.query.sort);
        query = query.sort(sortObj);
      } catch {
        throw new Error('Invalid JSON in "sort" parameter');
      }
    }
  
    // SELECT
    if (req.query.select) {
      try {
        const selectObj = JSON.parse(req.query.select);
        query = query.select(selectObj);
      } catch {
        throw new Error('Invalid JSON in "select" parameter');
      }
    }
  
    // SKIP
    if (req.query.skip) {
      const skipNum = parseInt(req.query.skip);
      if (!isNaN(skipNum)) query = query.skip(skipNum);
    }
    

    // LIMIT
    if (req.query.limit) {
        const limitNum = parseInt(req.query.limit);
        if (!isNaN(limitNum)) query = query.limit(limitNum);
    } else {
        if (model.modelName === 'Recipe') query = query.limit(100);
    }
  
  
    return query;
  }
  
  module.exports = { buildQuery };