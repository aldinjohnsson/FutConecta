/** Centavos -> "R$ 150,00" */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "150", "150,5", "1.500,00" -> centavos. Retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[R$\s]/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

/** "25/12/1995" -> "1995-12-25". Retorna null se inválida. */
export function parseBRDate(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** "1995-12-25" -> "25/12/1995" */
export function formatBRDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function isAdult(isoBirthDate: string, today = new Date()): boolean {
  const [y, m, d] = isoBirthDate.split('-').map(Number);
  const eighteen = new Date(y + 18, m - 1, d);
  return eighteen <= today;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

/** "20:00:00" -> "20:00" */
export function shortTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * Quanto a quadra recebe por um pagamento feito pelo app.
 * absorb: a comissão sai do valor; pass_to_player: o jogador paga a mais e a quadra recebe o valor cheio.
 * (Não inclui a taxa do gateway, que será descontada quando o Asaas for integrado.)
 */
export function courtNetCents(priceCents: number, mode: 'absorb' | 'pass_to_player', commissionBps: number): number {
  if (mode === 'pass_to_player') return priceCents;
  return priceCents - Math.round((priceCents * commissionBps) / 10000);
}

/** Quanto o jogador paga pelo app, dado o valor base que a quadra recebe (espelha compute_item_price). */
export function playerPaysCents(baseCents: number, mode: 'absorb' | 'pass_to_player', commissionBps: number): number {
  if (baseCents === 0) return 0;
  if (mode === 'pass_to_player') return Math.ceil((baseCents * 10000) / (10000 - commissionBps));
  return baseCents;
}

/** "2026-11-05" + "20:00:00" -> "Qui 05/11 · 20:00" */
export function formatSlotWhen(date: string, start: string, weekdays: string[]): string {
  const dow = new Date(`${date}T12:00:00`).getDay();
  const [, m, d] = date.split('-');
  return `${weekdays[dow]} ${d}/${m} · ${start.slice(0, 5)}`;
}
