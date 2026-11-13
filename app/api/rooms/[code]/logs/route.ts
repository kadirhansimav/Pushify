import { NextResponse } from 'next/server';
import { addLog } from '@/lib/rooms';
import { handleError, readJson, requireParticipant } from '@/lib/http';

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const me = await requireParticipant(code);
    const result = await addLog(code, me, await readJson(req));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
