import { NextResponse } from 'next/server';
import { deleteLog } from '@/lib/rooms';
import { handleError, requireParticipant } from '@/lib/http';
import { InputError } from '@/lib/validate';

export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  try {
    const { code, id } = await params;
    const me = await requireParticipant(code);
    const logId = Number(id);
    if (!Number.isInteger(logId)) throw new InputError('Kayıt bulunamadı.', 404);
    await deleteLog(code, me, logId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
