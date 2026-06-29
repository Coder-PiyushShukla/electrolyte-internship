// ─── Outward Controller ───
const db = require('../config/db');
const { getFinancialYear } = require('../utils/financialYear');
const { getCompany, getCustomer, getAllCustomers } = require('../config/companyData');
const { getItemsForBrand, lookupDescription } = require('../config/productData');

// Ensure outward tables exist (safety net if migration wasn't run manually).
async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS outward_dc_counter (
      financial_year   VARCHAR(10) PRIMARY KEY,
      last_dc_no       INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS outward_lot_counter (
      financial_year   VARCHAR(10) NOT NULL,
      brand_name       VARCHAR(50) NOT NULL,
      last_lot_no      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (financial_year, brand_name)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS outward_dispatches (
      id                SERIAL PRIMARY KEY,
      dc_no             VARCHAR(50)  NOT NULL UNIQUE,
      lot_no            INTEGER      NOT NULL,
      financial_year    VARCHAR(10)  NOT NULL,
      brand_name        VARCHAR(50)  NOT NULL,
      company_name      VARCHAR(255) NOT NULL,
      company_address   TEXT,
      phone_no          VARCHAR(50),
      gstin             VARCHAR(50),
      vehicle_no        VARCHAR(50),
      courier_partner   VARCHAR(255),
      challan_date      DATE         NOT NULL,
      remarks           TEXT,
      total_qty         INTEGER      NOT NULL DEFAULT 0,
      total_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
      pdf_path          TEXT,
      created_by        VARCHAR(100),
      created_at        TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS outward_dispatch_items (
      id              SERIAL PRIMARY KEY,
      dispatch_id     INTEGER NOT NULL REFERENCES outward_dispatches(id) ON DELETE CASCADE,
      item_code       VARCHAR(100) NOT NULL,
      description     TEXT,
      status          VARCHAR(10) NOT NULL CHECK (status IN ('OK', 'SCRAP')),
      hsn_code        VARCHAR(20),
      unit            VARCHAR(20) DEFAULT 'Nos',
      quantity        INTEGER NOT NULL CHECK (quantity >= 0),
      rate            NUMERIC(10, 2) DEFAULT 0,
      amount          NUMERIC(12, 2) DEFAULT 0
    )
  `);
}

// ════════════════════════════════════════════════════════════
// Master data endpoints
// ════════════════════════════════════════════════════════════

// GET /api/company
exports.getCompanyInfo = async (req, res) => {
  res.json(getCompany());
};

// GET /api/customers
exports.getCustomers = async (req, res) => {
  res.json({ data: getAllCustomers() });
};

// GET /api/products?company=Bajaj
exports.getProducts = async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company query param is required.' });

  const items = getItemsForBrand(company);
  const customer = getCustomer(company);
  const data = Object.entries(items).map(([itemCode, description]) => ({
    itemCode,
    description,
    hsnCode: customer?.hsnCode || '',
    unit: 'Nos',
    rate: customer?.defaultRate || 0,
  }));
  res.json({ data });
};

// ════════════════════════════════════════════════════════════
// Auto-generation: DC No. and Lot No.
// ════════════════════════════════════════════════════════════

// GET /api/outward/next-dc — peek the next DC number (doesn't increment)
exports.peekNextDc = async (req, res) => {
  try {
    await ensureTables();
    const fy = getFinancialYear();
    const result = await db.query(
      'SELECT last_dc_no FROM outward_dc_counter WHERE financial_year = $1',
      [fy]
    );
    const last = result.rows.length > 0 ? result.rows[0].last_dc_no : 0;
    const next = last + 1;
    const dcNo = `ES/${fy}/DC${String(next).padStart(3, '0')}`;
    res.json({ financialYear: fy, nextDcNo: dcNo });
  } catch (err) {
    console.error('Peek next DC error:', err);
    res.status(500).json({ error: 'Failed to compute next DC number.' });
  }
};

// GET /api/lot?company=Bajaj — peek the next lot number for outward (doesn't increment)
exports.peekNextLot = async (req, res) => {
  try {
    await ensureTables();
    const { company } = req.query;
    if (!company) return res.status(400).json({ error: 'company query param is required.' });

    const fy = getFinancialYear();
    const result = await db.query(
      'SELECT last_lot_no FROM outward_lot_counter WHERE financial_year = $1 AND brand_name = $2',
      [fy, company]
    );
    const last = result.rows.length > 0 ? result.rows[0].last_lot_no : 0;
    res.json({ financialYear: fy, brand: company, nextLotNo: last + 1 });
  } catch (err) {
    console.error('Peek next lot error:', err);
    res.status(500).json({ error: 'Failed to compute next lot number.' });
  }
};

// ════════════════════════════════════════════════════════════
// Inventory validation helper
// ════════════════════════════════════════════════════════════

// Returns total received quantity for an item_code from Inward records.
// We use pcb_transactions (in_ward) as the authoritative Inward ledger,
// keyed by part_code.
async function getInwardReceivedQty(partCode) {
  const result = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM pcb_transactions
     WHERE part_code = $1 AND transaction_type = 'in_ward'`,
    [partCode]
  );
  return parseInt(result.rows[0].total, 10) || 0;
}

// Returns total already-dispatched quantity (OK + SCRAP, across all past
// outward dispatches) for an item_code, so we can check remaining inventory.
async function getOutwardDispatchedQty(itemCode) {
  const result = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM outward_dispatch_items
     WHERE item_code = $1`,
    [itemCode]
  );
  return parseInt(result.rows[0].total, 10) || 0;
}

// GET /api/outward/inventory-check?itemCode=971039
// Returns received / already-dispatched / remaining for a single item code.
// Used by the frontend to show live remaining-inventory feedback as the
// operator fills the dispatch table.
exports.inventoryCheck = async (req, res) => {
  try {
    const { itemCode } = req.query;
    if (!itemCode) return res.status(400).json({ error: 'itemCode is required.' });

    const received = await getInwardReceivedQty(itemCode);
    const dispatched = await getOutwardDispatchedQty(itemCode);
    res.json({ itemCode, received, dispatched, remaining: received - dispatched });
  } catch (err) {
    console.error('Inventory check error:', err);
    res.status(500).json({ error: 'Failed to check inventory.' });
  }
};

// ════════════════════════════════════════════════════════════
// Dispatch save — validates duplicates + inventory, then increments
// DC No. and Lot No. counters atomically, and persists the dispatch.
// ════════════════════════════════════════════════════════════

// POST /api/outward/dispatches
exports.createDispatch = async (req, res) => {
  try {
    await ensureTables();
    const {
      brand, companyName, companyAddress, phoneNo, gstin,
      vehicleNo, courierPartner, challanDate, remarks, items,
    } = req.body;

    // ── Basic validation ──
    const errors = [];
    if (!brand) errors.push('Brand/company is required.');
    if (!challanDate) errors.push('Challan date is required.');
    if (!Array.isArray(items) || items.length === 0) errors.push('At least one item row is required.');
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    // ── Rule: only one OK row and one SCRAP row per item code ──
    const seen = new Set();
    for (const item of items) {
      const key = `${item.itemCode}::${item.status}`;
      if (seen.has(key)) {
        return res.status(400).json({
          error: `An ${item.status} entry already exists for item ${item.itemCode}. Edit the existing row instead.`,
        });
      }
      seen.add(key);
    }

    // ── Rule: total dispatched (OK + SCRAP, this dispatch + all past dispatches)
    //          per item code must never exceed Inward received quantity ──
    const qtyByItemThisDispatch = {};
    for (const item of items) {
      const qty = parseInt(item.quantity, 10) || 0;
      qtyByItemThisDispatch[item.itemCode] = (qtyByItemThisDispatch[item.itemCode] || 0) + qty;
    }

    for (const [itemCode, qtyThisDispatch] of Object.entries(qtyByItemThisDispatch)) {
      const received = await getInwardReceivedQty(itemCode);
      const alreadyDispatched = await getOutwardDispatchedQty(itemCode);
      const totalAfter = alreadyDispatched + qtyThisDispatch;
      if (totalAfter > received) {
        const remaining = received - alreadyDispatched;
        return res.status(400).json({
          error: `Cannot dispatch ${qtyThisDispatch} unit(s) of "${itemCode}". Only ${remaining} unit(s) remain available from Inward inventory (received ${received}, already dispatched ${alreadyDispatched}).`,
        });
      }
    }

    // ── Atomically increment DC No. and Lot No. counters, then insert ──
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const fy = getFinancialYear();

      // DC No. — global counter per financial year
      const dcResult = await client.query(
        `INSERT INTO outward_dc_counter (financial_year, last_dc_no)
         VALUES ($1, 1)
         ON CONFLICT (financial_year)
         DO UPDATE SET last_dc_no = outward_dc_counter.last_dc_no + 1
         RETURNING last_dc_no`,
        [fy]
      );
      const dcNumber = dcResult.rows[0].last_dc_no;
      const dcNo = `ES/${fy}/DC${String(dcNumber).padStart(3, '0')}`;

      // Lot No. — per brand, per financial year
      const lotResult = await client.query(
        `INSERT INTO outward_lot_counter (financial_year, brand_name, last_lot_no)
         VALUES ($1, $2, 1)
         ON CONFLICT (financial_year, brand_name)
         DO UPDATE SET last_lot_no = outward_lot_counter.last_lot_no + 1
         RETURNING last_lot_no`,
        [fy, brand]
      );
      const lotNo = lotResult.rows[0].last_lot_no;

      // Totals
      let totalQty = 0;
      let totalAmount = 0;
      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const rate = parseFloat(item.rate) || 0;
        totalQty += qty;
        totalAmount += qty * rate;
      }

      const dispatchResult = await client.query(
        `INSERT INTO outward_dispatches
          (dc_no, lot_no, financial_year, brand_name, company_name, company_address,
           phone_no, gstin, vehicle_no, courier_partner, challan_date, remarks,
           total_qty, total_amount, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          dcNo, lotNo, fy, brand, companyName, companyAddress,
          phoneNo, gstin, vehicleNo, courierPartner, challanDate, remarks || null,
          totalQty, totalAmount, req.user?.username || null,
        ]
      );
      const dispatch = dispatchResult.rows[0];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const rate = parseFloat(item.rate) || 0;
        await client.query(
          `INSERT INTO outward_dispatch_items
            (dispatch_id, item_code, description, status, hsn_code, unit, quantity, rate, amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [dispatch.id, item.itemCode, item.description || lookupDescription(brand, item.itemCode),
            item.status, item.hsnCode, item.unit || 'Nos', qty, rate, qty * rate]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({ message: 'Dispatch created.', data: { ...dispatch, items } });
    } catch (innerErr) {
      await client.query('ROLLBACK');
      throw innerErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create dispatch error:', err);
    res.status(500).json({ error: `Failed to create dispatch: ${err.message}` });
  }
};

// GET /api/outward/dispatches — list all outward dispatches
exports.getDispatches = async (req, res) => {
  try {
    await ensureTables();
    const result = await db.query(
      'SELECT * FROM outward_dispatches ORDER BY created_at DESC'
    );
    res.json({ count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Get dispatches error:', err);
    res.status(500).json({ error: 'Failed to fetch dispatches.' });
  }
};

// GET /api/outward/dispatches/:id — full dispatch with items
exports.getDispatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatchResult = await db.query('SELECT * FROM outward_dispatches WHERE id = $1', [id]);
    if (dispatchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dispatch not found.' });
    }
    const itemsResult = await db.query('SELECT * FROM outward_dispatch_items WHERE dispatch_id = $1 ORDER BY id', [id]);
    res.json({ data: { ...dispatchResult.rows[0], items: itemsResult.rows } });
  } catch (err) {
    console.error('Get dispatch error:', err);
    res.status(500).json({ error: 'Failed to fetch dispatch.' });
  }
};

module.exports.getInwardReceivedQty = getInwardReceivedQty;
module.exports.getOutwardDispatchedQty = getOutwardDispatchedQty;
