// Saf (DB'siz) sıralama ve kazanma mantığı. Testler bunu doğrudan kullanır.

export type WinRule = 'all' | 'any';

export type GoalLite = { id: number; target: number };

export type Totals = Record<number, number>; // goalId -> toplam

export type Standing = {
  participantId: string;
  totals: Totals;
  completedGoals: number;
  /** 0..1 arası, her hedefin (en fazla %100) ortalaması */
  progress: number;
  /** Seçilen kurala göre kazanma şartını sağlıyor mu */
  qualifies: boolean;
  lastLogAt: number | null;
};

export function goalReached(total: number, target: number): boolean {
  // Ondalıklı km girişlerinde yuvarlama hatası yüzünden kaçırmamak için küçük tolerans
  return total + 1e-9 >= target;
}

export function qualifies(goals: GoalLite[], totals: Totals, rule: WinRule): boolean {
  if (goals.length === 0) return false;
  const reached = goals.filter((g) => goalReached(totals[g.id] ?? 0, g.target)).length;
  return rule === 'all' ? reached === goals.length : reached > 0;
}

export function computeStanding(
  participantId: string,
  goals: GoalLite[],
  totals: Totals,
  rule: WinRule,
  lastLogAt: number | null = null,
): Standing {
  let completed = 0;
  let sum = 0;
  for (const g of goals) {
    const t = totals[g.id] ?? 0;
    if (goalReached(t, g.target)) completed++;
    sum += Math.min(t / g.target, 1);
  }
  return {
    participantId,
    totals,
    completedGoals: completed,
    progress: goals.length ? sum / goals.length : 0,
    qualifies: qualifies(goals, totals, rule),
    lastLogAt,
  };
}

/** Kazanan en üstte; sonra tamamlanan hedef sayısı, sonra genel ilerleme, eşitlikte önce ilerleyen. */
export function rankStandings(standings: Standing[], winnerId: string | null): Standing[] {
  return [...standings].sort((a, b) => {
    if (winnerId) {
      if (a.participantId === winnerId) return -1;
      if (b.participantId === winnerId) return 1;
    }
    if (b.completedGoals !== a.completedGoals) return b.completedGoals - a.completedGoals;
    if (Math.abs(b.progress - a.progress) > 1e-12) return b.progress - a.progress;
    return (a.lastLogAt ?? Infinity) - (b.lastLogAt ?? Infinity);
  });
}
