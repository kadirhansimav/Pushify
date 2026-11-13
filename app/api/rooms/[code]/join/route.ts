import { NextResponse } from 'next/server';
import { joinRoom, normalizeCode } from '@/lib/rooms';
import { currentParticipant, handleError, readJson, setPlayerCookie } from '@/lib/http';
import { InputError } from '@/lib/validate';

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    if (await currentParticipant(code)) throw new InputError('Bu odaya zaten katıldın.', 409);
    const { id, token } = await joinRoom(code, await readJson(req));
    const res = NextResponse.json({ id }, { status: 201 });
    setPlayerCookie(res, normalizeCode(code), token);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
