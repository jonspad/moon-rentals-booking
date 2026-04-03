const DEFAULT_COOKIE_NAME = 'moon_admin_auth';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  exp: number;
  iat: number;
};

function getCookieName() {
  return process.env.ADMIN_AUTH_COOKIE || DEFAULT_COOKIE_NAME;
}

function getSessionSecret() {
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';

  if (!secret) {
    throw new Error(
      'ADMIN_SESSION_SECRET or ADMIN_PASSWORD must be configured for admin auth.'
    );
  }

  return secret;
}

function toBase64Url(input: Uint8Array) {
  let binary = '';

  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function signValue(value: string) {
  const secret = getSessionSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function getAdminAuthCookieName() {
  return getCookieName();
}

export function getAdminSessionMaxAgeSeconds() {
  return SESSION_TTL_SECONDS;
}

export async function createAdminSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = toBase64Url(new TextEncoder().encode(payloadString));
  const signature = await signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined | null) {
  if (!token) {
    return false;
  }

  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = await signValue(encodedPayload);

  if (expectedSignature !== providedSignature) {
    return false;
  }

  try {
    const decodedPayload = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const payload = JSON.parse(decodedPayload) as Partial<AdminSessionPayload>;

    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
      return false;
    }

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
