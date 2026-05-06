/**
 * Export utilities for sharing and downloading battle results.
 */

import type { Battle, Round } from './battleGenerator';
import type { Bracket } from './bracketGenerator';
import type { MatchScore } from './scoreUtils';
import { buildPhase1BattlesWorkbook } from './xlsxUtils';

/**
 * Copy text to the system clipboard.
 *
 * @param text - Plain text to copy.
 * @returns Promise that resolves to true on success, false on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

/**
 * Format battles as plain text for export.
 *
 * @param battles - List of battles from the league phase.
 * @returns Formatted string with all battles, one per line.
 */
export function formatBattlesAsText(battles: Battle[]): string {
  const lines = ['=== AESSBot Battle Generator ===', '--- Fase 1: Lliga ---', ''];
  battles.forEach((b, i) => {
    const tag = b.repeated ? ' [REPETIT]' : '';
    lines.push(`Combat ${i + 1}: ${b.teamA}  vs  ${b.teamB}${tag}`);
  });
  return lines.join('\n');
}

/**
 * Format the full bracket as plain text.
 *
 * @param bracket - Knockout bracket object.
 * @returns Formatted string with the bracket.
 */
export function formatBracketAsText(bracket: Bracket): string {
  const lines = ['', '--- Fase 3: Eliminatòries ---', ''];
  const allMatches = [
    ...bracket.quarterfinals,
    ...bracket.semifinals,
    bracket.final,
  ];
  for (const match of allMatches) {
    lines.push(`${match.label}: ${match.seedA.name}  vs  ${match.seedB.name}`);
  }
  return lines.join('\n');
}

/**
 * Trigger a file download with the given content.
 *
 * @param content - File content as string.
 * @param filename - Suggested filename for the download.
 */
export function downloadAsText(content: string, filename = 'aessbot-combats.txt'): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}

export function downloadPhase1BattlesAsExcel(
  rounds: Round[],
  scores: Record<string, MatchScore>,
  roundsToWin: number,
  filename = 'aessbot-combats.xlsx',
): void {
  const workbook = buildPhase1BattlesWorkbook(rounds, scores, roundsToWin);
  const workbookBuffer = new ArrayBuffer(workbook.byteLength);
  new Uint8Array(workbookBuffer).set(workbook);
  const blob = new Blob([workbookBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
