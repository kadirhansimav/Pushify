'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type GoalDraft = { title: string; unit: string; target: string };

const PRESETS: GoalDraft[] = [
  { title: 'Şınav', unit: 'tekrar', target: '10000' },
  { title: 'Adım', unit: 'adım', target: '1000000' },
  { title: 'Yürüyüş', unit: 'km', target: '500' },
  { title: 'Koşu', unit: 'km', target: '100' },
  { title: 'Mekik', unit: 'tekrar', target: '5000' },
  { title: 'Barfiks', unit: 'tekrar', target: '1000' },
  { title: 'Plank', unit: 'dakika', target: '300' },
];

export default function NewRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [goals, setGoals] = useState<GoalDraft[]>([PRESETS[0]]);
  const [winRule, setWinRule] = useState<'all' | 'any'>('all');
  const [creatorName, setCreatorName] = useState('');
  const [stake, setStake] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<GoalDraft>) =>
    setGoals((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, goals, winRule, creatorName, stake }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Oda kurulamadı.');
      router.push(`/r/${data.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const used = new Set(goals.map((g) => g.title));

  return (
    <main className="stack" style={{ gap: 16 }}>
      <Link href="/" className="brand">
        Push<span>ify</span>
      </Link>
      <h1>Oda kur</h1>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="card stack">
          <div>
            <label htmlFor="name">Oda adı</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kasım Kapışması" maxLength={60} />
          </div>
        </div>

        <div className="card stack">
          <h2>Hedefler</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Hazır hedeflerden ekle ya da kendin yaz. Hedef değerleri istediğin kadar büyük olabilir.
          </p>
          <div className="row wrap">
            {PRESETS.filter((p) => !used.has(p.title)).map((p) => (
              <button
                key={p.title}
                type="button"
                className="btn-ghost btn-small"
                disabled={goals.length >= 10}
                onClick={() => setGoals((gs) => [...gs, p])}
              >
                + {p.title}
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost btn-small"
              disabled={goals.length >= 10}
              onClick={() => setGoals((gs) => [...gs, { title: '', unit: '', target: '' }])}
            >
              + Özel
            </button>
          </div>
          {goals.map((g, i) => (
            <div className="goal-row" key={i}>
              <div>
                <label>Hedef</label>
                <input value={g.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Şınav" maxLength={40} />
              </div>
              <div>
                <label>Miktar</label>
                <input
                  value={g.target}
                  onChange={(e) => update(i, { target: e.target.value })}
                  inputMode="decimal"
                  placeholder="10000"
                />
              </div>
              <div className="unit-cell">
                <label>Birim</label>
                <input value={g.unit} onChange={(e) => update(i, { unit: e.target.value })} placeholder="tekrar" maxLength={15} />
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Hedefi sil"
                disabled={goals.length === 1}
                onClick={() => setGoals((gs) => gs.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>Kim kazanır?</h2>
          <div className="seg wrap">
            <button type="button" className={winRule === 'all' ? 'on' : ''} onClick={() => setWinRule('all')}>
              Tüm hedefleri ilk bitiren
            </button>
            <button type="button" className={winRule === 'any' ? 'on' : ''} onClick={() => setWinRule('any')}>
              Herhangi birini ilk bitiren
            </button>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {winRule === 'all'
              ? 'Bütün hedeflere ilk ulaşan kişi kazanır, oda kapanır.'
              : 'Hedeflerden herhangi birine ilk ulaşan kişi kazanır, oda kapanır.'}
          </p>
        </div>

        <div className="card stack">
          <h2>Sen</h2>
          <div>
            <label htmlFor="creator">İsmin</label>
            <input id="creator" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="Kadir" maxLength={30} />
          </div>
          <div>
            <label htmlFor="stake">Neye iddiaya giriyorsun? (kaybedersen kazanana vereceğin)</label>
            <input id="stake" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="1 döner + ayran" maxLength={120} />
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-block" disabled={busy}>
          {busy ? 'Kuruluyor…' : 'Odayı kur ve davet linkini al'}
        </button>
      </form>
    </main>
  );
}
