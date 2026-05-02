import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login'];
const TOKEN_ROUTES = ['/join'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Pas connecté + route protégée → login
  if (
    !user &&
    !PUBLIC_ROUTES.some(r => path.startsWith(r)) &&
    !TOKEN_ROUTES.some(r => path.startsWith(r))
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Connecté + page login → redirection selon rôle
  if (user && path === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role === 'SOUMIS') {
      return NextResponse.redirect(new URL('/explore', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Soumis essaie d'accéder au dashboard → explore
  if (user && path.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role === 'SOUMIS') {
      return NextResponse.redirect(new URL('/explore', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
