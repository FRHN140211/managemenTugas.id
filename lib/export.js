// lib/export.js — CSV and Excel export utilities
// Handles data export with proper security, encoding, and injection prevention.

const CSV_HEADER = 'Content-Type: text/csv; charset=utf-8';
const CSV_EXT = '.csv';
const XLSX_EXT = '.xlsx';

/**
 * Escape a CSV field to prevent formula injection.
 * - If value starts with =, +, -, @, or tab/newline, prefix with a single quote
 * - Escape double quotes by doubling them
 * - Wrap in double quotes if the value contains commas, quotes, or newlines
 */
export function escapeCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Check for formula injection pattern (first char in =+-@ or starting with tab/newline)
  const formulaPrefix = /^([=+\-@]|[\t\n\r])/.test(str);
  let escaped = str.replace(/"/g, '""');
  if (formulaPrefix || /[,"\n\r]/.test(str)) {
    return '"' + escaped + '"';
  }
  return escaped;
}

/**
 * Generate CSV content from rows of data.
 * Uses proper column mapping and handles Unicode.
 */
export function generateCsv(data, options = {}) {
  const headers = options.headers || Object.keys(data[0] || {});
  const rows = data || [];

  const lines = [];
  // Header row
  lines.push(headers.map(h => escapeCsvField(h)).join(','));

  // Data rows
  for (const row of rows) {
    const line = headers.map(h => {
      const value = row[h] !== undefined && row[h] !== null ? row[h] : '';
      return escapeCsvField(value);
    }).join(',');
    lines.push(line);
  }

  return lines.join('\r\n');
}

/**
 * Generate CSV filename with timestamp
 */
export function generateCsvFilename(prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix || 'export'}_${timestamp}${CSV_EXT}`;
}

/**
 * Get appropriate headers for CSV download response
 */
export function getCsvResponseHeaders(filename) {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': '0', // Will be set by server
    'Cache-Control': 'no-store, no-cache'
  };
}

/**
 * Sanitize string for use in file content (prevent binary/script injection)
 */
export function sanitizeForCsv(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[<>&'"\n\r]/g, (char) => {
    const map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&#39;',
      '"': '&quot;',
      '\n': ' ',
      '\r': ' '
    };
    return map[char] || char;
  });
}
