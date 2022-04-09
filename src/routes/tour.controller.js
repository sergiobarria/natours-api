import asyncHandler from 'express-async-handler';
import { Tour } from '../models/tour.model.js';

/**
 * @description   Fetch all tours
 * @route         GET /api/v1/tours
 * @access        Public
 */
export const getTours = asyncHandler(async (req, res) => {
  const tours = await Tour.find();

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
