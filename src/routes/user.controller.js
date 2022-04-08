import asyncHandler from 'express-async-handler';

/**
 * @description   Fetch all users
 * @route         GET /api/v1/users
 * @access        Public
 */
export const getUsers = asyncHandler(async (req, res) => {});

/**
 * @description   Create new user
 * @route         POST /api/v1/users
 * @access        Public
 */
export const createUser = asyncHandler(async (req, res) => {});

/**
 * @description   Fetch user
 * @route         GET /api/v1/users/:id
 * @access        Public
 */
export const getUser = asyncHandler(async (req, res) => {});

/**
 * @description   Update user
 * @route         PUT /api/v1/users/:id
 * @access        Public
 */
export const updateUser = asyncHandler(async (req, res) => {});

/**
 * @description   Delete user
 * @route         DELETE /api/v1/users/:id
 * @access        Public
 */
export const deleteUser = asyncHandler(async (req, res) => {});
