import type { WinRule } from './standings';

export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const LIMITS = {
  roomName: 60,
  personName: 30,
  stake: 120,
  goalTitle: 40,
  unit: 15,
  maxGoals: 10,
  maxTarget: 1e12,
  maxAmount: 1e9,
};

export function cleanText(value: unknown, field: string, max: number, required = true): string {
  const s = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (required && !s) throw new InputError(`${field} boş olamaz.`);
  if (s.length > max) throw new InputError(`${field} en fazla ${max} karakter olabilir.`);
  return s;
}

export function positiveNumber(value: unknown, field: string, max: number): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new InputError(`${field} sıfırdan büyük bir sayı olmalı.`);
  if (n > max) throw new InputError(`${field} çok büyük.`);
  return Math.round(n * 1000) / 1000;
}

export function winRule(value: unknown): WinRule {
  return value === 'any' ? 'any' : 'all';
}

export type GoalInput = { title: string; unit: string; target: number };

export function goalsInput(value: unknown): GoalInput[] {
  if (!Array.isArray(value) || value.length === 0) throw new InputError('En az bir hedef ekle.');
  if (value.length > LIMITS.maxGoals) throw new InputError(`En fazla ${LIMITS.maxGoals} hedef ekleyebilirsin.`);
  return value.map((g, i) => {
    const o = (g ?? {}) as Record<string, unknown>;
    return {
      title: cleanText(o.title, `${i + 1}. hedefin adı`, LIMITS.goalTitle),
      unit: cleanText(o.unit, `${i + 1}. hedefin birimi`, LIMITS.unit),
      target: positiveNumber(o.target, `${i + 1}. hedefin hedef değeri`, LIMITS.maxTarget),
    };
  });
}
