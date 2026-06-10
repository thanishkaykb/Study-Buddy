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
