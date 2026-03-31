import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow the login page and login API
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/api/admin/login')
  ) {
    return NextResponse.next();
  }

  const cookieName = process.env.ADMIN_AUTH_COOKIE || 'moon_admin_auth';
  const authCookie = req.cookies.get(cookieName)?.value;

  if (authCookie === 'authenticated') {
    return NextResponse.next();
  }

  const loginUrl = new URL('/admin/login', req.url);
  loginUrl.searchParams.set('from', pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};