import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cookieName, participantByToken } from './rooms';
import { InputError } from './validate';

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function handleError(err: unknown) {
  if (err instanceof InputError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  return NextResponse.json({ error: 'Bir şeyler ters gitti, tekrar dene.' }, { status: 500 });
}

export function setPlayerCookie(res: NextResponse, code: string, token: string) {
  res.cookies.set(cookieName(code), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function currentParticipant(code: string): Promise<string | null> {
  const jar = await cookies();
  return participantByToken(code, jar.get(cookieName(code))?.value);
}

export async function requireParticipant(code: string): Promise<string> {
  const id = await currentParticipant(code);
  if (!id) throw new InputError('Önce odaya katılmalısın.', 401);
  return id;
}
