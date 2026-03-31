import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    const adminPassword = process.env.ADMIN_PASSWORD;
    const cookieName = process.env.ADMIN_AUTH_COOKIE || 'moon_admin_auth';

    if (!adminPassword) {
      return NextResponse.json(
        { error: 'Server admin password is not configured.' },
        { status: 500 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required.' },
        { status: 400 }
      );
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { error: 'Invalid password.' },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true });

    res.cookies.set({
      name: cookieName,
      value: 'authenticated',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request.' },
      { status: 400 }
    );
  }
}