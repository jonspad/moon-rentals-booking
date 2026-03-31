import { NextResponse } from 'next/server';

export async function POST() {
  const cookieName = process.env.ADMIN_AUTH_COOKIE || 'moon_admin_auth';

  const res = NextResponse.json({ success: true });

  res.cookies.set({
    name: cookieName,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return res;
}