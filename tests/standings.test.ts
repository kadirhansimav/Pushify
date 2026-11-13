import { describe, expect, it } from 'vitest';
import { computeStanding, qualifies, rankStandings } from '../lib/standings';

const goals = [
  { id: 1, target: 10000 },
  { id: 2, target: 1_000_000 },
  { id: 3, target: 473546 },
];

describe('qualifies', () => {
  it('"all" kuralında tüm hedefler gerekir', () => {
    expect(qualifies(goals, { 1: 10000, 2: 1_000_000 }, 'all')).toBe(false);
    expect(qualifies(goals, { 1: 10000, 2: 1_000_000, 3: 473546 }, 'all')).toBe(true);
  });
  it('"any" kuralında bir hedef yeter', () => {
    expect(qualifies(goals, { 1: 9999 }, 'any')).toBe(false);
    expect(qualifies(goals, { 1: 10000 }, 'any')).toBe(true);
  });
  it('ondalıklı toplamlarda yuvarlama hatasını tolere eder', () => {
    expect(qualifies([{ id: 1, target: 0.3 }], { 1: 0.1 + 0.2 }, 'all')).toBe(true);
  });
  it('hedefsiz oda kimseyi kazandırmaz', () => {
    expect(qualifies([], {}, 'any')).toBe(false);
  });
});

describe('computeStanding / rankStandings', () => {
  it('ilerlemeyi hedef başına %100 ile sınırlar', () => {
    const s = computeStanding('a', goals, { 1: 20000 }, 'all');
    expect(s.completedGoals).toBe(1);
    expect(s.progress).toBeCloseTo(1 / 3);
  });
  it('kazananı en üste, sonra tamamlanan hedefe ve ilerlemeye göre sıralar', () => {
    const a = computeStanding('a', goals, { 1: 5000 }, 'all', 1);
    const b = computeStanding('b', goals, { 1: 10000 }, 'all', 2);
    const c = computeStanding('c', goals, { 1: 9000, 2: 900_000 }, 'all', 3);
    expect(rankStandings([a, b, c], null).map((s) => s.participantId)).toEqual(['b', 'c', 'a']);
    expect(rankStandings([a, b, c], 'a').map((s) => s.participantId)).toEqual(['a', 'b', 'c']);
  });
});
