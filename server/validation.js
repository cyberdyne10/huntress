const { z } = require('zod');

const demoIntakeSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  company: z.string().min(2).max(160),
  size: z.enum(['1-25', '26-100', '101-500', '500+']),
  message: z.string().min(10).max(2000),
});

function sanitizeText(value) {
  return value
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { demoIntakeSchema, sanitizeText };
