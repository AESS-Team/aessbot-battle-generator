import type { Round } from './battleGenerator';
import {
  getRoundCount,
  getScoreTotals,
  getWinner,
  isScoreComplete,
  type MatchScore,
} from './scoreUtils';

type CellValue = string | number | null;

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();
const DOS_TIME = 0;
const DOS_DATE = 33;

export function buildPhase1BattlesWorkbook(
  rounds: Round[],
  scores: Record<string, MatchScore>,
  roundsToWin: number,
): Uint8Array {
  const roundCount = getRoundCount(roundsToWin);
  const headers = [
    'Jornada',
    'Combat',
    'Equip A',
    'Equip B',
    ...Array.from({ length: roundCount }, (_, index) => `R${index + 1}`),
    'Punts A',
    'Punts B',
    'Guanyador',
    'Estat',
  ];

  const rows: CellValue[][] = [headers];

  for (const round of rounds) {
    round.battles.forEach((battle, battleIndex) => {
      const score = scores[battle.id];
      const totals = getScoreTotals(score, roundCount);
      const completed = isScoreComplete(score, roundsToWin);
      rows.push([
        round.number,
        battleIndex + 1,
        battle.teamA,
        battle.teamB,
        ...Array.from({ length: roundCount }, (_, roundIndex) => {
          const winnerSide = score?.rounds?.[roundIndex];
          if (winnerSide === 'teamA') return battle.teamA;
          if (winnerSide === 'teamB') return battle.teamB;
          return null;
        }),
        totals.teamA,
        totals.teamB,
        completed ? getWinner(battle.teamA, battle.teamB, score, roundsToWin) ?? '' : '',
        completed ? 'Completat' : 'Pendent',
      ]);
    });
  }

  return buildXlsxWorkbook('Combats', rows);
}

export function buildXlsxWorkbook(sheetName: string, rows: CellValue[][]): Uint8Array {
  return zipEntries([
    { path: '[Content_Types].xml', data: textFile(buildContentTypesXml()) },
    { path: '_rels/.rels', data: textFile(buildRootRelationshipsXml()) },
    { path: 'docProps/app.xml', data: textFile(buildAppPropertiesXml(sheetName)) },
    { path: 'docProps/core.xml', data: textFile(buildCorePropertiesXml()) },
    { path: 'xl/workbook.xml', data: textFile(buildWorkbookXml(sheetName)) },
    { path: 'xl/_rels/workbook.xml.rels', data: textFile(buildWorkbookRelationshipsXml()) },
    { path: 'xl/styles.xml', data: textFile(buildStylesXml()) },
    { path: 'xl/worksheets/sheet1.xml', data: textFile(buildWorksheetXml(rows)) },
  ]);
}

function textFile(text: string): Uint8Array {
  return encoder.encode(text);
}

function buildContentTypesXml(): string {
  return xmlDeclaration() +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>';
}

function buildRootRelationshipsXml(): string {
  return xmlDeclaration() +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';
}

function buildWorkbookRelationshipsXml(): string {
  return xmlDeclaration() +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
}

function buildWorkbookXml(sheetName: string): string {
  return xmlDeclaration() +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    `<sheet name="${escapeAttribute(sanitizeSheetName(sheetName))}" sheetId="1" r:id="rId1"/>` +
    '</sheets>' +
    '</workbook>';
}

function buildAppPropertiesXml(sheetName: string): string {
  return xmlDeclaration() +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>AESSBot Battle Generator</Application>' +
    '<TitlesOfParts><vt:vector size="1" baseType="lpstr">' +
    `<vt:lpstr>${escapeXml(sanitizeSheetName(sheetName))}</vt:lpstr>` +
    '</vt:vector></TitlesOfParts>' +
    '</Properties>';
}

function buildCorePropertiesXml(): string {
  const now = new Date().toISOString();
  return xmlDeclaration() +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>AESSBot combats</dc:title>' +
    '<dc:creator>AESSBot Battle Generator</dc:creator>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>';
}

function buildStylesXml(): string {
  return xmlDeclaration() +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

function buildWorksheetXml(rows: CellValue[][]): string {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const sheetRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = Array.from({ length: columnCount }, (_, colIndex) => (
      buildCellXml(row[colIndex] ?? null, rowNumber, colIndex, rowIndex === 0)
    )).join('');
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join('');

  return xmlDeclaration() +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:${columnName(columnCount - 1)}${Math.max(rows.length, 1)}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    buildColumnsXml(columnCount) +
    '<sheetData>' +
    sheetRows +
    '</sheetData>' +
    `<autoFilter ref="A1:${columnName(columnCount - 1)}${Math.max(rows.length, 1)}"/>` +
    '</worksheet>';
}

function buildColumnsXml(columnCount: number): string {
  return '<cols>' +
    Array.from({ length: columnCount }, (_, index) => {
      const width = index === 0 || index === 1 ? 10 : index === 2 || index === 3 ? 24 : 16;
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    }).join('') +
    '</cols>';
}

function buildCellXml(value: CellValue, rowNumber: number, colIndex: number, isHeader: boolean): string {
  const ref = `${columnName(colIndex)}${rowNumber}`;
  const style = isHeader ? ' s="1"' : '';

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }

  const text = value === null ? '' : String(value);
  const space = text.trim() !== text ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" t="inlineStr"${style}><is><t${space}>${escapeXml(text)}</t></is></c>`;
}

function zipEntries(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = textFile(entry.path);
    const crc = crc32(entry.data);
    const localHeader = new Uint8Array(30 + name.length);
    const local = new DataView(localHeader.buffer);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.data.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, name.length, true);
    localHeader.set(name, 30);

    localParts.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + name.length);
    const central = new DataView(centralHeader.buffer);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, DOS_TIME, true);
    central.setUint16(14, DOS_DATE, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, entry.data.length, true);
    central.setUint32(24, entry.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + entry.data.length;
  }

  const centralSize = sumLengths(centralParts);
  const centralOffset = offset;
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);

  return concatBytes([...localParts, ...centralParts, end]);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(sumLengths(parts));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function sumLengths(parts: Uint8Array[]): number {
  return parts.reduce((total, part) => total + part.length, 0);
}

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function sanitizeSheetName(name: string): string {
  const safe = name.replace(/[:\\/?*[\]]/g, ' ').trim() || 'Sheet1';
  return safe.slice(0, 31);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeXml(value).replace(/"/g, '&quot;');
}

function xmlDeclaration(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
}
