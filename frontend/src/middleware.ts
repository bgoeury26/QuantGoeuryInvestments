import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtDecode } from 'jwt-decode';

const PUBLIC_PATHS  = ['/login', '/register', '/pending'];
const ADMIN_PATHS   = ['/admin'];

interface JwtPayload { sub: string; email: string; role: string; status: string; iat: number; exp: number; }

export function middleware(req: NextRequest) {
  const token    = req.cookies.get('access_token')?.value;
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  // No token → redirect to login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  try {
    const payload = jwtDecode<JwtPayload>(token);

    // Token expired
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      const res = NextResponse.redirect(url);
      res.cookies.delete('access_token');
      return res;
    }

    // User is PENDING → force to /pending page
    if (payload.status === 'PENDING' && !pathname.startsWith('/pending')) {
      const url = req.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }

    // User is REJECTED → force to login with message
    if (payload.status === 'REJECTED' && !pathname.startsWith('/login')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('rejected', '1');
      const res = NextResponse.redirect(url);
      res.cookies.delete('access_token');
      return res;
    }

    // Admin-only paths
    if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && payload.role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

  } catch {
    // Invalid token
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    const res = NextResponse.redirect(url);
    res.cookies.delete('access_token');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
