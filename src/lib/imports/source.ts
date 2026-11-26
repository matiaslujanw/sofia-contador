import { adaptNativeTable } from "./native";
export const IMPORT_MAX_BYTES = 3 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5_000;
const MAX_COLUMNS = 80;
const MAX_CELL_LENGTH = 2_000;
const MAX_EXPANDED_BYTES = 24 * 1024 * 1024;

export type SourceRow = {
  row: number;
  cells: string[];
  numericCells?: number[];
  invalidCells?: number[];
};

export type SourceTable = { headers: string[]; rows: SourceRow[]; source?: "arca" | "xubio"; owner_cuit?: string; direction?: "purchases" | "sales"; warnings?: string[] };

function validateTable(table: SourceTable): SourceTable {
  table = adaptNativeTable(table);
  if (table.headers.length < 2 || table.headers.every((header) => !header)) {
    throw new Error("La primera fila con datos debe contener los encabezados de la tabla.");
  }
  if (!table.rows.length) throw new Error("El archivo no contiene filas para importar.");
  if (table.rows.length > IMPORT_MAX_ROWS) {
    throw new Error("El archivo supera el máximo de 5.000 filas de datos.");
  }
  if (table.headers.length > MAX_COLUMNS || table.rows.some(({ cells }) => cells.length > table.headers.length)) {
    throw new Error("Revisá los separadores y el ancho de la tabla. Cada fila debe respetar los encabezados y se admiten hasta 80 columnas.");
  }
  if (table.headers.some((header) => header.length > MAX_CELL_LENGTH) ||
    table.rows.some(({ cells }) => cells.some((cell) => cell.length > MAX_CELL_LENGTH))) {
    throw new Error("Hay celdas de más de 2.000 caracteres.");
  }
  return table;
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hasBom = (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff);
  if (hasBom) {
    return new TextDecoder(bytes[0] === 0xff ? "utf-16le" : "utf-16be").decode(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function splitDelimited(text: string, delimiter: string, limit: number, initialLine: number): SourceRow[] {
  const records: SourceRow[] = [];
  let cells: string[] = [];
  let field = "";
  let line = initialLine;
  let startLine = initialLine;
  let quoted = false;
  let afterQuote = false;

  function pushField() {
    cells.push(field.trim());
    field = "";
    afterQuote = false;
  }

  function pushRecord() {
    pushField();
    while (cells.at(-1) === "") cells.pop();
    if (cells.length) records.push({ row: startLine, cells });
    cells = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (quoted) {
        quoted = false;
        afterQuote = true;
      } else if (!field.trim() && !afterQuote) {
        field = "";
        quoted = true;
      } else {
        throw new Error(`Hay comillas fuera de lugar en la línea ${line}.`);
      }
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      if (quoted) {
        field += "\n";
      } else {
        pushRecord();
        if (records.length >= limit) return records;
        startLine = line;
      }
    } else if (!quoted && character === delimiter) {
      pushField();
      if (cells.length > MAX_COLUMNS) throw new Error("El archivo supera el máximo de 80 columnas.");
    } else if (afterQuote && character.trim()) {
      throw new Error(`Revisá el texto después de las comillas en la línea ${line}.`);
    } else if (!afterQuote) {
      field += character;
      if (field.length > MAX_CELL_LENGTH) throw new Error(`Hay una celda demasiado larga en la línea ${line}.`);
    }
  }
  if (quoted) throw new Error(`Hay comillas sin cerrar desde la línea ${startLine}.`);
  pushRecord();
  return records;
}

function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t"].flatMap((delimiter) => {
    try {
      const [header] = splitDelimited(text, delimiter, 1, 1);
      if (!header || header.cells.length < 2) return [];
      return [{ delimiter, width: header.cells.length }];
    } catch {
      return [];
    }
  });
  candidates.sort((a, b) => b.width - a.width);
  if (!candidates[0] || candidates[0].width === candidates[1]?.width) {
    throw new Error("No se pudo reconocer el separador del CSV. Usá coma, punto y coma o tabulación.");
  }
  return candidates[0].delimiter;
}

function readCsv(buffer: ArrayBuffer): SourceTable {
  const text = decodeText(buffer);
  if (text.includes("\0")) throw new Error("El contenido no corresponde a un CSV de texto.");
  const separator = /^sep=([,;\t])(?:\r\n|\r|\n)/i.exec(text);
  const body = separator ? text.slice(separator[0].length) : text;
  const [header, ...rows] = splitDelimited(
    body,
    separator?.[1] ?? detectDelimiter(body),
    IMPORT_MAX_ROWS + 2,
    separator ? 2 : 1
  );
  return validateTable({ headers: header?.cells ?? [], rows });
}

function assertZipExtras(view: DataView, offset: number, end: number, error: string) {
  while (offset < end) {
    if (offset + 4 > end || view.getUint16(offset, true) === 1) throw new Error(error);
    offset += 4 + view.getUint16(offset + 2, true);
  }
  if (offset !== end) throw new Error(error);
}

async function assertExpandedSize(part: Uint8Array<ArrayBuffer>, expected: number, error: string) {
  try {
    const reader = new Blob([part]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > expected) {
        await reader.cancel();
        throw new Error(error);
      }
    }
    if (length !== expected) throw new Error(error);
  } catch {
    throw new Error(error);
  }
}

async function assertExcelFile(buffer: ArrayBuffer, extension: string) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (extension === "xls") {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const biff = bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1]);
    if (!biff && !ole.every((byte, index) => bytes[index] === byte)) {
      throw new Error("El contenido no corresponde a un archivo XLS de Excel.");
    }
    return;
  }

  if (buffer.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error("El contenido no corresponde a un archivo XLSX de Excel.");
  }
  const directoryEnd = buffer.byteLength - 22;
  if (view.getUint32(directoryEnd, true) !== 0x06054b50 || view.getUint16(directoryEnd + 20, true) !== 0) {
    throw new Error("El archivo XLSX está incompleto o contiene extensiones ZIP incompatibles.");
  }

  const entries = view.getUint16(directoryEnd + 10, true);
  const directorySize = view.getUint32(directoryEnd + 12, true);
  let offset = view.getUint32(directoryEnd + 16, true);
  const directoryStart = offset;
  let expandedBytes = 0;
  const names = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const error = "El archivo XLSX supera los límites de lectura o contiene partes incompatibles.";
  if (!entries || entries > 200 || offset + directorySize !== directoryEnd ||
    view.getUint32(directoryEnd + 4, true) !== 0 || view.getUint16(directoryEnd + 8, true) !== entries) {
    throw new Error(error);
  }
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) throw new Error(error);
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const expanded = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const localOffset = view.getUint32(offset + 42, true);
    expandedBytes += expanded;
    const nameStart = offset + 46;
    const extraStart = nameStart + nameLength;
    const entryEnd = extraStart + extraLength + view.getUint16(offset + 32, true);
    if (entryEnd > directoryEnd || !nameLength || (flags & 0x2041) || ![0, 8].includes(method) ||
      expandedBytes > MAX_EXPANDED_BYTES || localOffset + 30 > directoryStart ||
      view.getUint32(localOffset, true) !== 0x04034b50 ||
      view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method ||
      view.getUint16(localOffset + 26, true) !== nameLength) {
      throw new Error(error);
    }
    const localExtraStart = localOffset + 30 + nameLength;
    const dataOffset = localExtraStart + view.getUint16(localOffset + 28, true);
    const dataEnd = dataOffset + compressed;
    if (dataEnd > directoryStart) throw new Error(error);
    const name = decoder.decode(bytes.subarray(nameStart, extraStart));
    const localName = decoder.decode(bytes.subarray(localOffset + 30, localExtraStart));
    if (names.has(name) || localName !== name || name.startsWith("/") || name.includes("\\") ||
      name.split("/").includes("..")) throw new Error(error);
    names.add(name);
    assertZipExtras(view, extraStart, extraStart + extraLength, error);
    assertZipExtras(view, localExtraStart, dataOffset, error);

    const localCompressed = view.getUint32(localOffset + 18, true);
    const localExpanded = view.getUint32(localOffset + 22, true);
    if (flags & 8) {
      if ((localCompressed && localCompressed !== compressed) || (localExpanded && localExpanded !== expanded) ||
        dataEnd + 12 > directoryStart) throw new Error(error);
      const descriptor = view.getUint32(dataEnd, true) === 0x08074b50 ? dataEnd + 4 : dataEnd;
      if (descriptor + 12 > directoryStart || view.getUint32(descriptor + 4, true) !== compressed ||
        view.getUint32(descriptor + 8, true) !== expanded) throw new Error(error);
    } else if (localCompressed !== compressed || localExpanded !== expanded) {
      throw new Error(error);
    }
    // Verify the actual DEFLATE stream before handing the workbook to SheetJS.
    if (method === 8) await assertExpandedSize(bytes.subarray(dataOffset, dataEnd), expanded, error);
    else if (compressed !== expanded) throw new Error(error);
    offset = entryEnd;
  }
  if (offset !== directoryEnd || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) throw new Error(error);
}

function expandNumber(value: number): string {
  const number = String(value);
  const exponential = /^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/.exec(number);
  if (!exponential) return number;
  const [, sign, whole, fractions = "", power] = exponential;
  const digits = whole + fractions;
  const at = whole.length + Number(power);
  if (at <= 0) return `${sign}0.${"0".repeat(-at)}${digits}`;
  if (at >= digits.length) return `${sign}${digits}${"0".repeat(at - digits.length)}`;
  return `${sign}${digits.slice(0, at)}.${digits.slice(at)}`;
}

async function readExcel(buffer: ArrayBuffer, extension: string): Promise<SourceTable> {
  await assertExcelFile(buffer, extension);
  const spreadsheet = await import("xlsx");
  let workbook;
  try {
    workbook = spreadsheet.read(buffer, {
      type: "array",
      sheets: 0,
      sheetRows: IMPORT_MAX_ROWS + 2,
      cellFormula: true,
      cellNF: true,
      cellHTML: false,
    });
  } catch {
    throw new Error("No se pudo leer el libro. Verificá que sea un XLS/XLSX sin contraseña y volvé a exportarlo.");
  }
  if (workbook.SheetNames.length !== 1) {
    throw new Error("El libro debe tener una sola hoja. Guardá la tabla a importar en un archivo separado.");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"]) throw new Error("La hoja está vacía.");
  const range = spreadsheet.utils.decode_range(sheet["!ref"]);
  const fullRange = spreadsheet.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
  if (fullRange.e.c - fullRange.s.c + 1 > MAX_COLUMNS) {
    throw new Error("La hoja supera el máximo de 80 columnas.");
  }
  if (fullRange.e.r - fullRange.s.r > IMPORT_MAX_ROWS) {
    throw new Error("La hoja supera el máximo de 5.000 filas de datos.");
  }

  const rows: SourceRow[] = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const cells: string[] = [];
    const numericCells: number[] = [];
    const invalidCells: number[] = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[spreadsheet.utils.encode_cell({ r: row, c: column })] as
        | import("xlsx").CellObject
        | undefined;
      const index = column - range.s.c;
      if (cell?.f || cell?.t === "e") invalidCells.push(index);
      if (cell?.t === "n" && typeof cell.v === "number") {
        if (typeof cell.z === "string" && spreadsheet.SSF.is_date(cell.z)) {
          const date = spreadsheet.SSF.parse_date_code(cell.v, {
            date1904: workbook.Workbook?.WBProps?.date1904,
          }) as { y: number; m: number; d: number } | null;
          cells.push(date ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}` : "");
        } else {
          numericCells.push(index);
          cells.push(typeof cell.z === "string" && /^0{2,}$/.test(cell.z) && cell.w ? cell.w : expandNumber(cell.v));
        }
      } else {
        cells.push(String(cell?.v ?? "").trim());
      }
    }
    if (cells.some(Boolean) || invalidCells.length) rows.push({ row: row + 1, cells, numericCells, invalidCells });
  }
  const [header, ...data] = rows;
  if (header?.invalidCells?.length) throw new Error("Los encabezados de la hoja deben ser texto.");
  return validateTable({ headers: header?.cells ?? [], rows: data });
}

export async function readSource(buffer: ArrayBuffer, filename: string): Promise<SourceTable> {
  if (!buffer.byteLength || buffer.byteLength > IMPORT_MAX_BYTES) {
    throw new Error("Elegí un archivo de hasta 3 MiB que contenga datos.");
  }
  const extension = filename.toLowerCase().split(".").at(-1);
  if (extension === "csv") return readCsv(buffer);
  if (extension === "xls" || extension === "xlsx") return readExcel(buffer, extension);
  throw new Error("Para importar datos estructurados, elegí un archivo CSV, XLS o XLSX.");
}
