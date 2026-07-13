// ─── E-Way Bill API helpers ───
import api from './api';

export async function getEwayBill(dispatchId) {
    const { data } = await api.get(`/outward/dispatches/${dispatchId}/eway`);
    return data.data; // null if not yet saved
}

export async function saveEwayBill(dispatchId, payload) {
    const { data } = await api.post(`/outward/dispatches/${dispatchId}/eway`, payload);
    return data.data;
}

export async function uploadEwayBillPdf(dispatchId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(`/outward/dispatches/${dispatchId}/eway/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
}

export async function downloadEwayBillPdf(dispatchId, fileName) {
    const response = await api.get(`/outward/dispatches/${dispatchId}/eway/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || `eway-bill-${dispatchId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

// Opens the generated PDF in a new tab and best-effort triggers the
// browser's print dialog. If the browser blocks auto-print (varies by
// browser/PDF viewer), the PDF still opens ready for the user to print manually.
export async function printEwayBillPdf(dispatchId) {
    const response = await api.get(`/outward/dispatches/${dispatchId}/eway/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
        printWindow.addEventListener('load', () => {
            try { printWindow.print(); } catch { /* best-effort only */ }
        });
    }
}
