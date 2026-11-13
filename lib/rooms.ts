import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDb, type Queryable } from './db';
import { computeStanding, qualifies, rankStandings, type Totals, type WinRule } from './standings';
import { InputError, cleanText, goalsInput, LIMITS, positiveNumber, winRule } from './validate';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newRoomCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function cookieName(code: string): string {
  return `pf_${normalizeCode(code)}`;
}

type RoomRow = {
  code: string;
  name: string;
  win_rule: WinRule;
  status: 'active' | 'finished';
  winner_id: string | null;
  finished_at: string | Date | null;
  created_at: string | Date;
};
type GoalRow = { id: number; title: string; unit: string; target: number; sort: number };
type ParticipantRow = {
  id: string;
  name: string;
  stake: string;
  is_creator: boolean;
  joined_at: string | Date;
};

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

async function insertParticipant(
  q: Queryable,
  code: string,
  name: string,
  stake: string,
  isCreator: boolean,
): Promise<{ id: string; token: string }> {
  const id = randomUUID();
  const token = randomBytes(24).toString('base64url');
  try {
    await q.query(
      `INSERT INTO participants (id, room_code, name, stake, token_hash, is_creator) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, code, name, stake, hashToken(token), isCreator],
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new InputError('Bu isimle odada zaten biri var, başka bir isim seç.', 409);
    throw err;
  }
  return { id, token };
}

export async function createRoom(body: Record<string, unknown>) {
  const name = cleanText(body.name, 'Oda adı', LIMITS.roomName);
  const rule = winRule(body.winRule);
  const goals = goalsInput(body.goals);
  const creatorName = cleanText(body.creatorName, 'İsmin', LIMITS.personName);
  const stake = cleanText(body.stake, 'İddian', LIMITS.stake);

  const db = await getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    try {
      return await db.transaction(async (q) => {
        await q.query(`INSERT INTO rooms (code, name, win_rule) VALUES ($1,$2,$3)`, [code, name, rule]);
        for (let i = 0; i < goals.length; i++) {
          const g = goals[i];
          await q.query(`INSERT INTO goals (room_code, title, unit, target, sort) VALUES ($1,$2,$3,$4,$5)`, [
            code,
            g.title,
            g.unit,
            g.target,
            i,
          ]);
        }
        const p = await insertParticipant(q, code, creatorName, stake, true);
        return { code, token: p.token };
      });
    } catch (err) {
      if (isUniqueViolation(err) && !(err instanceof InputError)) continue; // oda kodu çakıştı
      throw err;
    }
  }
  throw new Error('Oda kodu üretilemedi');
}

async function lockActiveRoom(q: Queryable, code: string): Promise<RoomRow> {
  const { rows } = await q.query<RoomRow>(`SELECT * FROM rooms WHERE code = $1 FOR UPDATE`, [code]);
  const room = rows[0];
  if (!room) throw new InputError('Oda bulunamadı.', 404);
  if (room.status !== 'active') throw new InputError('Bu oda bitti, kazanan belli oldu.', 409);
  return room;
}

export async function joinRoom(rawCode: string, body: Record<string, unknown>) {
  const code = normalizeCode(rawCode);
  const name = cleanText(body.name, 'İsmin', LIMITS.personName);
  const stake = cleanText(body.stake, 'İddian', LIMITS.stake);
  const db = await getDb();
  return db.transaction(async (q) => {
    await lockActiveRoom(q, code);
    return insertParticipant(q, code, name, stake, false);
  });
}

export async function participantByToken(rawCode: string, token: string | undefined) {
  if (!token) return null;
  const db = await getDb();
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM participants WHERE room_code = $1 AND token_hash = $2`,
    [normalizeCode(rawCode), hashToken(token)],
  );
  return rows[0]?.id ?? null;
}

async function totalsFor(q: Queryable, participantId: string): Promise<Totals> {
  const { rows } = await q.query<{ goal_id: number; total: number }>(
    `SELECT goal_id, SUM(amount)::float8 AS total FROM logs WHERE participant_id = $1 GROUP BY goal_id`,
    [participantId],
  );
  return Object.fromEntries(rows.map((r) => [Number(r.goal_id), Number(r.total)]));
}

export async function addLog(rawCode: string, participantId: string, body: Record<string, unknown>) {
  const code = normalizeCode(rawCode);
  const goalId = Number(body.goalId);
  const amount = positiveNumber(body.amount, 'Miktar', LIMITS.maxAmount);
  const db = await getDb();
  return db.transaction(async (q) => {
    const room = await lockActiveRoom(q, code);
    const { rows: goals } = await q.query<GoalRow>(`SELECT * FROM goals WHERE room_code = $1`, [code]);
    if (!goals.some((g) => g.id === goalId)) throw new InputError('Hedef bulunamadı.');
    await q.query(`INSERT INTO logs (participant_id, goal_id, amount) VALUES ($1,$2,$3)`, [
      participantId,
      goalId,
      amount,
    ]);
    const totals = await totalsFor(q, participantId);
    const won = qualifies(
      goals.map((g) => ({ id: g.id, target: Number(g.target) })),
      totals,
      room.win_rule,
    );
    if (won) {
      // Oda satırı kilitli olduğu için aynı anda iki kişi kazanamaz: ilk commit eden kazanır.
      await q.query(`UPDATE rooms SET status = 'finished', winner_id = $2, finished_at = now() WHERE code = $1`, [
        code,
        participantId,
      ]);
    }
    return { won };
  });
}

export async function deleteLog(rawCode: string, participantId: string, logId: number) {
  const code = normalizeCode(rawCode);
  const db = await getDb();
  return db.transaction(async (q) => {
    await lockActiveRoom(q, code);
    const { rows } = await q.query<{ id: number }>(
      `DELETE FROM logs WHERE id = $1 AND participant_id = $2 RETURNING id`,
      [logId, participantId],
    );
    if (!rows[0]) throw new InputError('Kayıt bulunamadı.', 404);
  });
}

const iso = (d: string | Date | null) => (d === null ? null : new Date(d).toISOString());

export async function getRoomState(rawCode: string, meId: string | null) {
  const code = normalizeCode(rawCode);
  const db = await getDb();
  const { rows: roomRows } = await db.query<RoomRow>(`SELECT * FROM rooms WHERE code = $1`, [code]);
  const room = roomRows[0];
  if (!room) return null;

  const [{ rows: goals }, { rows: people }, { rows: sums }, { rows: recent }] = await Promise.all([
    db.query<GoalRow>(`SELECT id, title, unit, target, sort FROM goals WHERE room_code = $1 ORDER BY sort, id`, [code]),
    db.query<ParticipantRow>(
      `SELECT id, name, stake, is_creator, joined_at FROM participants WHERE room_code = $1 ORDER BY joined_at`,
      [code],
    ),
    db.query<{ participant_id: string; goal_id: number; total: number; last_at: string | Date }>(
      `SELECT l.participant_id, l.goal_id, SUM(l.amount)::float8 AS total, MAX(l.created_at) AS last_at
         FROM logs l JOIN participants p ON p.id = l.participant_id
        WHERE p.room_code = $1 GROUP BY l.participant_id, l.goal_id`,
      [code],
    ),
    db.query<{ id: number; participant_id: string; goal_id: number; amount: number; created_at: string | Date }>(
      `SELECT l.id, l.participant_id, l.goal_id, l.amount, l.created_at
         FROM logs l JOIN participants p ON p.id = l.participant_id
        WHERE p.room_code = $1 ORDER BY l.created_at DESC, l.id DESC LIMIT 40`,
      [code],
    ),
  ]);

  const goalLite = goals.map((g) => ({ id: Number(g.id), target: Number(g.target) }));
  const totalsBy = new Map<string, Totals>();
  const lastBy = new Map<string, number>();
  for (const s of sums) {
    const t = totalsBy.get(s.participant_id) ?? {};
    t[Number(s.goal_id)] = Number(s.total);
    totalsBy.set(s.participant_id, t);
    const at = new Date(s.last_at).getTime();
    lastBy.set(s.participant_id, Math.max(lastBy.get(s.participant_id) ?? 0, at));
  }
  const ranked = rankStandings(
    people.map((p) =>
      computeStanding(p.id, goalLite, totalsBy.get(p.id) ?? {}, room.win_rule, lastBy.get(p.id) ?? null),
    ),
    room.winner_id,
  );
  const byId = new Map(people.map((p) => [p.id, p]));

  return {
    room: {
      code: room.code,
      name: room.name,
      winRule: room.win_rule,
      status: room.status,
      winnerId: room.winner_id,
      finishedAt: iso(room.finished_at),
      createdAt: iso(room.created_at),
    },
    goals: goals.map((g) => ({ id: Number(g.id), title: g.title, unit: g.unit, target: Number(g.target) })),
    participants: ranked.map((s, i) => {
      const p = byId.get(s.participantId)!;
      return {
        id: p.id,
        name: p.name,
        stake: p.stake,
        isCreator: p.is_creator,
        rank: i + 1,
        totals: s.totals,
        completedGoals: s.completedGoals,
        progress: s.progress,
      };
    }),
    recent: recent.map((r) => ({
      id: Number(r.id),
      participantId: r.participant_id,
      goalId: Number(r.goal_id),
      amount: Number(r.amount),
      createdAt: iso(r.created_at),
    })),
    meId,
  };
}

export type RoomState = NonNullable<Awaited<ReturnType<typeof getRoomState>>>;
