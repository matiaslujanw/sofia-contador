export const maxDocumentBytes = 3 * 1024 * 1024;
export const documentExtensions = [".pdf", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg"];

export async function verifyDocument(file: File) {
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if (!documentExtensions.includes(extension)) throw new Error("Elegí un archivo PDF, XLS, XLSX, CSV, PNG o JPG.");
  if (file.size < 1 || file.size > maxDocumentBytes) throw new Error("El archivo debe tener contenido y pesar hasta 3 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const begins = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const formats: Record<string, [string, boolean]> = {
    ".pdf": ["application/pdf", begins([37, 80, 68, 70, 45])],
    ".xls": ["application/vnd.ms-excel", begins([208, 207, 17, 224, 161, 177, 26, 225]) || (bytes[0] === 9 && [0, 2, 4, 8].includes(bytes[1]))],
    ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", begins([80, 75, 3, 4])],
    ".csv": ["text/csv", !bytes.includes(0) || begins([255, 254]) || begins([254, 255])],
    ".png": ["image/png", begins([137, 80, 78, 71, 13, 10, 26, 10])],
    ".jpg": ["image/jpeg", begins([255, 216, 255])],
    ".jpeg": ["image/jpeg", begins([255, 216, 255])],
  };
  const [mime, verified] = formats[extension];
  if (!verified) throw new Error("El contenido del archivo no coincide con su extensión.");
  const name = file.name.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 220);
  return { name, mime };
}
