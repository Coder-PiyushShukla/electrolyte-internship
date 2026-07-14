// DB-backed master product list.
const db = require('../config/db');

// Basic in-memory seed to populate products table on first run.
const ATOMBERG_ITEMS = {
  SA0087: 'PCB_Main_1200mm Ozeo_GV4',
  SA0038: 'PCB_Regulator_1200mm Renesa Alpha_GV4',
  SA0039: 'PCB_Remote_1200mm Studio+_GV4',
  SA0060: 'Power PCB BL_CF_Renesa_GV3',
  SA0061: 'Power PCB WH_CF_Renesa_GV3',
  SA0010: 'Digital PCB_1200mm_Renesa Smart+_GV3',
  SA0011: 'Consolidate PCB GV3_CF_Renesa+_GV3',
  SA0022: 'Main PCB_CF_1400mm Efficio_Reg 35W_GV2',
  SA0021: 'Main PCB_CF_1200mm Efficio_Reg_28W_GV2',
  SA0019: 'Consolidate PCB GV2_CF_Efficio_GV2',
};

const BAJAJ_ITEMS = {
  974267: 'MAIN PCB MAJESTY SLIM INDUCTION COOKER',
  974268: 'CONTROL PCB MAJESTY SLIM INDUCTION',
  974284: 'DISPLAY PCB ASSLY ICX 160 TS INDUCTION',
  974290: 'DISPLAY PCB ASSLY ICX 190 TS INDUCTION',
  974295: 'DISPLAY PCB ASSLY ICX 200 FP INDUCTION',
  971054: 'MAIN PCB ASSLY SPLENDID 120 TS',
  971055: 'DISPLAY PCB ASSLY SPLENDID 120 TS',
  971064: 'MAIN PCB ASSLY SPLENDID 140 TS',
  971065: 'DISPLAY PCB ASSLY SPLENDID 140 TS',
  971039: 'MAIN PCB IRX 220F INFRARED COOKTOP',
  971040: 'DISPLAY PCB IRX 220F INFRARED COOKTOP',
  971084: 'DISPLAY PCB ICX 160 TS NEO',
  971079: 'MAIN PCB ASSLY ICX 160 TS NEO',
  971090: 'DISPLAY PCB ASSLY ICX 190 FS INDUCTION',
  971089: 'MAIN PCB ASSLY ICX 190 FS INDUCTION',
  974299: 'MAIN PCB ICX130/160/190TS/200FP INDUCTION',
  9252950: 'MAIN PCB ASSLY CLASSICO SLEEK PLUS 1200',
  974157: 'PCB ASSEMBLY (974157)',
  974156: 'PCB ASSEMBLY (974156)',
  974167: 'PCB ASSEMBLY (974167)',
};

const ALL_ITEMS = { Atomberg: ATOMBERG_ITEMS, Bajaj: BAJAJ_ITEMS };

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      company_key VARCHAR(50) NOT NULL REFERENCES brands(brand_key) ON DELETE CASCADE,
      item_code VARCHAR(100) NOT NULL,
      description TEXT,
      unit VARCHAR(20) DEFAULT 'Nos',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_key, item_code)
    )
  `);

  // Seed initial items for known brands if table is empty for that brand
  for (const [brand, items] of Object.entries(ALL_ITEMS)) {
    const exist = await db.query('SELECT 1 FROM products WHERE company_key = $1 LIMIT 1', [brand]);
    if (exist.rows.length === 0) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        for (const [code, desc] of Object.entries(items)) {
          await client.query(
            `INSERT INTO products (company_key, item_code, description, unit) VALUES ($1,$2,$3,'Nos') ON CONFLICT (company_key,item_code) DO NOTHING`,
            [brand, String(code).trim(), desc]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }
  }
}

function rowToProduct(row) {
  return {
    id: row.id,
    itemCode: row.item_code,
    description: row.description || '',
    unit: row.unit || 'Nos',
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getItemsForBrand(brand) {
  if (!brand) return {};
  await ensureTable();
  const res = await db.query('SELECT item_code, description FROM products WHERE company_key = $1 AND is_active = TRUE ORDER BY item_code', [brand]);
  const map = {};
  for (const r of res.rows) map[r.item_code] = r.description;
  return map;
}

async function lookupDescription(brand, itemCode) {
  if (!brand || !itemCode) return '';
  await ensureTable();
  const res = await db.query('SELECT description FROM products WHERE company_key = $1 AND item_code = $2 LIMIT 1', [brand, String(itemCode).trim()]);
  if (res.rows.length === 0) return '';
  return res.rows[0].description || '';
}

async function getProductsByBrand(brand) {
  await ensureTable();
  const res = await db.query('SELECT * FROM products WHERE company_key = $1 ORDER BY item_code', [brand]);
  return res.rows.map(rowToProduct);
}

async function addProduct(brand, { itemCode, description, unit }) {
  await ensureTable();
  const res = await db.query(
    `INSERT INTO products (company_key, item_code, description, unit) VALUES ($1,$2,$3,$4) RETURNING *`,
    [brand, String(itemCode).trim(), description || '', unit || 'Nos']
  );
  return rowToProduct(res.rows[0]);
}

async function updateProduct(id, fields = {}) {
  await ensureTable();
  const allowed = ['description','unit','is_active','item_code'];
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
  vals.push(id);
  const q = `UPDATE products SET ${sets.join(',')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  const res = await db.query(q, vals);
  if (res.rows.length === 0) return null;
  return rowToProduct(res.rows[0]);
}

async function deactivateProduct(id) {
  await ensureTable();
  const res = await db.query('UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [id]);
  if (res.rows.length === 0) return null;
  return rowToProduct(res.rows[0]);
}

module.exports = {
  ATOMBERG_ITEMS,
  BAJAJ_ITEMS,
  ALL_ITEMS,
  ensureTable,
  getItemsForBrand,
  lookupDescription,
  getProductsByBrand,
  addProduct,
  updateProduct,
  deactivateProduct,
};
