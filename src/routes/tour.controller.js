import asyncHandler from 'express-async-handler';
import { Tour } from '../models/tour.model.js';
import { APIFeatures } from '../utils/apiFeatures.js';

/**
 * @description   Fetch top 5 tours middleware
 * @route         GET /api/v1/tours/top-5-tours
 * @access        Public
 */
export const aliasTopTours = asyncHandler(async (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
});

/**
 * @description   Fetch all tours
 * @route         GET /api/v1/tours
 * @access        Public
 */
export const getTours = asyncHandler(async (req, res) => {
  // Execute query
  const features = new APIFeatures(Tour.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const tours = await features.query;

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: { tours },
  });
});

/**
 * @description   Create new Tour
 * @route         POST /api/v1/tours
 * @access        Public
 */
export const createTour = asyncHandler(async (req, res) => {
  const tour = await Tour.create(req.body);

  res.status(201).json({
    status: 'succes',
    data: { tour },
  });
});

/**
 * @description   Fetch one Tour
 * @route         GET /api/v1/tours/:id
 * @access        Public
 */
export const getTour = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tour = await Tour.findById(id);

  if (!tour) {
    res.status(404).json({
      status: 'fail',
      data: null,
    });
  }

  res.status(200).json({
    status: 'succes',
    data: { tour },
  });
});

/**
 * @description   Update one Tour
 * @route         PATCH /api/v1/tours/:id
 * @access        Public
 */
export const updateTour = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tour = await Tour.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: { tour },
  });
});

/**
 * @description   Delete one Tour
 * @route         DELETE /api/v1/tours/:id
 * @access        Public
 */
export const deleteTour = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Tour.findByIdAndDelete(id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * @description   Use aggregation pipeline to get tour stats
 * @route         GET /api/v1/tours/:id
 * @access        Public
 */
export const getTourStats = asyncHandler(async (req, res) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        // _id: '$ratings',
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } },
    // },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

/**
 * @description   Get monthly stats for a tour with MongoDB agregation pipeline
 * @route         DELETE /api/v1/tours/monthly-plan/:year
 * @access        Public
 */
export const getMonthlyPlan = asyncHandler(async (req, res) => {
  const { year } = req.params * 1;

  const plan = await Tour.arguments([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numbTourStarts: -1 },
    },
    {
      $limit: 12,
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});
