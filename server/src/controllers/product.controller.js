const productData = require('../config/productData');

exports.getProductsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;
    if (!brand) return res.status(400).json({ error: 'brand is required in path.' });
    const data = await productData.getProductsByBrand(brand);
    res.json({ data });
  } catch (err) {
    console.error('Get products by brand error:', err);
    res.status(500).json({ error: 'Failed to load products.' });
  }
};

// POST /api/companies/:brand/products
// Accepts { products: [{ itemCode, description, unit }] }
exports.addProductsToBrand = async (req, res) => {
  try {
    const { brand } = req.params;
    const { products } = req.body;
    if (!brand) return res.status(400).json({ error: 'brand is required in path.' });
    if (!Array.isArray(products) || products.length === 0) return res.status(400).json({ error: 'products array is required.' });

    const created = [];
    for (const p of products) {
      const row = await productData.addProduct(brand, p);
      created.push(row);
    }
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Add products error:', err);
    res.status(500).json({ error: 'Failed to add products.' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await productData.updateProduct(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found or no valid fields provided.' });
    res.json({ data: updated });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await productData.deactivateProduct(id);
    if (!deleted) return res.status(404).json({ error: 'Product not found.' });
    res.json({ data: deleted });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
};
