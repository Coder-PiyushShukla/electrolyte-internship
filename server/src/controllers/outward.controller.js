// ─── Outward Controller ───
const db = require('../config/db');
const { getFinancialYear } = require('../utils/financialYear');
const { getCompany, getCustomer, getAllCustomers, addCustomer } = require('../config/companyData');
const { getItemsForBrand, lookupDescription } = require('../config/productData');
const { createNotification, TYPES } = require('../services/notificationService');
const { evaluateEwayRequirement } = require('../utils/ewayRules');

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
      eway_required     BOOLEAN      NOT NULL DEFAULT FALSE,
      eway_status       VARCHAR(30)  NOT NULL DEFAULT 'NOT_REQUIRED',
      eway_movement_type VARCHAR(20),
      eway_threshold_amount NUMERIC(12, 2),
      eway_portal_url   TEXT,
      eway_reason       TEXT,
      created_by        VARCHAR(100),
      created_at        TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_required BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_status VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED'`);
  await db.query(`ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_movement_type VARCHAR(20)`);
  await db.query(`ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_threshold_amount NUMERIC(12, 2)`);
  await db.query(`ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_portal_url TEXT`);
  await db.query(`ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_reason TEXT`);
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
  try {
    const data = await getAllCustomers();
    res.json({ data });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: 'Failed to load customer list.' });
  }
};

// POST /api/customers - add a brand-new company/customer
exports.createCustomer = async (req, res) => {
  try {
    const { brand, companyName, address, phone, gstin, email, hsnCode, defaultRate } = req.body;

    if (!brand || !brand.trim()) return res.status(400).json({ error: 'Company short name (brand) is required.' });
    if (!companyName || !companyName.trim()) return res.status(400).json({ error: 'Full company name is required.' });

    const existing = await getCustomer(brand.trim());
    if (existing) return res.status(409).json({ error: `A company named "${brand.trim()}" already exists.` });

    const created = await addCustomer({ brand, companyName, address, phone, gstin, email, hsnCode, defaultRate });
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to add new company.' });
  }
};

// GET /api/products?company=Bajaj
exports.getProducts = async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company query param is required.' });

  try {
    const items = await getItemsForBrand(company);
    const customer = await getCustomer(company);
    const data = Object.entries(items).map(([itemCode, description]) => ({
      itemCode,
      description,
      hsnCode: customer?.hsnCode || '',
      unit: 'Nos',
      rate: customer?.defaultRate || 0,
    }));
    res.json({ data });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to load products.' });
  }
};

// ════════════════════════════════════════════════════════════
// Auto-generation: DC No. and Lot No.
// ════════════════════════════════════════════════════════════

// GET /api/outward/next-dc - peek the next DC number (doesn't increment)
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

// GET /api/lot?company=Bajaj - peek the next lot number for outward (doesn't increment)
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
// outward dispatches) for an item_code (part_code), so we can check remaining
// inventory. Reads from pcb_transactions out_ward - the same table that
// createDispatch writes to - so inward and outward are always consistent.
async function getOutwardDispatchedQty(itemCode) {
  const result = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM pcb_transactions
     WHERE part_code = $1 AND transaction_type = 'out_ward'`,
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
// Dispatch save - validates duplicates + inventory, then increments
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

      // DC No. - global counter per financial year
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

      // Lot No. - per brand, per financial year
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

      const ewayInfo = await evaluateEwayRequirement({
        supplierGstin: getCompany().gstin,
        customerGstin: gstin,
        totalAmount,
      });

      const dispatchResult = await client.query(
        `INSERT INTO outward_dispatches
          (dc_no, lot_no, financial_year, brand_name, company_name, company_address,
           phone_no, gstin, vehicle_no, courier_partner, challan_date, remarks,
           total_qty, total_amount, eway_required, eway_status, eway_movement_type,
           eway_threshold_amount, eway_portal_url, eway_reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [
          dcNo, lotNo, fy, brand, companyName, companyAddress,
          phoneNo, gstin, vehicleNo, courierPartner, challanDate, remarks || null,
          totalQty, totalAmount, ewayInfo.required, ewayInfo.required ? 'PENDING' : 'NOT_REQUIRED',
          ewayInfo.movementType, ewayInfo.thresholdAmount, ewayInfo.portalUrl, ewayInfo.reason, req.user?.username || null,
        ]
      );
      const dispatch = dispatchResult.rows[0];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const rate = parseFloat(item.rate) || 0;

        // Insert into outward_dispatch_items (dispatch record)
        await client.query(
          `INSERT INTO outward_dispatch_items
            (dispatch_id, item_code, description, status, hsn_code, unit, quantity, rate, amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [dispatch.id, item.itemCode, item.description || lookupDescription(brand, item.itemCode),
            item.status, item.hsnCode, item.unit || 'Nos', qty, rate, qty * rate]
        );

        // Also insert into pcb_transactions as out_ward so inventory decreases
        // and getInwardReceivedQty - getOutwardDispatchedQty stays accurate.
        await client.query(
          `INSERT INTO pcb_transactions
             (brand_name, transaction_type, dc_number, transaction_date, part_code, quantity, status, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            brand,
            'out_ward',
            dcNo,
            challanDate,
            item.itemCode,
            qty,
            item.status === 'OK' ? 'ok' : 'scrap',
            `DC: ${dcNo} | Lot: ${lotNo} | ${item.status}`,
          ]
        );
      }

      await client.query('COMMIT');

      await createNotification({
        type: TYPES.DISPATCH_CREATED,
        title: 'Outward dispatch created',
        message: `${req.user?.username || 'A user'} created dispatch ${dcNo} for ${companyName} (${totalQty} pcs, ₹${totalAmount}).`,
        actor: req.user?.username,
        audience: 'all',
        metadata: { dispatchId: dispatch.id, dcNo, lotNo, brand, customer: companyName, totalQty, totalAmount },
      });

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

exports.revertDispatch = async (req, res) => {
  try {
    const { dispatchId, dcNo } = req.body;
    if (!dispatchId && !dcNo) {
      return res.status(400).json({ error: 'dispatchId or dcNo is required.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const dispatchResult = await client.query(
        dispatchId
          ? 'SELECT id, dc_no FROM outward_dispatches WHERE id = $1'
          : 'SELECT id, dc_no FROM outward_dispatches WHERE dc_no = $1',
        [dispatchId || dcNo]
      );

      if (dispatchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.json({ message: 'No saved dispatch found to revert.' });
      }

      const dispatch = dispatchResult.rows[0];
      await client.query(`DELETE FROM pcb_transactions WHERE transaction_type = 'out_ward' AND dc_number = $1`, [dispatch.dc_no]);
      await client.query(`DELETE FROM outward_dispatch_items WHERE dispatch_id = $1`, [dispatch.id]);
      await client.query(`DELETE FROM outward_eway_bills WHERE dispatch_id = $1`, [dispatch.id]);
      await client.query(`DELETE FROM outward_dispatches WHERE id = $1`, [dispatch.id]);

      await client.query('COMMIT');
      res.json({ message: `Reverted dispatch ${dispatch.dc_no}.` });
    } catch (innerErr) {
      await client.query('ROLLBACK');
      throw innerErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Revert dispatch error:', err);
    res.status(500).json({ error: `Failed to revert dispatch: ${err.message}` });
  }
};

// GET /api/outward/dispatches - list all outward dispatches
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

// GET /api/outward/dispatches/:id - full dispatch with items
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
