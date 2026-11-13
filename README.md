# Pushify

Arkadaşlarınla iddialı spor yarışları. Bir oda kur, hedefleri koy (ör. 10.000 şınav, 1.000.000 adım, 500 km yürüyüş),
arkadaşlarını davet et. Herkes neye iddiaya girdiğini yazar ve yaptıkça girer. Hedefe ilk ulaşan kazanır, ödül havuzundaki
tüm iddialar onun olur. Mobil öncelikli web sitesi.

## Özellikler

- **Oda kurma:** isim, 1–10 hedef (hazır şablonlar veya özel hedef/birim), kazanma kuralı.
- **Kazanma kuralı:** "tüm hedefleri ilk bitiren" (varsayılan) veya "herhangi bir hedefi ilk bitiren".
  Kazanan belli olunca oda kapanır, yeni kayıt kabul edilmez. Oda satırı kilitlenerek kontrol edildiği için iki kişi aynı anda kazanamaz.
- **Katılım:** şifre yok. 6 haneli oda kodu veya davet linki ile isim + iddia yazıp katılırsın. Kimlik, cihazdaki httpOnly çerezle tutulur.
- **İlerleme:** hızlı ekleme butonları (+10/+50/+100 vb.) veya serbest miktar (ondalık km desteklenir). Yanlış girişi "Geri al" ile silebilirsin.
- **Ödül havuzu, sıralama ve son hareketler** her 4 saniyede güncellenir.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # kazanma/sıralama mantığı testleri
```

`DATABASE_URL` boşsa veriler `.data/pglite` altındaki gömülü Postgres'te (PGlite) tutulur, ek kurulum gerekmez.

## Yayına alma (Vercel)

1. Depoyu Vercel'e bağla.
2. Bir Postgres veritabanı ekle (Vercel Marketplace'ten Neon, ya da Supabase) ve `DATABASE_URL` ortam değişkenini ayarla.
3. Deploy et. Tablolar ilk istekte otomatik oluşturulur.

## Yapı

- `lib/standings.ts` – kazanma kuralı ve sıralama (saf fonksiyonlar, testli)
- `lib/rooms.ts` – oda / katılım / kayıt işlemleri
- `lib/db.ts` – Postgres (`pg`) veya PGlite bağlantısı ve şema
- `app/api/rooms/...` – JSON API
- `app/new`, `app/r/[code]` – oda kurma ve oda ekranı
