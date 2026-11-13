'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 6) router.push(`/r/${clean}`);
      }}
    >
      <input
        className="grow code"
        placeholder="ODA KODU"
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        inputMode="text"
        aria-label="Oda kodu"
      />
      <button type="submit" disabled={clean.length !== 6}>
        Git
      </button>
    </form>
  );
}
