type Xml = string | null | undefined;

const PREFIX = "(?:[\\w.-]+:)?";

function elementRe(local: string, flags = ""): RegExp {
  return new RegExp(`<${PREFIX}${local}\\b[^>]*>([\\s\\S]*?)</${PREFIX}${local}>`, flags);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

export function pick(xml: Xml, local: string): string | null {
  if (!xml) {
    return null;
  }
  const m = xml.match(elementRe(local));
  return m ? m[1] : null;
}

export function text(xml: Xml, local: string): string | null {
  const inner = pick(xml, local);
  return inner === null ? null : decodeEntities(inner.trim());
}

export function num(xml: Xml, local: string): number | null {
  const t = text(xml, local);
  if (t === null) {
    return null;
  }
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function picks(xml: Xml, local: string): string[] {
  if (!xml) {
    return [];
  }
  const out: string[] = [];
  const re = elementRe(local, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

export function attr(xml: Xml, local: string, attrName: string): string | null {
  if (!xml) {
    return null;
  }
  const re = new RegExp(`<${PREFIX}${local}\\b[^>]*?\\b${attrName}="([^"]*)"`);
  const m = xml.match(re);
  return m ? m[1] : null;
}
