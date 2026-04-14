export type ParsedIdCard = {
  name?: string;
  address?: string;
  personalNumericCode?: string;
  identityDocumentSeries?: string;
  identityDocumentNumber?: string;
  confidence: {
    name: number;
    address: number;
    personalNumericCode: number;
    identityDocumentSeries: number;
    identityDocumentNumber: number;
  };
  rawText: string;
  normalizedText: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

function stripDiacritics(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ș/g, 's')
    .replace(/Ș/g, 'S')
    .replace(/ț/g, 't')
    .replace(/Ț/g, 'T');
}

function extractCnp(text: string) {
  const match = text.match(/\b[1-9]\d{12}\b/);
  return match?.[0] || '';
}

function extractSeriesAndNumber(text: string) {
  const upper = stripDiacritics(text).toUpperCase();
  const ciMatch =
    upper.match(/\b(?:SERIA|SERIE)\s+([A-Z]{1,2})\s*(?:NR|NO|NUMARUL|NUMAR)?\.?\s*([A-Z0-9]{5,8})\b/) ||
    upper.match(/\bCI\s*([A-Z]{1,2})\s*([A-Z0-9]{5,8})\b/) ||
    upper.match(/\b([A-Z]{2})\s+([0-9]{6})\b/);

  return {
    series: ciMatch?.[1] || '',
    number: ciMatch?.[2] || '',
  };
}

function cleanCandidateName(value: string) {
  return value
    .replace(/[^A-Za-zĂÂÎȘȚăâîșț \-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNameLabelLine(value: string) {
  const normalized = stripDiacritics(value).toUpperCase().replace(/\s+/g, ' ').trim();
  return (
    normalized.includes('NUME') ||
    normalized.includes('NOM') ||
    normalized.includes('LAST NAME') ||
    normalized.includes('PRENUME') ||
    normalized.includes('PRENOM') ||
    normalized.includes('FIRST NAME')
  );
}

function isBlockedNameValueLine(value: string) {
  const normalized = stripDiacritics(value).toUpperCase().replace(/\s+/g, ' ').trim();
  return (
    normalized.includes('CETATENIE') ||
    normalized.includes('NATIONALITATE') ||
    normalized.includes('NATIONALITE') ||
    normalized.includes('NATIONALITY') ||
    normalized.includes('SEX') ||
    normalized.includes('SEXE') ||
    normalized.includes('VALABILITATE') ||
    normalized.includes('DATA') ||
    normalized.includes('DATE OF') ||
    normalized.includes('LOCUL') ||
    normalized.includes('LIEU') ||
    normalized.includes('PLACE')
  );
}

function looksLikePersonalName(value: string) {
  const cleaned = cleanCandidateName(value);
  if (!cleaned) return false;
  if (isNameLabelLine(cleaned) || isBlockedNameValueLine(cleaned)) return false;

  const parts = cleaned.split(' ').filter(Boolean);
  if (!parts.length) return false;

  return parts.every((part) => /^[A-Za-zĂÂÎȘȚăâîșț\-]+$/.test(part));
}

function pickNextValueLine(lines: string[], startIndex: number) {
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 4); index += 1) {
    const candidate = cleanCandidateName(lines[index] || '');
    if (!candidate) continue;
    if (isNameLabelLine(candidate)) continue;
    if (isBlockedNameValueLine(candidate)) continue;
    return candidate;
  }

  return '';
}

function extractName(lines: string[]) {
  const normalizedLines = lines.map((line) => stripDiacritics(line).toUpperCase());
  let lastName = '';
  let firstName = '';

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];
    if (!line.includes('NUME')) continue;
    if (line.includes('PRENUME')) continue;

    const strippedSameLine = cleanCandidateName(lines[index].replace(/.*NUME[:\s]*/i, ''));
    if (strippedSameLine && looksLikePersonalName(strippedSameLine)) {
      lastName = strippedSameLine;
      break;
    }

    const nextValue = pickNextValueLine(lines, index);
    if (looksLikePersonalName(nextValue)) {
      lastName = nextValue;
      break;
    }
  }

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];
    if (!line.includes('PRENUME')) continue;

    const strippedSameLine = cleanCandidateName(lines[index].replace(/.*PRENUME[:\s]*/i, ''));
    if (strippedSameLine && looksLikePersonalName(strippedSameLine)) {
      firstName = strippedSameLine;
      break;
    }

    const nextValue = pickNextValueLine(lines, index);
    firstName = looksLikePersonalName(nextValue) ? nextValue : '';
    if (firstName) break;
  }

  const merged = [lastName, firstName].filter(Boolean).join(' ').trim();
  if (merged) return merged;

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];
    if (!line.includes('NUME')) continue;

    const candidate = cleanCandidateName(lines[index].replace(/.*NUME[:\s]*/i, ''));
    if (candidate && looksLikePersonalName(candidate)) return candidate;

    const next = pickNextValueLine(lines, index);
    if (looksLikePersonalName(next)) return next;
  }

  return '';
}

function extractAddress(lines: string[]) {
  const normalizedLines = lines.map((line) => stripDiacritics(line).toUpperCase());
  const isAddressStopLine = (value: string) => {
    const normalized = stripDiacritics(value).toUpperCase().replace(/\s+/g, ' ').trim();
    return (
      !normalized ||
      normalized.includes('CNP') ||
      normalized.includes('SEX') ||
      normalized.includes('SEXE') ||
      normalized.includes('NATIONALITATE') ||
      normalized.includes('NATIONALITE') ||
      normalized.includes('NATIONALITY') ||
      normalized.includes('LOCUL NASTERII') ||
      normalized.includes('LIEU DE NAISSANCE') ||
      normalized.includes('PLACE OF BIRTH') ||
      normalized.includes('EMISA DE') ||
      normalized.includes('ISSUED BY') ||
      normalized.includes('VALABILITATE') ||
      normalized.includes('VALIDITE') ||
      normalized.includes('VALIDITY') ||
      normalized.includes('SERIA') ||
      normalized.includes('NUME') ||
      normalized.includes('PRENUME')
    );
  };

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];
    if (!line.includes('DOMICILIU') && !line.includes('ADRESA')) continue;

    const current = lines[index]
      .replace(/.*(?:DOMICILIU|ADRESA)[:\s]*/i, '')
      .replace(/^\/?(?:Adresse|Address)\b[:/\s]*/i, '')
      .replace(/^(?:Adresse|Address)\b[:/\s]*/i, '')
      .trim();
    const addressLines = [current];

    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
      const nextLine = (lines[nextIndex] || '').trim();
      if (isAddressStopLine(nextLine)) break;
      addressLines.push(nextLine);
    }

    return addressLines
      .filter(Boolean)
      .join(' ')
      .replace(/\/?(?:Adresse|Address)\b/gi, ' ')
      .replace(/\.(?=\S)/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}

export function parseRomanianIdCard(rawText: string): ParsedIdCard {
  const normalizedText = normalizeWhitespace(rawText);
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean);
  const personalNumericCode = extractCnp(normalizedText);
  const identity = extractSeriesAndNumber(normalizedText);
  const name = extractName(lines);
  const address = extractAddress(lines);

  return {
    name,
    address,
    personalNumericCode,
    identityDocumentSeries: identity.series,
    identityDocumentNumber: identity.number,
    confidence: {
      name: name ? 0.65 : 0.1,
      address: address ? 0.55 : 0.1,
      personalNumericCode: personalNumericCode ? 0.95 : 0.1,
      identityDocumentSeries: identity.series ? 0.85 : 0.1,
      identityDocumentNumber: identity.number ? 0.85 : 0.1,
    },
    rawText,
    normalizedText,
  };
}
