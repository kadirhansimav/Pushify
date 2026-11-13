import Link from 'next/link';
import JoinByCode from './JoinByCode';

export default function Home() {
  return (
    <main className="stack" style={{ gap: 20 }}>
      <div className="brand">Push<span>ify</span></div>
      <section className="hero stack">
        <h1>
          Hedefi koy, iddiaya gir, <em>ilk bitiren kazansın.</em>
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          10.000 şınav, 1.000.000 adım, 500 km yürüyüş… Bir oda kur, arkadaşlarını davet et. Herkes neye iddiaya
          girdiğini yazar, yaptıkça girer. Hedefe ilk ulaşan bütün iddiaları kazanır.
        </p>
      </section>
      <Link href="/new" className="btn btn-block">
        Oda kur
      </Link>
      <div className="card stack">
        <h2>Bir odaya katıl</h2>
        <JoinByCode />
      </div>
    </main>
  );
}
