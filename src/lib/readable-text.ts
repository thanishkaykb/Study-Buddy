const superscripts: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

export function readableStudyText(text: string): string {
  return (text ?? "")
    .replace(/\$([^$\n]{1,220})\$/g, "$1")
    .replace(/\\\(([^)]{1,220})\\\)/g, "$1")
    .replace(/\\\[([^\]]{1,400})\\\]/g, "$1")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1) / ($2)")
    .replace(/\\times\b|\\cdot\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\pm\b/g, "±")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\to\b|\\rightarrow\b/g, "→")
    .replace(/\\leftarrow\b/g, "←")
    .replace(/\\cup\b/g, "∪")
    .replace(/\\cap\b/g, "∩")
    .replace(/\\in\b/g, "∈")
    .replace(/\\notin\b/g, "∉")
    .replace(/\\subseteq\b/g, "⊆")
    .replace(/\\subset\b/g, "⊂")
    .replace(/\\emptyset\b/g, "∅")
    .replace(/\\forall\b/g, "∀")
    .replace(/\\exists\b/g, "∃")
    .replace(/\^\{([0-9])\}/g, (_, n) => superscripts[n] ?? `^${n}`)
    .replace(/\^([0-9])/g, (_, n) => superscripts[n] ?? `^${n}`)
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
