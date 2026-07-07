import type { Company, InvoiceData, InvoiceLine } from "../types.ts";

interface Product {
  name: string;
  unit: string;
  price: number;
}

const COMPANY_NAMES: readonly string[] = [
  "ACME Industries",
  "Boulangerie Martin",
  "TechnoSoft SAS",
  "Transports Durand",
  "Menuiserie Lefevre",
  "Conseil & Stratégie Paris",
  "Green Energy France",
  "Ateliers du Rhône",
  "Distribution Nord SARL",
  "Imprimerie Moderne",
  "Fournitures Pro SAS",
  "Logistique Atlantique",
  "Studio Créatif Lyon",
  "BTP Constructions",
  "Restauration Collective Sud",
];

const PRODUCTS: readonly Product[] = [
  { name: "Prestation de conseil", unit: "DAY", price: 850 },
  { name: "Licence logicielle annuelle", unit: "C62", price: 1200 },
  { name: "Maintenance applicative", unit: "HUR", price: 95 },
  { name: "Fourniture de bureau - lot", unit: "C62", price: 45.5 },
  { name: "Transport de marchandises", unit: "KMT", price: 1.85 },
  { name: "Formation professionnelle", unit: "DAY", price: 1100 },
  { name: "Développement spécifique", unit: "HUR", price: 120 },
  { name: "Abonnement plateforme SaaS", unit: "MON", price: 299 },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)] as T;
}

function luhnChecksum(digits: readonly number[]): number {
  let sum = 0;
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    let d = digits[len - 1 - i] as number;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
  }
  return sum;
}

function generateSiren(): string {
  const base: number[] = [];
  for (let i = 0; i < 8; i++) {
    base.push(randInt(0, 9));
  }
  for (let c = 0; c <= 9; c++) {
    if (luhnChecksum([...base, c]) % 10 === 0) {
      return base.join("") + c;
    }
  }
  return base.join("") + "0";
}

function generateSiret(siren: string): string {
  const nicBase = [0, 0, randInt(0, 3), randInt(0, 9)];
  const digits = (siren + nicBase.join("")).split("").map(Number);
  for (let c = 0; c <= 9; c++) {
    if (luhnChecksum([...digits, c]) % 10 === 0) {
      return siren + nicBase.join("") + c;
    }
  }
  return siren + nicBase.join("") + "0";
}

function vatNumberFR(siren: string): string {
  const key = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  return "FR" + String(key).padStart(2, "0") + siren;
}

function generateCompany(name?: string): Company {
  const siren = generateSiren();
  return {
    name: name || pick(COMPANY_NAMES),
    siren,
    siret: generateSiret(siren),
    vatNumber: vatNumberFR(siren),
    address: {
      line1: `${randInt(1, 150)} rue ${pick(["de la République", "Victor Hugo", "des Lilas", "du Commerce", "Pasteur"])}`,
      postalCode:
        String(randInt(10, 95)).padStart(2, "0") + String(randInt(0, 999)).padStart(3, "0"),
      city: pick([
        "Paris",
        "Lyon",
        "Marseille",
        "Lille",
        "Nantes",
        "Bordeaux",
        "Toulouse",
        "Strasbourg",
      ]),
      countryCode: "FR",
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let invoiceCounter = 1000;

function generateInvoiceData({
  seller,
  buyer,
}: { seller?: Company; buyer?: Company } = {}): InvoiceData {
  invoiceCounter += randInt(1, 7);
  const s = seller || generateCompany();
  const b = buyer || generateCompany();
  const nbLines = randInt(1, 4);
  const vatRate = pick([20, 20, 20, 10, 5.5]);
  const lines: InvoiceLine[] = [];
  let totalHT = 0;
  for (let i = 1; i <= nbLines; i++) {
    const p = pick(PRODUCTS);
    const qty = randInt(1, 12);
    const lineTotal = round2(qty * p.price);
    totalHT = round2(totalHT + lineTotal);
    lines.push({
      id: i,
      name: p.name,
      unit: p.unit,
      unitPrice: p.price,
      quantity: qty,
      lineTotal,
      vatRate,
    });
  }
  const totalVAT = round2((totalHT * vatRate) / 100);
  const issue = new Date(Date.now() - randInt(0, 20) * 86400000);
  const due = new Date(issue.getTime() + 30 * 86400000);
  return {
    invoiceNumber: `FA-${issue.getFullYear()}-${invoiceCounter}`,
    issueDate: issue.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    currency: "EUR",
    seller: s,
    buyer: b,
    lines,
    totals: { totalHT, totalVAT, vatRate, totalTTC: round2(totalHT + totalVAT) },
  };
}

export { generateCompany, generateInvoiceData, pick, randInt };
