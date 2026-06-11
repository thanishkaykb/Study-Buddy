import jsPDF from "jspdf";

function addWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6) {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function strip(md: string) {
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(\d+)\]/g, "[$1]");
}

export function exportMarkdownPdf(title: string, markdown: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 15, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  addWrapped(doc, strip(markdown), 15, 30, 180);
  doc.save(`${title.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}

export function exportFlashcardsPdf(title: string, cards: { front: string; back: string }[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 15, 20);
  let y = 32;
  doc.setFontSize(11);
  cards.forEach((c, i) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. Q: `, 15, y);
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, c.front, 30, y, 165) + 2;
    doc.setFont("helvetica", "bold");
    doc.text("A: ", 15, y);
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, c.back, 30, y, 165) + 6;
  });
  doc.save(`${title.replace(/[^a-z0-9]+/gi, "_")}_flashcards.pdf`);
}

export function exportQuizPdf(
  title: string,
  questions: { q: string; options: string[]; answer: number; explanation: string }[],
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 15, 20);
  let y = 32;
  doc.setFontSize(11);
  questions.forEach((q, i) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    y = addWrapped(doc, `${i + 1}. ${q.q}`, 15, y, 180) + 2;
    doc.setFont("helvetica", "normal");
    q.options.forEach((o, j) => {
      y = addWrapped(doc, `${String.fromCharCode(65 + j)}. ${o}`, 20, y, 175);
    });
    y += 2;
    doc.setFont("helvetica", "italic");
    y = addWrapped(doc, `Answer: ${String.fromCharCode(65 + q.answer)} — ${q.explanation}`, 15, y, 180) + 6;
    doc.setFont("helvetica", "normal");
  });
  doc.save(`${title.replace(/[^a-z0-9]+/gi, "_")}_quiz.pdf`);
}

function htmlToPlain(html: string): string {
  if (!html) return "";
  // Convert <br> to newlines, list items to "- ", checkboxes to [x]/[ ]
  let s = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<input[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, "[x] ")
    .replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, "[ ] ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

export function exportNotebookPdf(
  title: string,
  payload: {
    notesHtml?: string;
    sources: { title: string; source_type: string; url: string | null; char_count: number }[];
    chat: { role: "user" | "assistant"; content: string; created_at: string }[];
  },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 180;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported ${new Date().toLocaleString()}`, 15, y);
  doc.setTextColor(0);
  y += 10;

  const heading = (label: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(label, 15, y);
    y += 2;
    doc.setDrawColor(180);
    doc.line(15, y, 195, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };

  // Notes / checklist
  heading("Notes & Checklist");
  const notesPlain = htmlToPlain(payload.notesHtml ?? "");
  if (notesPlain) {
    y = addWrapped(doc, notesPlain, 15, y, W) + 4;
  } else {
    doc.setTextColor(140);
    y = addWrapped(doc, "(no notes)", 15, y, W) + 4;
    doc.setTextColor(0);
  }

  // Sources
  heading("Sources");
  if (payload.sources.length === 0) {
    doc.setTextColor(140);
    y = addWrapped(doc, "(no sources)", 15, y, W) + 4;
    doc.setTextColor(0);
  } else {
    payload.sources.forEach((s, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      y = addWrapped(doc, `[${i + 1}] ${s.title}`, 15, y, W);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      const meta = `${s.source_type} · ${Math.round(s.char_count / 1000)}k chars${s.url ? ` · ${s.url}` : ""}`;
      y = addWrapped(doc, meta, 15, y, W) + 3;
      doc.setTextColor(0);
    });
  }

  // Chat / Q&A
  heading("Recent Q&A");
  if (payload.chat.length === 0) {
    doc.setTextColor(140);
    y = addWrapped(doc, "(no conversation yet)", 15, y, W) + 4;
    doc.setTextColor(0);
  } else {
    payload.chat.forEach((m) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setTextColor(m.role === "user" ? 30 : 60);
      const label = m.role === "user" ? "You" : "StudyMind";
      const stamp = new Date(m.created_at).toLocaleString();
      y = addWrapped(doc, `${label}  ·  ${stamp}`, 15, y, W);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      y = addWrapped(doc, strip(m.content), 15, y, W) + 5;
    });
  }

  doc.save(`${title.replace(/[^a-z0-9]+/gi, "_")}_notebook.pdf`);
}
