// src/utils/receiptScanner.js
// Client-side GCash receipt verification helpers.
// - OCR via Tesseract.js loaded from CDN at runtime (works in the browser and
//   in the Capacitor WebView, and avoids bundling the WASM engine with Metro).
// - dHash (difference hash) of the receipt image for duplicate detection.
// - Extraction and cross-checking of the reference number, amount and timestamp.

const TESSERACT_VERSION = '5.1.1';
const TESSERACT_CDN = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
const TESSERACT_WORKER = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const TESSERACT_CORE = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`;

// Language-data mirrors, tried in order. tessdata.projectnaptha.com is the
// canonical host but is unreachable on some networks, so the jsdelivr mirrors
// (same files) are used as the primary and the scan retries the others if a
// mirror fails.
const TESSERACT_LANG_PATHS = [
  'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
  'https://tessdata.projectnaptha.com/4.0.0',
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0',
];

let tesseractLoadPromise = null;

const loadTesseract = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Receipt scanning is not supported here.'));
  }
  if (window.Tesseract && window.Tesseract.createWorker) {
    return Promise.resolve(window.Tesseract);
  }
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.async = true;
      script.onload = () => {
        if (window.Tesseract && window.Tesseract.createWorker) {
          resolve(window.Tesseract);
        } else {
          reject(new Error('OCR engine failed to initialise.'));
        }
      };
      script.onerror = () => {
        tesseractLoadPromise = null;
        reject(new Error('Could not download the OCR engine. Please check your internet connection and try again.'));
      };
      document.head.appendChild(script);
    } catch (e) {
      tesseractLoadPromise = null;
      reject(e);
    }
  });
  return tesseractLoadPromise;
};

// Strip everything except digits.
export const normalizeReference = (ref) => (ref || '').replace(/[^0-9]/g, '');

// GCash reference numbers are exactly 13 digits.
export const isValidGcashReference = (ref) => /^[0-9]{13}$/.test(normalizeReference(ref));

// Extract the reference number that follows the "Ref No." / "Reference No."
// clue words GCash prints on receipts. Returns normalized digit strings.
const CLUE_PATTERNS = [
  /ref(?:erence)?\s*no\.?\s*:?\s*([0-9][0-9 ]{7,40})/gi,
  /reference\s*number\s*:?\s*([0-9][0-9 ]{7,40})/gi,
];

const extractClueReferences = (text) => {
  const found = new Set();
  CLUE_PATTERNS.forEach((re) => {
    let m;
    while ((m = re.exec(text || '')) !== null) {
      const digits = normalizeReference(m[1]);
      if (digits.length >= 8) found.add(digits);
    }
  });
  return Array.from(found);
};

// Candidate number sequences found on the receipt. Includes per-line merged
// digits so references OCR'd with stray spaces ("1234 567 8901 23") still match.
const extractDigitCandidates = (text) => {
  const candidates = new Set();
  const rawRuns = (text || '').match(/[0-9]{4,}/g) || [];
  rawRuns.forEach((run) => {
    if (run.length >= 8) candidates.add(run);
  });
  (text || '').split(/\r?\n/).forEach((line) => {
    const digits = line.replace(/[^0-9]/g, '');
    if (digits.length >= 8) candidates.add(digits);
  });
  return Array.from(candidates);
};

// Amounts like ₱1,234.56 / PHP 1,234.56 / "sent 1,234.56" / "Total 1,234.56"
//
// The ₱ sign isn't in Tesseract's default English character set (it's a
// Unicode currency glyph, not a Latin letter), so it's routinely dropped
// or mis-OCR'd — a real GCash receipt read "Total Amount Sent ₱100.00"
// and "Amount 100.00" and neither line was extracted: the currency-symbol
// patterns below need ₱/P to actually appear in the OCR text, and the old
// "total" pattern only expected an optional literal "amount:" right after
// "total", not GCash's actual wording "Total Amount **Sent**" — the extra
// word broke the match entirely. The label-anchored patterns now match
// GCash's real line wording with or without a currency symbol at all, so
// a garbled ₱ no longer sinks the whole extraction.
const extractAmounts = (text) => {
  const amounts = [];
  const patterns = [
    /[₱P]\s*([\d,]{1,9}(?:\.\d{1,2})?)/gi,
    /PHP\s*([\d,]{1,9}(?:\.\d{1,2})?)/gi,
    /sent\s+(?:you\s+)?[₱P]?\s*([\d,]{1,9}(?:\.\d{1,2})?)/gi,
    /total\s+amount\s+sent\s*:?\s*[₱P]?\s*([\d,]{1,9}(?:\.\d{1,2})?)/gi,
    /total\s+amount\s*:?\s*[₱P]?\s*([\d,]{1,9}(?:\.\d{1,2})?)/gi,
    /total\s*:?\s*[₱P]?\s*([\d,]{1,9}(?:\.\d{1,2})?)/gi,
    /^\s*amount\s*:?\s*[₱P]?\s*([\d,]{1,9}(?:\.\d{1,2})?)\s*$/gim,
  ];
  patterns.forEach((re) => {
    let m;
    while ((m = re.exec(text || '')) !== null) {
      const value = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(value) && value > 0) amounts.push(value);
    }
  });
  return amounts;
};

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const buildDate = (year, monthIdx, day, hours, minutes, ampm) => {
  let h = parseInt(hours, 10);
  if (ampm) {
    const ap = ampm.toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
  }
  return new Date(parseInt(year, 10), monthIdx, parseInt(day, 10), h, parseInt(minutes, 10));
};

// Parse a receipt timestamp like "Jan 14, 2026 · 10:30 AM", "01/14/2026 10:30 AM",
// "2026-01-14 10:30" or "10:30 AM · Jan 14, 2026". Returns a Date or null.
export const parseReceiptTime = (text) => {
  if (!text) return null;
  const patterns = [
    { re: /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s*[·,]\s*(\d{1,2}):(\d{2})\s*([AP]M)?/i, kind: 'monthFirst' },
    { re: /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[·,]\s*(\d{1,2}):(\d{2})\s*([AP]M)?/i, kind: 'slash' },
    { re: /(\d{4})-(\d{1,2})-(\d{1,2})\s*[T·,\s]\s*(\d{1,2}):(\d{2})\s*([AP]M)?/i, kind: 'iso' },
    { re: /(\d{1,2}):(\d{2})\s*([AP]M)?\s*[·,]\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i, kind: 'timeFirst' },
  ];
  for (const { re, kind } of patterns) {
    const m = (text || '').match(re);
    if (!m) continue;
    try {
      if (kind === 'monthFirst' || kind === 'timeFirst') {
        const monthIdx = MONTHS[m[kind === 'monthFirst' ? 1 : 4].slice(0, 3).toLowerCase()];
        if (monthIdx === undefined) continue;
        if (kind === 'monthFirst') return buildDate(m[3], monthIdx, m[2], m[4], m[5], m[6]);
        return buildDate(m[6], monthIdx, m[5], m[1], m[2], m[3]);
      }
      if (kind === 'slash') return buildDate(m[3], parseInt(m[1], 10) - 1, m[2], m[4], m[5], m[6]);
      if (kind === 'iso') return buildDate(m[1], parseInt(m[2], 10) - 1, m[3], m[4], m[5], m[6]);
    } catch (e) {
      /* try the next pattern */
    }
  }
  return null;
};


// Scan a receipt image with OCR. Accepts a data URI, blob URI, or https URL.
// Returns { text, digitCandidates, amounts, receiptTime }. The language model
// is tried against several mirrors so one unreachable CDN cannot block the scan.
export const scanReceipt = async (imageUri) => {
  const Tesseract = await loadTesseract();
  let lastError = null;
  for (const langPath of TESSERACT_LANG_PATHS) {
    let worker = null;
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        workerPath: TESSERACT_WORKER,
        corePath: TESSERACT_CORE,
        langPath,
      });
      const { data } = await worker.recognize(imageUri);
      const text = (data && data.text) || '';
      return {
        text,
        clueReferences: extractClueReferences(text),
        digitCandidates: extractDigitCandidates(text),
        amounts: extractAmounts(text),
        receiptTime: parseReceiptTime(text),
      };
    } catch (e) {
      lastError = e;
      console.warn('OCR attempt failed, trying the next language mirror:', langPath, e?.message || e);
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch (e) { /* ignore */ }
      }
    }
  }
  throw lastError || new Error('Receipt scanning failed.');
};

// Difference hash (dHash) of an image — used to detect the same receipt image
// being reused across orders. Resolves to a 256-bit hash string, or null when
// the image cannot be processed.
export const computeImageHash = (imageUri) =>
  new Promise((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(null);
        return;
      }
      const SIZE = 16;
      const img = document.createElement('img');
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = SIZE + 1;
          canvas.height = SIZE;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, SIZE + 1, SIZE);
          const { data } = ctx.getImageData(0, 0, SIZE + 1, SIZE);
          let hash = '';
          for (let row = 0; row < SIZE; row += 1) {
            for (let col = 0; col < SIZE; col += 1) {
              const leftIdx = (row * (SIZE + 1) + col) * 4;
              const rightIdx = leftIdx + 4;
              const leftGray = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
              const rightGray = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
              hash += leftGray > rightGray ? '1' : '0';
            }
          }
          resolve(hash);
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUri;
    } catch (e) {
      resolve(null);
    }
  });

// Cross-check a scan result against what the customer typed and the order total.
// Returns { ok, message, refMatched, amountMatched, amountFound, timeOk,
//           timeProblem, receiptTime, amounts, digitCandidates }.
export const validateReceiptScan = ({ typedReference, scan, expectedAmount, oldestAllowedTime }) => {
  const ref = normalizeReference(typedReference);
  const clueReferences = (scan && scan.clueReferences) || [];
  const digitCandidates = (scan && scan.digitCandidates) || [];
  const amounts = (scan && scan.amounts) || [];
  const receiptTime = (scan && scan.receiptTime) || null;

  // Primary check: match the typed reference against the number that follows
  // the "Ref No." / "Reference No." clue words on the receipt. If OCR could
  // not read the clue label at all, fall back to matching any number sequence.
  const refMatched = clueReferences.length > 0
    ? clueReferences.some(
        (candidate) => candidate === ref || candidate.includes(ref) || ref.includes(candidate)
      )
    : digitCandidates.some(
        (candidate) => candidate === ref || candidate.includes(ref) || ref.includes(candidate)
      );

  // The total amount sent MUST be present on the receipt and MUST equal the
  // vendor's order total. A missing amount is treated the same as a mismatch.
  let amountMatched = false;
  let amountFound = null;
  amounts.forEach((amount) => {
    if (Math.abs(amount - expectedAmount) < 0.01) {
      amountMatched = true;
      amountFound = amount;
    }
  });

  let timeOk = true;
  let timeProblem = null;
  if (receiptTime) {
    const ts = receiptTime.getTime();
    if (oldestAllowedTime && ts < oldestAllowedTime.getTime()) {
      timeOk = false;
      timeProblem = 'old';
    } else if (ts > Date.now() + 15 * 60 * 1000) {
      timeOk = false;
      timeProblem = 'future';
    }
  }

  let message = null;
  if (!refMatched) message = 'reference_mismatch';
  else if (amounts.length === 0) message = 'amount_missing';
  else if (!amountMatched) message = 'amount_mismatch';
  else if (!timeOk) message = timeProblem === 'future' ? 'future_time' : 'old_receipt';

  return {
    ok: !message,
    message,
    refMatched,
    clueReferences,
    amountMatched,
    amountFound,
    timeOk,
    timeProblem,
    receiptTime,
    amounts,
    digitCandidates,
  };
};
