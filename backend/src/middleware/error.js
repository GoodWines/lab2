
// Логування помилок у консоль
export const errorLogger = (err, req, res, next) => {
  console.error(`Error occurred at ${new Date().toISOString()}:`);
  console.error(`Path: ${req.method} ${req.path}`);
  console.error(`Error: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  next(err);
};

// Обробка помилок для клієнта
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: message
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}`;
    return res.status(409).json({
      success: false,
      error: 'Duplicate Entry',
      message: message
    });
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    return res.status(400).json({
      success: false,
      error: 'Invalid ID',
      message: message
    });
  }

  // Default error handler
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
