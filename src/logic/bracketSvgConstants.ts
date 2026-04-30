export interface ResolvedMatch {
  id?: string;
  label: string;
  seedA: { seed: number; name: string };
  seedB: { seed: number; name: string };
  score?: { teamA: number; teamB: number };
}

export interface ResolvedBracket {
  quarterfinals: ResolvedMatch[];
  semifinals: ResolvedMatch[];
  final: ResolvedMatch;
}

export const CW = 180;
export const CH = 94;
export const COL_GAP = 56;
export const ROW_GAP = 160;
export const PAD = 14;

export const QF_LX = PAD;
export const SF_LX = QF_LX + CW + COL_GAP;
export const FIN_X = SF_LX + CW + COL_GAP;
export const SF_RX = FIN_X + CW + COL_GAP;
export const QF_RX = SF_RX + CW + COL_GAP;

export const QF1_Y = 28;
export const QF2_Y = QF1_Y + CH + ROW_GAP;
export const QF1_CY = QF1_Y + CH / 2;
export const QF2_CY = QF2_Y + CH / 2;
export const SF_CY = (QF1_CY + QF2_CY) / 2;
export const SF_Y = SF_CY - CH / 2;

export const SVG_W = QF_RX + CW + PAD;
export const SVG_H = QF2_Y + CH + 20;

export const JUNC_L = QF_LX + CW + COL_GAP / 2;
export const JUNC_R = QF_RX - COL_GAP / 2;
