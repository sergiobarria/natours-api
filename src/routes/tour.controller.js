import fs from 'fs';

import asyncHandler from 'express-async-handler';

// TEMPORAL CODE TO READ DATA FROM JSON FILE
// TODO: Remove this code 👇 after connecting to MongoDB
const tours = JSON.parse(
  fs.readFileSync('dev-data/data/tours-simple.json', 'utf-8')
);

/**
 * @description   Fetch all tours
 * @route         GET /api/v1/tours
 * @access        Public
 */
export const getTours = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { tours },
  });
});

/**
 * @description   Create new Tour
 * @route         POST /api/v1/tours
 * @access        Public
 */
export const createTour = asyncHandler(async (req, res) => {
  const id = tours[tours.length - 1].id + 1;
  const tour = { ...req.body, id };
  return tour;
});

/**
 * @description   Fetch one Tour
 * @route         GET /api/v1/tours/:id
 * @access        Public
 */
export const getTour = asyncHandler(async (req, res) => {});

/**
 * @description   Update one Tour
 * @route         PUT /api/v1/tours/:id
 * @access        Public
 */
export const updateTour = asyncHandler(async (req, res) => {});

/**
 * @description   Delete one Tour
 * @route         DELETE /api/v1/tours/:id
 * @access        Public
 */
export const deleteTour = asyncHandler(async (req, res) => {});
