import { Request, Response, NextFunction } from 'express';

type Rule = {
  type?: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
};
type Schema = Record<string, Rule>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const rules = { EMAIL };

/** Minimal body validator middleware. Returns 400 with the first violation. */
export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body ?? {};
    for (const [field, rule] of Object.entries(schema)) {
      const v = body[field];
      if (v === undefined || v === null || v === '') {
        if (rule.required) return res.status(400).json({ success: false, error: `${field} is required` });
        continue;
      }
      if (rule.type === 'array' && !Array.isArray(v)) return res.status(400).json({ success: false, error: `${field} must be an array` });
      if (rule.type && rule.type !== 'array' && typeof v !== rule.type) return res.status(400).json({ success: false, error: `${field} must be a ${rule.type}` });
      if (typeof v === 'string') {
        if (rule.minLength && v.length < rule.minLength) return res.status(400).json({ success: false, error: `${field} must be at least ${rule.minLength} characters` });
        if (rule.maxLength && v.length > rule.maxLength) return res.status(400).json({ success: false, error: `${field} must be at most ${rule.maxLength} characters` });
        if (rule.pattern && !rule.pattern.test(v)) return res.status(400).json({ success: false, error: `${field} is invalid` });
      }
    }
    next();
  };
}
