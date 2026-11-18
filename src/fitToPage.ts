// Scales each printed report so it fits on exactly one A4 page.
// Runs on every print (our Print buttons and Ctrl+P / browser menu).

// A4 = 297mm tall, minus the 8mm top and bottom margins set in @page.
const PRINTABLE_HEIGHT_PX = ((297 - 16) * 96) / 25.4;
const SAFETY = 0.97; // headroom for browser rounding

export function fitPages() {
  document.body.classList.add('print-layout');
  document.querySelectorAll<HTMLElement>('.page').forEach((page) => {
    page.style.setProperty('--fit', '1');
    const h = page.scrollHeight; // forces layout at print width
    if (!h) return; // not printed (hidden)
    const fit = Math.min(1, (PRINTABLE_HEIGHT_PX * SAFETY) / h);
    page.style.setProperty('--fit', fit.toFixed(3));
  });
}

export function clearFit() {
  document.body.classList.remove('print-layout');
  document.querySelectorAll<HTMLElement>('.page').forEach((p) => p.style.removeProperty('--fit'));
}

export function installPrintFit() {
  window.addEventListener('beforeprint', fitPages);
  window.addEventListener('afterprint', clearFit);
  return () => {
    window.removeEventListener('beforeprint', fitPages);
    window.removeEventListener('afterprint', clearFit);
  };
}
