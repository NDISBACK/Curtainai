import nodemailer from 'nodemailer';
import { AppError } from '../utils/AppError';
import { CreateWaitlistSignupInput } from '../validation/waitlist.schema';

function requiredWaitlistEnv(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new AppError(`Missing waitlist email configuration: ${key}`, 503);
  }
  return value;
}

function optionalWaitlistEnv(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function hasSmtpConfig(): boolean {
  return Boolean(
    optionalWaitlistEnv('WAITLIST_SMTP_HOST')
    && optionalWaitlistEnv('WAITLIST_SMTP_PORT')
    && optionalWaitlistEnv('WAITLIST_SMTP_USER')
    && optionalWaitlistEnv('WAITLIST_SMTP_PASS')
    && optionalWaitlistEnv('WAITLIST_FROM_EMAIL')
    && optionalWaitlistEnv('WAITLIST_TO_EMAIL')
  );
}

function buildTransport() {
  const host = requiredWaitlistEnv('WAITLIST_SMTP_HOST');
  const port = Number(requiredWaitlistEnv('WAITLIST_SMTP_PORT'));
  const user = requiredWaitlistEnv('WAITLIST_SMTP_USER');
  const pass = requiredWaitlistEnv('WAITLIST_SMTP_PASS');

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function line(label: string, value?: string): string {
  return `${label}: ${value?.trim() ? value.trim() : '—'}`;
}

async function sendViaSmtp(input: CreateWaitlistSignupInput): Promise<void> {
  const transporter = buildTransport();
  const from = requiredWaitlistEnv('WAITLIST_FROM_EMAIL');
  const to = requiredWaitlistEnv('WAITLIST_TO_EMAIL');

  const subject = `New Early Access signup: ${input.email}`;
  const text = [
    'New Curtain early access form submission',
    '',
    line('Email', input.email),
    line('Name', input.name ?? ''),
    line('Company', input.company ?? ''),
    line('Role', input.role ?? ''),
    line('Team size', input.size ?? ''),
    line('Submitted at', new Date().toISOString()),
  ].join('\n');

  const html = `
    <h2>New Curtain early access form submission</h2>
    <p><strong>Email:</strong> ${input.email}</p>
    <p><strong>Name:</strong> ${input.name ?? '—'}</p>
    <p><strong>Company:</strong> ${input.company ?? '—'}</p>
    <p><strong>Role:</strong> ${input.role ?? '—'}</p>
    <p><strong>Team size:</strong> ${input.size ?? '—'}</p>
    <p><strong>Submitted at:</strong> ${new Date().toISOString()}</p>
  `;

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo: input.email,
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('Username and Password not accepted') || err?.responseCode === 535) {
      throw new AppError(
        'Waitlist email login failed. Use an SMTP app password for the configured account.',
        502
      );
    }
    throw err;
  }
}

async function sendViaFormspree(input: CreateWaitlistSignupInput): Promise<void> {
  const endpoint = optionalWaitlistEnv('WAITLIST_FORMSPREE_ENDPOINT');
  if (!endpoint) return;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      name: input.name ?? '',
      company: input.company ?? '',
      role: input.role ?? '',
      size: input.size ?? '',
      source: 'Curtain Early Access Form',
      submitted_at: new Date().toISOString(),
      _subject: `New Early Access signup: ${input.email}`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(
      `Formspree submission failed (${res.status}): ${body || 'empty response'}`,
      502
    );
  }
}

export async function sendWaitlistSignupEmail(input: CreateWaitlistSignupInput): Promise<void> {
  const formspreeEndpoint = optionalWaitlistEnv('WAITLIST_FORMSPREE_ENDPOINT');
  const smtpEnabled = hasSmtpConfig();
  const formspreeEnabled = Boolean(formspreeEndpoint);

  if (!smtpEnabled && !formspreeEnabled) {
    throw new AppError(
      'Waitlist notifications are not configured. Set SMTP vars and/or WAITLIST_FORMSPREE_ENDPOINT.',
      503
    );
  }

  if (smtpEnabled) {
    await sendViaSmtp(input);
  }

  if (formspreeEnabled) {
    await sendViaFormspree(input);
  }
}
