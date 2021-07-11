const express = require('express');
const {
  getAllUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
} = require('../controllers/userControllers');
const { signup, login } = require('../controllers/authControllers');

const router = express.Router();

// Authentication routes
router.post('/signup', signup);
router.post('/login', login);

// Application Routes
router.route('/').get(getAllUsers).post(createUser);
router.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);

module.exports = router;
