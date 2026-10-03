const { body, validationResult } = require('express-validator');

// Tenant validation rules
const tenantValidation = [
  body('name').isLength({ min: 1, max: 100 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('domain').optional().isLength({ max: 100 }).trim().escape()
];

// Rate limit validation
const rateLimitValidation = [
  body('requests').isInt({ min: 1, max: 1000 }),
  body('windowMs').isInt({ min: 60000, max: 86400000 }) // 1 minute to 1 day
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = {
  tenantValidation,
  rateLimitValidation,
  validate
};
