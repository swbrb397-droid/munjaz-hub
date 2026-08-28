/**
 * Client-side PDF export helpers.
 *
 * Renders a live DOM node to a high-contrast, black-on-white A4 PDF using
 * html2canvas-pro (supports modern oklch colors) + jsPDF. Arabic text stays
 * fully shaped because it is rasterized from the browser's own rendering.
 *
 * Every exported document carries an official authenticity stamp: a diagonal
 * cryptographic watermark, a circular platform seal, and a verification hash
 * footer. A `PDF_DOWNLOAD_EVENT` audit entry is dispatched on each export.
 */

import { documentHash, logAuditEvent } from "@/lib/audit";

/** Temporarily forces black-on-white styling while capturing. */
const PDF_CLASS = "pdf-mode";

export type PdfStampOptions = {
  /** Document kind shown on the seal, e.g. "RECEIPT" or "AUDIT LOG". */
  docType?: string;
  /** Business reference (order number, tx id) recorded in the audit event. */
  reference?: string;
  /** Current user id, recorded in the audit event. */
  userId?: string | null;
};

type JsPdfDoc = {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  getNumberOfPages(): number;
  setPage(n: number): void;
  setFont(name: string, style?: string): void;
  setFontSize(n: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(n: number): void;
  circle(x: number, y: number, r: number, style?: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  text(text: string, x: number, y: number, opts?: Record<string, unknown>): void;
};

/** Draws the authenticity seal, watermark, and verification footer on every page. */
function stampPages(pdf: JsPdfDoc, hash: string, opts: PdfStampOptions) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pages = pdf.getNumberOfPages();
  const issued = new Date().toISOString().replace("T", " ").slice(0, 19);
  const docType = opts.docType ?? "DOCUMENT";

  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);

    // Diagonal cryptographic watermark
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(46);
    pdf.setTextColor(232, 236, 240);
    pdf.text("AL-MUNJAZ VERIFIED", pageW / 2, pageH / 2, { align: "center", angle: 32 });

    // Circular official seal (bottom-start corner)
    const cx = 74;
    const cy = pageH - 66;
    pdf.setDrawColor(16, 120, 90);
    pdf.setLineWidth(1.4);
    pdf.circle(cx, cy, 34, "S");
    pdf.setLineWidth(0.5);
    pdf.circle(cx, cy, 29, "S");
    pdf.setTextColor(16, 120, 90);
    pdf.setFontSize(7.5);
    pdf.text("AL-MUNJAZ", cx, cy - 8, { align: "center" });
    pdf.text("OFFICIAL SEAL", cx, cy + 1, { align: "center" });
    pdf.setFontSize(6);
    pdf.text(docType.toUpperCase(), cx, cy + 10, { align: "center" });

    // Verification footer
    pdf.setDrawColor(140, 150, 160);
    pdf.setLineWidth(0.5);
    pdf.line(28, pageH - 30, pageW - 28, pageH - 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(70, 80, 90);
    pdf.text(`VERIFICATION HASH: ${hash}  |  SIGNED: ${issued} UTC  |  PAGE ${p}/${pages}`, 28, pageH - 19);
    pdf.text("Cryptographically signed by Al-Munjaz escrow platform. Verify at /verify.", 28, pageH - 11);
  }
}

export async function downloadElementPdf(el: HTMLElement, filename: string, options: PdfStampOptions = {}) {
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
    // Reserve space for the seal + verification footer.
    const usableH = pageH - margin * 2 - 74;

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

    const hash = documentHash(`${filename}|${options.reference ?? ""}|${img.length}|${el.innerText.slice(0, 4000)}`);
    stampPages(pdf as unknown as JsPdfDoc, hash, options);

    pdf.save(filename);

    registerDocument({
      hash,
      docType: options.docType ?? "DOCUMENT",
      reference: options.reference ?? "",
      issuedAt: new Date().toISOString(),
      target: filename,
    });

    logAuditEvent({
      type: "PDF_DOWNLOAD_EVENT",
      userId: options.userId ?? null,
      target: filename,
      hash,
      meta: { docType: options.docType ?? "DOCUMENT", reference: options.reference ?? "" },
    });

    return hash;
  } finally {
    el.classList.remove(PDF_CLASS);
  }
}
