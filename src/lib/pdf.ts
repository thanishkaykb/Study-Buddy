import { readableStudyText } from "./readable-text";

// Client-side helper to extract readable text from a PDF File using pdfjs
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // worker
  const worker: any = await import(/* @vite-ignore */ "pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  const maxPages = Math.min(pdf.numPages, 200);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const it of tc.items as any[]) {
      if (!("str" in it) || !it.str?.trim()) continue;
      const y = Math.round((it.transform?.[5] ?? 0) / 3) * 3;
      const x = it.transform?.[4] ?? 0;
      const row = rows.get(y) ?? [];
      row.push({ x, str: it.str });
      rows.set(y, row);
    }
    const text = Array.from(rows.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((it) => it.str).join(" "))
      .join("\n");
    out += `\n\n--- Page ${i} ---\n${readableStudyText(text)}`;
  }
  return readableStudyText(out).replace(/\n{3,}/g, "\n\n");
}
