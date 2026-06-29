// ─── Outward API helpers ───
import api from './api';

export async function getCompanyInfo() {
    const { data } = await api.get('/outward/company');
    return data;
}

export async function getCustomers() {
    const { data } = await api.get('/outward/customers');
    return data.data;
}

export async function getProducts(company) {
    const { data } = await api.get('/outward/products', { params: { company } });
    return data.data;
}

export async function peekNextDc() {
    const { data } = await api.get('/outward/next-dc');
    return data.nextDcNo;
}

export async function peekNextOutwardLot(company) {
    const { data } = await api.get('/outward/lot', { params: { company } });
    return data.nextLotNo;
}

export async function checkInventory(itemCode) {
    const { data } = await api.get('/outward/inventory-check', { params: { itemCode } });
    return data; // { itemCode, received, dispatched, remaining }
}

export async function createDispatch(payload) {
    const { data } = await api.post('/outward/dispatches', payload);
    return data.data;
}

export async function listDispatches() {
    const { data } = await api.get('/outward/dispatches');
    return data.data;
}

export async function getDispatch(id) {
    const { data } = await api.get(`/outward/dispatches/${id}`);
    return data.data;
}

export async function generateDocument(dispatchId) {
    const { data } = await api.post('/outward/generate-document', { dispatchId });
    return data;
}

export async function downloadDispatchPdf(dispatchId, fileName) {
    const response = await api.get(`/outward/dispatches/${dispatchId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || `dispatch-${dispatchId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

export async function sendOutwardEmail({ dispatchId, to }) {
    const { data } = await api.post('/outward/send-email', { dispatchId, to });
    return data;
}
