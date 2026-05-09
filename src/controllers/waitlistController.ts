import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response';
import { validateOrThrow } from '../validation';
import { CreateWaitlistSignupSchema } from '../validation/waitlist.schema';
import { sendWaitlistSignupEmail } from '../services/waitlistService';

export const createWaitlistSignup = catchAsync(async (req: Request, res: Response) => {
  const inputRaw = validateOrThrow(CreateWaitlistSignupSchema, req.body);
  const input = {
    email: inputRaw.email,
    name: inputRaw.name ?? '',
    company: inputRaw.company ?? '',
    role: inputRaw.role ?? '',
    size: inputRaw.size ?? '',
  };
  await sendWaitlistSignupEmail(input);
  sendSuccess(res, { accepted: true }, 201);
});
