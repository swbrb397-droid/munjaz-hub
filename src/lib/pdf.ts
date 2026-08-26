/**
 * Client-side PDF export helpers.
 *
 * Renders a live DOM node to a high-contrast, black-on-white A4 PDF using
 * html2canvas-pro (supports modern oklch colors) + jsPDF. Arabic text stays
 * fully shaped because it is rasterized from the browser's own rendering.
 */

/** Temporarily forces black-on-white styling while capturing. */
const PDF_CLASS = "pdf-mode";

export async function downloadElementPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  el.classList.add(PDF_CLASS);
  try {
    const canvas = await html2canvas(el, {
      scale: Math.min(2, window.devicePixelRatio || 1) * 1.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const imgH = (canvas.height * usableW) / canvas.width;
    const img = canvas.toDataURL("image/png");

    if (imgH <= usableH) {
      pdf.addImage(img, "PNG", margin, margin, usableW, imgH);
    } else {
      // Slice the tall canvas across multiple pages.
      const pxPerPage = (canvas.width * usableH) / usableW;
      let offset = 0;
      let page = 0;
      while (offset < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, usableW, (sliceH * usableW) / canvas.width);
        offset += sliceH;
        page++;
      }
    }

    pdf.save(filename);
  } finally {
    el.classList.remove(PDF_CLASS);
  }
}
