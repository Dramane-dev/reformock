import PDFDocument from "pdfkit";

import type { InvoiceData } from "../types.ts";

function generateReadablePDF(inv: InvoiceData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("FACTURE", { align: "right" });
    doc.fontSize(10).text(`N° ${inv.invoiceNumber}`, { align: "right" });
    doc.text(`Date d'émission : ${inv.issueDate}`, { align: "right" });
    doc.text(`Date d'échéance : ${inv.dueDate}`, { align: "right" });
    doc.moveDown(2);

    const y = doc.y;
    doc.fontSize(11).text("Émetteur", 50, y, { underline: true });
    doc
      .fontSize(9)
      .text(inv.seller.name)
      .text(inv.seller.address.line1)
      .text(`${inv.seller.address.postalCode} ${inv.seller.address.city}`)
      .text(`SIRET : ${inv.seller.siret}`)
      .text(`TVA : ${inv.seller.vatNumber}`);

    doc.fontSize(11).text("Destinataire", 320, y, { underline: true });
    doc
      .fontSize(9)
      .text(inv.buyer.name, 320)
      .text(inv.buyer.address.line1, 320)
      .text(`${inv.buyer.address.postalCode} ${inv.buyer.address.city}`, 320)
      .text(`SIRET : ${inv.buyer.siret}`, 320)
      .text(`TVA : ${inv.buyer.vatNumber}`, 320);

    doc.moveDown(2);
    doc.x = 50;

    doc.moveDown();
    const tableTop = doc.y + 10;
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Désignation", 50, tableTop, { width: 220 });
    doc.text("Qté", 280, tableTop, { width: 40, align: "right" });
    doc.text("PU HT", 330, tableTop, { width: 70, align: "right" });
    doc.text("TVA %", 410, tableTop, { width: 50, align: "right" });
    doc.text("Total HT", 470, tableTop, { width: 75, align: "right" });
    doc
      .moveTo(50, tableTop + 14)
      .lineTo(545, tableTop + 14)
      .stroke();

    doc.font("Helvetica");
    let ly = tableTop + 20;
    for (const l of inv.lines) {
      doc.text(l.name, 50, ly, { width: 220 });
      doc.text(String(l.quantity), 280, ly, { width: 40, align: "right" });
      doc.text(l.unitPrice.toFixed(2), 330, ly, { width: 70, align: "right" });
      doc.text(String(l.vatRate), 410, ly, { width: 50, align: "right" });
      doc.text(l.lineTotal.toFixed(2), 470, ly, { width: 75, align: "right" });
      ly += 18;
    }

    doc
      .moveTo(50, ly + 4)
      .lineTo(545, ly + 4)
      .stroke();
    ly += 14;
    doc.font("Helvetica-Bold");
    doc.text(`Total HT : ${inv.totals.totalHT.toFixed(2)} €`, 330, ly, {
      width: 215,
      align: "right",
    });
    ly += 14;
    doc.text(`TVA (${inv.totals.vatRate} %) : ${inv.totals.totalVAT.toFixed(2)} €`, 330, ly, {
      width: 215,
      align: "right",
    });
    ly += 14;
    doc.fontSize(11).text(`Total TTC : ${inv.totals.totalTTC.toFixed(2)} €`, 330, ly, {
      width: 215,
      align: "right",
    });

    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("gray")
      .text(
        "Document généré par Réformock (mock RFE) : données fictives, usage test uniquement.",
        50,
        780,
        { align: "center", width: 495 },
      );

    doc.end();
  });
}

export { generateReadablePDF };
