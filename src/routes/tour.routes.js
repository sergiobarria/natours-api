import express from 'express';

import {
  getTours,
  createTour,
  getTour,
  updateTour,
  deleteTour,
} from './tour.controller.js';

const router = express.Router();

router.route('/').get(getTours).post(createTour);

router.route('/:id').get(getTour).patch(updateTour).delete(deleteTour);

export default router;
