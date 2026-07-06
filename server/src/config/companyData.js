// ─── Company & Customer Master Data ───
// Own company info stays hardcoded (per original request).
// Customer companies ("brands") now live in the `brands` DB table so new
// companies can be added from the UI instead of editing this file.

const db = require('../config/db');

// ── Electrolyte Solutions (your own company) - Section 1 of the PDF ──
const COMPANY = {
  companyName: 'Electrolyte Solutions',
  address: 'Unit No. 11, 3rd floor, B-Wing, Gami Industrial Park, Plot Number: C-39-A, TTC Industrial Area Pawane MIDC, Navi Mumbai - 400710',
  phone: '+91 9029352208',
  email: 'info@electrolytesolutions.in', // placeholder - update with real email
  gstin: '27AJYPY7934L1ZS',
  website: '', // optional, leave blank if none
  logo: '', // optional - path/URL to a logo image, leave blank if none
  terms: [
    'Subject to Navi Mumbai Jurisdiction.',
    'Our responsibility ceases as soon as the goods leave our premises.',
    'Goods once sold will not be taken back.',
    'Delivery ex-premises.',
    'Delivery challan is used for transportation purpose. (Not for Sale)',
  ],
};

// Ensure the brands table exists (safety net if migration wasn't run manually).
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS brands (
      brand_key      VARCHAR(50)  PRIMARY KEY,
      company_name   VARCHAR(255) NOT NULL,
      address        TEXT,
      phone          VARCHAR(50),
      gstin          VARCHAR(50),
      email          VARCHAR(255),
      hsn_code       VARCHAR(20),
      default_rate   NUMERIC(10, 2) DEFAULT 0,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function rowToCustomer(row) {
  return {
    brand: row.brand_key,
    companyName: row.company_name,
    address: row.address || '',
    phone: row.phone || '',
    gstin: row.gstin || '',
    email: row.email || '',
    hsnCode: row.hsn_code || '',
    defaultRate: Number(row.default_rate || 0),
  };
}

function getCompany() {
  return COMPANY;
}

// Returns a single customer/brand's details, or null if not found.
async function getCustomer(brand) {
  if (!brand) return null;
  await ensureTable();
  const result = await db.query('SELECT * FROM brands WHERE brand_key = $1', [brand]);
  if (result.rows.length === 0) return null;
  return rowToCustomer(result.rows[0]);
}

// Returns all customers/brands, for populating dropdowns.
async function getAllCustomers() {
  await ensureTable();
  const result = await db.query('SELECT * FROM brands ORDER BY brand_key ASC');
  return result.rows.map(rowToCustomer);
}

// Adds a brand-new customer/company. Throws if the brand key already exists.
async function addCustomer({ brand, companyName, address, phone, gstin, email, hsnCode, defaultRate }) {
  await ensureTable();
  const result = await db.query(
    `INSERT INTO brands (brand_key, company_name, address, phone, gstin, email, hsn_code, default_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      brand.trim(),
      companyName.trim(),
      address || '',
      phone || '',
      gstin || '',
      email || '',
      hsnCode || '',
      defaultRate || 0,
    ]
  );
  return rowToCustomer(result.rows[0]);
}

module.exports = { COMPANY, getCompany, getCustomer, getAllCustomers, addCustomer };
