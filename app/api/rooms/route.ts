import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/rooms';
import { handleError, readJson, setPlayerCookie } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const { code, token } = await createRoom(await readJson(req));
    const res = NextResponse.json({ code }, { status: 201 });
    setPlayerCookie(res, code, token);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
