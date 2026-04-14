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

export type ParsedAddressProof = {
  address?: string;
  confidence: {
    address: number;
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
    normalized === 'SURNAME' ||
    normalized === 'GIVEN NAMES' ||
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

function extractNameFromMrz(rawText: string) {
  const compactLines = normalizeWhitespace(rawText)
    .split('\n')
    .map((line) => line.replace(/\s+/g, '').trim())
    .filter(Boolean);

  const mrzLine =
    compactLines.find((line) => /^IDROU[A-Z<]+$/i.test(line)) ||
    compactLines.find((line) => /^IDRO[A-Z<]+$/i.test(line));

  if (!mrzLine) return '';

  const normalized = mrzLine.toUpperCase();
  const payload = normalized.startsWith('IDROU') ? normalized.slice(5) : normalized.slice(4);
  const [surnamePart, givenNamesPart] = payload.split('<<');
  if (!surnamePart) return '';

  const surname = surnamePart.replace(/<+/g, ' ').trim();
  const givenNames = (givenNamesPart || '')
    .replace(/<+/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [surname, givenNames].filter(Boolean).join(' ').trim();
}

function pickNextDocumentValueLine(lines: string[], startIndex: number) {
  for (let index = startIndex + 1; index < Math.min(lines.length, startIndex + 5); index += 1) {
    const candidate = (lines[index] || '').trim().replace(/\s+/g, ' ');
    if (!candidate) continue;
    const normalized = stripDiacritics(candidate).toUpperCase();
    if (
      normalized.includes('DOCUMENT') ||
      normalized.includes('SURNAME') ||
      normalized.includes('GIVEN NAMES') ||
      normalized.includes('CNP') ||
      normalized.includes('ADDRESS') ||
      normalized.includes('DOMICILIU')
    ) {
      continue;
    }

    const tokenMatch = candidate.match(/[A-Z0-9]{6,12}/i);
    if (tokenMatch?.[0]) {
      return tokenMatch[0].toUpperCase();
    }
  }

  return '';
}

function extractName(lines: string[]) {
  const normalizedLines = lines.map((line) => stripDiacritics(line).toUpperCase());
  let lastName = '';
  let firstName = '';

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];
    const isLastNameLabel =
      line === 'SURNAME' ||
      ((line.includes('NUME') || line.includes('NOM') || line.includes('LAST NAME')) &&
        !line.includes('PRENUME') &&
        !line.includes('PRENOM') &&
        !line.includes('FIRST NAME') &&
        !line.includes('GIVEN NAMES'));
    if (!isLastNameLabel) continue;

    const strippedSameLine = cleanCandidateName(
      lines[index].replace(/.*(?:SURNAME|NUME|NOM|LAST NAME)[:\s]*/i, '')
    );
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
    const isFirstNameLabel =
      line === 'GIVEN NAMES' ||
      line.includes('PRENUME') ||
      line.includes('PRENOM') ||
      line.includes('FIRST NAME') ||
      line.includes('GIVEN NAMES');
    if (!isFirstNameLabel) continue;

    const strippedSameLine = cleanCandidateName(
      lines[index].replace(/.*(?:PRENUME|PRENOM|FIRST NAME|GIVEN NAMES)[:\s]*/i, '')
    );
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

    return normalizeAddressValue(addressLines.filter(Boolean).join(' '));
  }

  return '';
}

function normalizeAddressValue(value: string) {
  return value
    .replace(/\/?(?:Adresse|Address)\b/gi, ' ')
    .replace(/^\s*.*?(?=(?:Jud\.?|Mun\.?|Oras\.?|Oras|Sat\.?|Com\.?|Str\.?|Strada|Aleea|Bdul\.?|Bd\.?|Piata|P-ta)\b)/i, '')
    .replace(/\b[A-Z0-9]{4,8}\s+(?=(?:Jud\.?|Mun\.?|Oras\.?|Oras|Sat\.?|Com\.?|Str\.?|Strada|Aleea|Bdul\.?|Bd\.?|Piata|P-ta)\b)/gi, '')
    .replace(/\.(?=\S)/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAddressFromFreeText(rawText: string) {
  const normalized = normalizeWhitespace(rawText);
  const domicileSentenceMatch = normalized.match(
    /cu domiciliul (?:in|în)\s+(.+?)(?:\.\s+Nu\s+au\s+fost|\.\s+S-a\s+eliberat|\.\s+S-a\s+emis|$)/i
  );
  if (domicileSentenceMatch?.[1]) {
    return normalizeAddressValue(domicileSentenceMatch[1]);
  }

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const upperLines = lines.map((line) => stripDiacritics(line).toUpperCase());

  for (let index = 0; index < upperLines.length; index += 1) {
    const line = upperLines[index];
    if (!line.includes('DOMICILIU') && !line.includes('ADRESA') && !line.includes('ADRESA DE DOMICILIU')) continue;

    const parts: string[] = [];
    const sameLine = lines[index]
      .replace(/.*(?:DOMICILIU|ADRESA(?: DE DOMICILIU)?)[:\s]*/i, '')
      .trim();

    if (sameLine) parts.push(sameLine);

    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 8); nextIndex += 1) {
      const candidate = lines[nextIndex].trim();
      const upperCandidate = upperLines[nextIndex];
      if (!candidate) break;
      if (
        upperCandidate.includes('NUME') ||
        upperCandidate.includes('CNP') ||
        upperCandidate.includes('SERIA') ||
        upperCandidate.includes('EMIS') ||
        upperCandidate.includes('DOCUMENT') ||
        upperCandidate.includes('VALID')
      ) {
        break;
      }
      parts.push(candidate);
      if (/[0-9]/.test(candidate) && /(?:STR|STRADA|BD|BULEVARD|ALEEA|NR|AP|BL|SC|ET|JUD|MUN|SAT|COM)/i.test(candidate)) {
        if (parts.length >= 2) break;
      }
    }

    const joined = normalizeAddressValue(parts.join(' '));
    if (joined) return joined;
  }

  const inlineMatch = normalized.match(/(?:domicili(?:u|ul)|adresa(?: de domiciliu)?)[:\s]+(.+)/i);
  return inlineMatch ? normalizeAddressValue(inlineMatch[1]) : '';
}

export function parseRomanianIdCard(rawText: string): ParsedIdCard {
  const normalizedText = normalizeWhitespace(rawText);
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean);
  const personalNumericCode = extractCnp(normalizedText);
  const identity = extractSeriesAndNumber(normalizedText);
  const name = extractNameFromMrz(rawText) || extractName(lines);
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

export function parseRomanianElectronicIdCard(rawText: string): ParsedIdCard {
  const normalizedText = normalizeWhitespace(rawText);
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean);
  const personalNumericCode = extractCnp(normalizedText);
  const name = extractName(lines);
  let identityDocumentNumber = '';
  const normalizedLines = lines.map((line) => stripDiacritics(line).toUpperCase());

  for (let index = 0; index < normalizedLines.length; index += 1) {
    const line = normalizedLines[index];
    const isDocumentLabel =
      line.includes('NR. DOCUMENT') ||
      line.includes('NR DOCUMENT') ||
      line.includes('DOCUMENT NO') ||
      line.includes('DOCUMENT NUMBER');
    if (!isDocumentLabel) continue;

    const sameLineMatch = lines[index].match(/(?:NR\.?\s*DOCUMENT|DOCUMENT NO|DOCUMENT NUMBER)[:\s-]*([A-Z0-9]{6,12})/i);
    if (sameLineMatch?.[1]) {
      identityDocumentNumber = sameLineMatch[1].toUpperCase();
      break;
    }

    const nextValue = pickNextDocumentValueLine(lines, index);
    if (nextValue) {
      identityDocumentNumber = nextValue;
      break;
    }
  }

  if (!identityDocumentNumber) {
    const docNumberMatch =
      stripDiacritics(normalizedText).toUpperCase().match(/\b(?:NR\.?\s*DOCUMENT|DOCUMENT NO|DOCUMENT NUMBER)\s*[:\-]?\s*([A-Z0-9]{6,12})\b/) ||
      stripDiacritics(normalizedText).toUpperCase().match(/\b([A-Z]{2}\d{6,8})\b/);
    identityDocumentNumber = docNumberMatch?.[1] || '';
  }

  return {
    name,
    address: '',
    personalNumericCode,
    identityDocumentSeries: '',
    identityDocumentNumber,
    confidence: {
      name: name ? 0.65 : 0.1,
      address: 0.1,
      personalNumericCode: personalNumericCode ? 0.95 : 0.1,
      identityDocumentSeries: 0.1,
      identityDocumentNumber: identityDocumentNumber ? 0.8 : 0.1,
    },
    rawText,
    normalizedText,
  };
}

export function parseRomanianAddressProof(rawText: string): ParsedAddressProof {
  const normalizedText = normalizeWhitespace(rawText);
  const address = extractAddressFromFreeText(normalizedText);

  return {
    address,
    confidence: {
      address: address ? 0.8 : 0.1,
    },
    rawText,
    normalizedText,
  };
}
