const { getAllCustomers, addCustomer, updateCustomer, deactivateCustomer } = require('../config/companyData');

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
    const created = await addCustomer({ brand, companyName, address, phone, gstin, email, hsnCode, defaultRate });
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create company error:', err);
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
