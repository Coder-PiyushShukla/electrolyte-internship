const { getAllCustomers, addCustomer, updateCustomer, deactivateCustomer } = require('../config/companyData');
const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    const data = await getAllCustomers();
    res.json({ data });
  } catch (err) {
    console.error('List companies error:', err);
    res.status(500).json({ error: 'Failed to list companies.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { brand, companyName, address, phone, gstin, email, hsnCode, defaultRate } = req.body;
    if (!brand || !brand.trim()) return res.status(400).json({ error: 'Brand key is required.' });
    if (!companyName || !companyName.trim()) return res.status(400).json({ error: 'Company name is required.' });
    if (!address || !address.trim()) return res.status(400).json({ error: 'Address is required.' });
    if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone number is required.' });
    if (!gstin || !gstin.trim()) return res.status(400).json({ error: 'GSTIN is required.' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
    const created = await addCustomer({ brand, companyName, address, phone, gstin, email, hsnCode, defaultRate });
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create company error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A company with this Brand Key already exists.' });
    res.status(500).json({ error: 'Failed to create company.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { brand } = req.params;
    const updated = await updateCustomer(brand, req.body);
    if (!updated) return res.status(404).json({ error: 'Company not found or no valid fields provided.' });
    res.json({ data: updated });
  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ error: 'Failed to update company.' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const { brand } = req.params;
    const updated = await deactivateCustomer(brand);
    if (!updated) return res.status(404).json({ error: 'Company not found.' });
    res.json({ data: updated });
  } catch (err) {
    console.error('Deactivate company error:', err);
    res.status(500).json({ error: 'Failed to deactivate company.' });
  }
};

exports.reactivate = async (req, res) => {
  try {
    const { brand } = req.params;
    const res2 = await db.query(
      `UPDATE brands SET is_active = TRUE, updated_at = NOW() WHERE brand_key = $1 RETURNING *`,
      [brand]
    );
    if (res2.rows.length === 0) return res.status(404).json({ error: 'Company not found.' });
    const row = res2.rows[0];
    res.json({
      data: {
        brand: row.brand_key,
        companyName: row.company_name,
        address: row.address || '',
        phone: row.phone || '',
        gstin: row.gstin || '',
        email: row.email || '',
        hsnCode: row.hsn_code || '',
        defaultRate: Number(row.default_rate || 0),
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('Reactivate company error:', err);
    res.status(500).json({ error: 'Failed to reactivate company.' });
  }
};
