// Scales each printed report so it fits on exactly one A4 page (width and height).
//
// It lays the reports out in print style for a moment (body.print-measure),
// measures them, then removes the class again in the same task, so the screen
// never changes. The measured sizes are stored as CSS variables that only the
// @media print rules use. Runs on our Print buttons and on Ctrl+P / browser menu.

const MM = 96 / 25.4;
const PRINT_W = (210 - 16) * MM; // A4 width minus 8mm margins
const PRINT_H = (297 - 16) * MM * 0.98; // A4 height minus margins, small safety

export function fitPages() {
  const body = document.body;
  body.classList.add('print-measure');
  try {
    document.querySelectorAll<HTMLElement>('.page').forEach((page) => {
      const sheet = page.querySelector<HTMLElement>('.sheet');
      if (!sheet) return;
      sheet.style.width = `${PRINT_W}px`;
      const w = Math.max(PRINT_W, sheet.scrollWidth);
      if (w > PRINT_W) sheet.style.width = `${w}px`; // tables need more room: lay out wider, then shrink
      const h = sheet.scrollHeight;
      sheet.style.width = '';
      if (!h) return; // hidden (not part of this print)
      const scale = Math.min(1, PRINT_W / w, PRINT_H / h);
      page.style.setProperty('--sw', `${w}px`);
      page.style.setProperty('--scale', scale.toFixed(4));
      page.style.setProperty('--pw', `${Math.floor(w * scale)}px`);
      page.style.setProperty('--ph', `${Math.floor(h * scale)}px`);
    });
  } finally {
    body.classList.remove('print-measure');
  }
}

export function installPrintFit() {
  window.addEventListener('beforeprint', fitPages);
  return () => window.removeEventListener('beforeprint', fitPages);
}
