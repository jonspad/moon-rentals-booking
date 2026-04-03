import { NextResponse } from 'next/server';
import { getAdminAuthCookieName } from '@/lib/adminAuth';

export async function POST() {
  const cookieName = getAdminAuthCookieName();
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
