import { NextResponse } from 'next/server';
import { getRoomState } from '@/lib/rooms';
import { currentParticipant, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const state = await getRoomState(code, await currentParticipant(code));
    if (!state) return NextResponse.json({ error: 'Oda bulunamadı.' }, { status: 404 });
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleError(err);
  }
}
