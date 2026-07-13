const db = require('../config/db');

const GSTIN_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
};

async function ensureEwayRuleTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS eway_bill_rules (
      id SERIAL PRIMARY KEY,
      supplier_state VARCHAR(100) NOT NULL,
      movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('INTRA_STATE', 'INTER_STATE')),
      threshold_amount NUMERIC(12, 2) NOT NULL,
      portal_url TEXT NOT NULL DEFAULT 'https://ewaybillgst.gov.in/',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (supplier_state, movement_type)
    )
  `);

  await db.query(`
    INSERT INTO eway_bill_rules (supplier_state, movement_type, threshold_amount, portal_url)
    VALUES
      ('Maharashtra', 'INTRA_STATE', 100000, 'https://ewaybillgst.gov.in/'),
      ('Maharashtra', 'INTER_STATE', 50000, 'https://ewaybillgst.gov.in/')
    ON CONFLICT (supplier_state, movement_type) DO NOTHING
  `);
}

function getStateFromGstin(gstin) {
  const normalized = String(gstin || '').trim().toUpperCase();
  const code = normalized.slice(0, 2);
  if (!/^\d{2}$/.test(code)) return '';
  return GSTIN_STATE_CODES[code] || '';
}

async function evaluateEwayRequirement({ supplierGstin, customerGstin, totalAmount }) {
  await ensureEwayRuleTable();

  const supplierState = getStateFromGstin(supplierGstin) || 'Maharashtra';
  const customerState = getStateFromGstin(customerGstin) || '';
  const movementType = supplierState && customerState && supplierState.toLowerCase() === customerState.toLowerCase()
    ? 'INTRA_STATE'
    : 'INTER_STATE';

  const ruleResult = await db.query(
    `SELECT * FROM eway_bill_rules
     WHERE supplier_state = $1 AND movement_type = $2 AND is_active = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [supplierState, movementType]
  );
  const rule = ruleResult.rows[0] || {
    threshold_amount: movementType === 'INTRA_STATE' ? 100000 : 50000,
    portal_url: 'https://ewaybillgst.gov.in/',
  };
  const thresholdAmount = Number(rule.threshold_amount || 0);
  const consignmentValue = Number(totalAmount || 0);
  const required = consignmentValue > thresholdAmount;

  return {
    supplierState,
    customerState,
    movementType,
    thresholdAmount,
    consignmentValue,
    required,
    portalUrl: rule.portal_url || 'https://ewaybillgst.gov.in/',
    reason: required
      ? `Consignment value exceeds applicable threshold`
      : `Consignment value below applicable threshold`,
  };
}

module.exports = { ensureEwayRuleTable, evaluateEwayRequirement, getStateFromGstin };
