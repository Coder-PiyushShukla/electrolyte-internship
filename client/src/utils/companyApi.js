import api from './api';

export async function listCompanies() {
  const { data } = await api.get('/companies');
  return data.data;
}

export async function createCompany(payload) {
  const { data } = await api.post('/companies', payload);
  return data.data;
}

export async function updateCompany(brand, payload) {
  const { data } = await api.patch(`/companies/${encodeURIComponent(brand)}`, payload);
  return data.data;
}

export async function deactivateCompany(brand) {
  const { data } = await api.patch(`/companies/${encodeURIComponent(brand)}/deactivate`);
  return data.data;
}

export async function reactivateCompany(brand) {
  const { data } = await api.patch(`/companies/${encodeURIComponent(brand)}/reactivate`);
  return data.data;
}

export async function getProductsForCompany(brand) {
  const { data } = await api.get(`/companies/${encodeURIComponent(brand)}/products`);
  return data.data;
}

export async function addProductsToCompany(brand, products) {
  const { data } = await api.post(`/companies/${encodeURIComponent(brand)}/products`, { products });
  return data.data;
}

export async function addSingleProductToCompany(brand, product) {
  const { data } = await api.post(`/companies/${encodeURIComponent(brand)}/products`, { products: [product] });
  return data.data;
}

export async function updateProduct(id, payload) {
  const { data } = await api.patch(`/companies/products/${id}`, payload);
  return data.data;
}

export async function deleteProduct(id) {
  const { data } = await api.delete(`/companies/products/${id}`);
  return data.data;
}
