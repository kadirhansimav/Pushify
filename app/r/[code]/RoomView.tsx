'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomState } from '@/lib/rooms';
import { fmt, timeAgo } from '@/lib/format';

type Goal = RoomState['goals'][number];

function quickAmounts(target: number): number[] {
  if (target >= 100_000) return [1000, 5000, 10000];
  if (target >= 1_000) return [10, 50, 100];
  if (target >= 100) return [1, 5, 10];
  return [0.5, 1, 5];
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Bir hata oluştu.'), { status: res.status });
  return data as T;
}

export default function RoomView({ code }: { code: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setState(await api<RoomState>(`/api/rooms/${code}`));
      setLoadError('');
    } catch (err) {
      if ((err as { status?: number }).status === 404) setNotFound(true);
      else setLoadError('Bağlantı sorunu, yeniden deneniyor…');
    }
  }, [code]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 4000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  if (notFound) {
    return (
      <main className="stack">
        <Link href="/" className="brand">
          Push<span>ify</span>
        </Link>
        <div className="card stack">
          <h2>Oda bulunamadı</h2>
          <p className="muted" style={{ margin: 0 }}>
            <span className="code">{code}</span> kodlu bir oda yok. Kodu kontrol et.
          </p>
          <Link href="/" className="btn btn-ghost">
            Ana sayfa
          </Link>
        </div>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="stack">
        <div className="brand">
          Push<span>ify</span>
        </div>
        <p className="muted">{loadError || 'Oda yükleniyor…'}</p>
      </main>
    );
  }

  const { room, goals, participants, recent, meId } = state;
  const me = participants.find((p) => p.id === meId) ?? null;
  const winner = participants.find((p) => p.id === room.winnerId) ?? null;
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? '?';
  const goalOf = (id: number) => goals.find((g) => g.id === id);
  const active = room.status === 'active';

  async function share() {
    const url = `${location.origin}/r/${room.code}`;
    const text = `${room.name} odasına gel, iddiaya girelim! Oda kodu: ${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pushify', text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Davet linki kopyalandı');
    } catch {
      /* paylaşım iptal edildi */
    }
  }

  return (
    <main className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <Link href="/" className="brand">
          Push<span>ify</span>
        </Link>
        <button className="btn-ghost btn-small" onClick={share}>
          Davet et
        </button>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <h1>{room.name}</h1>
        <div className="row wrap">
          <span className="chip">
            Kod <span className="code">{room.code}</span>
          </span>
          <span className="chip">{room.winRule === 'all' ? 'Tüm hedefleri ilk bitiren kazanır' : 'Bir hedefi ilk bitiren kazanır'}</span>
          <span className="chip">{participants.length} kişi</span>
        </div>
      </div>

      {winner && (
        <div className="card winner stack">
          <div style={{ fontSize: 40 }}>🏆</div>
          <h2>{winner.id === meId ? 'Kazandın!' : `${winner.name} kazandı!`}</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {timeAgo(room.finishedAt)} hedefe ulaştı. Ödül havuzundaki tüm iddialar {winner.id === meId ? 'senin' : 'onun'}.
          </p>
        </div>
      )}

      {!me && active && <JoinCard code={room.code} onJoined={load} />}
      {me && active && <LogCard code={room.code} goals={goals} totals={me.totals} onLogged={load} toast={showToast} />}

      <section className="card stack">
        <div className="row between">
          <h2>Ödül havuzu</h2>
          <span className="muted small">{winner ? `→ ${winner.name}` : 'Kazanan hepsini alır'}</span>
        </div>
        <div>
          {participants.map((p) => (
            <div className="stake" key={p.id}>
              <span className="muted small">{p.name}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{p.stake}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>Sıralama</h2>
        {participants.map((p) => (
          <div className="card stack" key={p.id} style={{ gap: 10 }}>
            <div className="row">
              <div className={`rank ${p.rank === 1 && (winner || p.progress > 0) ? 'r1' : ''}`}>
                {p.id === room.winnerId ? '🏆' : p.rank}
              </div>
              <div className="grow">
                <div className="row" style={{ gap: 6 }}>
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</strong>
                  {p.id === meId && <span className="me-tag">SEN</span>}
                </div>
                <div className="muted small">
                  {p.completedGoals}/{goals.length} hedef · %{Math.floor(p.progress * 100)}
                </div>
              </div>
            </div>
            {goals.map((g) => {
              const total = p.totals[g.id] ?? 0;
              const pct = Math.min(total / g.target, 1);
              return (
                <div key={g.id} className="stack" style={{ gap: 4 }}>
                  <div className="row between small">
                    <span>{g.title}</span>
                    <span className="muted">
                      {fmt(total)} / {fmt(g.target)} {g.unit}
                    </span>
                  </div>
                  <div className={`bar ${pct >= 1 ? 'done' : ''}`}>
                    <i style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Son hareketler</h2>
        {recent.length === 0 && <p className="muted small" style={{ margin: 0 }}>Henüz kimse bir şey girmedi.</p>}
        <div>
          {recent.map((r) => {
            const g = goalOf(r.goalId);
            return (
              <div className="feed-item" key={r.id}>
                <span>
                  <strong>{nameOf(r.participantId)}</strong> +{fmt(r.amount)} {g?.unit}{' '}
                  <span className="muted">· {g?.title}</span>
                </span>
                <span className="row" style={{ gap: 10, flex: 'none' }}>
                  {active && r.participantId === meId && (
                    <button
                      className="link-btn"
                      onClick={async () => {
                        try {
                          await api(`/api/rooms/${room.code}/logs/${r.id}`, { method: 'DELETE' });
                          showToast('Kayıt silindi');
                          load();
                        } catch (err) {
                          showToast((err as Error).message);
                        }
                      }}
                    >
                      Geri al
                    </button>
                  )}
                  <span className="muted small">{timeAgo(r.createdAt)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function JoinCard({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState('');
  const [stake, setStake] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api(`/api/rooms/${code}/join`, { method: 'POST', body: JSON.stringify({ name, stake }) });
          onJoined();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Odaya katıl</h2>
      <div>
        <label htmlFor="jname">İsmin</label>
        <input id="jname" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Ali" />
      </div>
      <div>
        <label htmlFor="jstake">Neye iddiaya giriyorsun?</label>
        <input id="jstake" value={stake} onChange={(e) => setStake(e.target.value)} maxLength={120} placeholder="Bir hafta bulaşık" />
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Katılıyor…' : 'İddiaya gir ve katıl'}
      </button>
    </form>
  );
}

function LogCard({
  code,
  goals,
  totals,
  onLogged,
  toast,
}: {
  code: string;
  goals: Goal[];
  totals: Record<number, number>;
  onLogged: () => void;
  toast: (m: string) => void;
}) {
  const [goalId, setGoalId] = useState(goals[0]?.id);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const goal = goals.find((g) => g.id === goalId) ?? goals[0];
  if (!goal) return null;
  const remaining = Math.max(goal.target - (totals[goal.id] ?? 0), 0);

  async function send(value: string | number) {
    setBusy(true);
    try {
      const res = await api<{ won: boolean }>(`/api/rooms/${code}/logs`, {
        method: 'POST',
        body: JSON.stringify({ goalId: goal.id, amount: value }),
      });
      setAmount('');
      toast(res.won ? '🏆 Kazandın!' : `+${fmt(Number(String(value).replace(',', '.')))} ${goal.unit} eklendi`);
      onLogged();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount) send(amount);
      }}
    >
      <h2>Ne yaptın?</h2>
      {goals.length > 1 && (
        <div className="seg">
          {goals.map((g) => (
            <button type="button" key={g.id} className={g.id === goal.id ? 'on' : ''} onClick={() => setGoalId(g.id)}>
              {g.title}
            </button>
          ))}
        </div>
      )}
      <div className="muted small">
        {remaining > 0 ? `Hedefe ${fmt(remaining)} ${goal.unit} kaldı` : 'Bu hedefi tamamladın ✔'}
      </div>
      <div className="row">
        {quickAmounts(goal.target).map((q) => (
          <button type="button" key={q} className="btn-ghost grow" disabled={busy} onClick={() => send(q)}>
            +{fmt(q)}
          </button>
        ))}
      </div>
      <div className="row">
        <input
          className="grow"
          inputMode="decimal"
          placeholder={`Miktar (${goal.unit})`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Miktar"
        />
        <button type="submit" disabled={busy || !amount}>
          Ekle
        </button>
      </div>
    </form>
  );
}
