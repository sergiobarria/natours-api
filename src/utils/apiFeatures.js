export class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    /**
     * Gets query object and exclude fields used to filter and sort data:
     * 'page', 'sort', 'limit', 'fields'.
     */
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Takes remaining fields and add $ sign before to work according to mongoose
    // e.g. $gte or $lt
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|let|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    /**
     * Takes the query string and sort according to parameters
     * If no parameter is passed in the string it defaults to sorting
     * by 'createdAt' field.
     */
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-ceatedAt');
    }

    return this;
  }

  limitFields() {
    /**
     * Limits the query to the selected fields.
     * By defaults removes the '__v' field used by MongoDB and Mongoose
     */
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    /**
     * Adds pagination to the results.
     * Defaults: page = 1 and results = 100
     */
    const page = +this.queryString.page || 1;
    const limit = +this.queryString.limit || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}
