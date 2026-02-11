const { z } = require('zod');

const demoIntakeSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  company: z.string().min(2).max(160),
  size: z.enum(['1-25', '26-100', '101-500', '500+']),
  message: z.string().min(10).max(2000),
});

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().min(1).max(50).default(1),
  timezone: z.string().min(2).max(60).default('Africa/Lagos'),
});

const bookingSchema = z.object({
  slotId: z.string().min(3).max(80),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  company: z.string().min(2).max(160),
  attendees: z.number().int().min(1).max(20).default(1),
  notes: z.string().max(1000).optional().default(''),
});

function sanitizeText(value = '') {
  return String(value)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  demoIntakeSchema,
  slotSchema,
  bookingSchema,
  sanitizeText,
};
