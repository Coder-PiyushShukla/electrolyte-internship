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
      is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
      gstin          VARCHAR(50),
      email          VARCHAR(255),
      hsn_code       VARCHAR(20),
      default_rate   NUMERIC(10, 2) DEFAULT 0,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    DO $$
    BEGIN
      IF to_regclass('public.pcb_transactions') IS NOT NULL THEN
        ALTER TABLE pcb_transactions DROP CONSTRAINT IF EXISTS pcb_transactions_brand_name_check;
      END IF;
    END $$;
  `);

  await db.query(`
    INSERT INTO brands (brand_key, company_name, address, phone, gstin, email, hsn_code, default_rate)
    VALUES
      (
        'Atomberg',
        'Atomberg Technologies Pvt. Ltd.',
        'Mind Space Shelters LLP/Vithai Developers LLP, Gate No 51-59, Opp-Dana india, Bhamboli, Chakan, Pune - 410507',
        '+91 7738590086',
        '27AAKCA4836H1ZI',
        '',
        '85340000',
        70
      ),
      (
        'Bajaj',
        'Bajaj Electricals Limited',
        'Shed B7, Galal No.1,2,3,4,5,6,7A,7B & 8A, Antariksh Logidrome, Mumbai-Nasik Highway, Amane Village, Bhiwandi, Maharashtra - 421302',
        '+91 9833999575',
        '27AAACB2484Q1Z8',
        '',
        '85166000',
        80
      )
    ON CONFLICT (brand_key) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      address = EXCLUDED.address,
      phone = EXCLUDED.phone,
      gstin = EXCLUDED.gstin,
      email = EXCLUDED.email,
      hsn_code = EXCLUDED.hsn_code,
      default_rate = EXCLUDED.default_rate,
      updated_at = NOW(),
      is_active = COALESCE(brands.is_active, TRUE)
  `);

  await db.query(`
    DO $$
    BEGIN
      DELETE FROM brands WHERE LOWER(brand_key) = 'havells';
      IF to_regclass('public.pcb_transactions') IS NOT NULL THEN
        DELETE FROM pcb_transactions WHERE LOWER(brand_name) = 'havells';
      END IF;
      IF to_regclass('public.lot_counters') IS NOT NULL THEN
        DELETE FROM lot_counters WHERE LOWER(brand_name) = 'havells';
      END IF;
      IF to_regclass('public.outward_lot_counter') IS NOT NULL THEN
        DELETE FROM outward_lot_counter WHERE LOWER(brand_name) = 'havells';
      END IF;
      IF to_regclass('public.outward_dispatches') IS NOT NULL THEN
        DELETE FROM outward_dispatches WHERE LOWER(brand_name) = 'havells';
      END IF;
    END $$;
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
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

// Update an existing company (partial fields allowed)
async function updateCustomer(brand, fields = {}) {
  await ensureTable();
  const allowed = ['company_name','address','phone','gstin','email','hsn_code','default_rate','is_active'];
  const sets = [];
  const vals = [];
  let idx = 1;
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = $${idx}`);
    vals.push(fields[key]);
    idx++;
  }
  if (sets.length === 0) return null;
  vals.push(brand);
  const q = `UPDATE brands SET ${sets.join(',')}, updated_at = NOW() WHERE brand_key = $${idx} RETURNING *`;
  const res = await db.query(q, vals);
  if (res.rows.length === 0) return null;
  return rowToCustomer(res.rows[0]);
}

// Soft-deactivate a company
async function deactivateCustomer(brand) {
  await ensureTable();
  const res = await db.query(`UPDATE brands SET is_active = FALSE, updated_at = NOW() WHERE brand_key = $1 RETURNING *`, [brand]);
  if (res.rows.length === 0) return null;
  return rowToCustomer(res.rows[0]);
}

module.exports = { COMPANY, getCompany, getCustomer, getAllCustomers, addCustomer, updateCustomer, deactivateCustomer };
