// ─── Financial Year Helper ───
// India's financial year runs April 1 → March 31.
// Returns a short string like "26-27" for FY 2026-27.
// If today is before April 1 of the current calendar year, we're still in
// the FY that started the previous April.

function getFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January, 3 = April

  let startYear;
  if (month >= 3) {
    // April (3) through December → FY started this calendar year
    startYear = year;
  } else {
    // January through March → FY started last calendar year
    startYear = year - 1;
  }

  const endYear = startYear + 1;
  const shortStart = String(startYear).slice(-2);
  const shortEnd = String(endYear).slice(-2);
  return `${shortStart}-${shortEnd}`;
}

module.exports = { getFinancialYear };
