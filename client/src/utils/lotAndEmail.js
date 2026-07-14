// ─── Lot Counter + Email API helpers ───
import api from './api';

// Peek at the next lot number for a brand WITHOUT incrementing it.
// Used to display the upcoming lot no. while the user is still filling the form.
export async function peekNextLotNo(brand) {
    const { data } = await api.get(`/lot-counter/${encodeURIComponent(brand)}/peek`);
    return data.nextLotNo;
}

// Atomically increment and return the new lot number for a brand.
// Call this only when the challan is actually being saved.
export async function incrementLotNo(brand) {
    const { data } = await api.post(`/lot-counter/${encodeURIComponent(brand)}/increment`);
    return data.lotNo;
}

// Send the verification report email via the server's SMTP relay.
export async function sendChallanReportEmail({ to, recipients, brand, challanNo, challanDate, lotNo, rows }) {
    const { data } = await api.post('/email/send-report', {
        to,
        recipients,
        brand,
        challanNo,
        challanDate,
        lotNo,
        rows,
    });
    return data;
}

export async function revertInwardChallan({ brand, challanNo }) {
    const { data } = await api.post('/inward/revert', { brand, challanNo });
    return data;
}

// Record inward inventory - called when the user clicks "Save Challan".
// Writes one pcb_transactions row (transaction_type = 'in_ward') per item
// line so the Outward page's inventory check sees the received stock.
// Uses physicalQty (what was actually counted) as the quantity, not challanQty.
export async function recordInwardInventory({ brand, challanNo, challanDate, lotNo, rows }) {
    const { data } = await api.post('/inward/record', {
        brand,
        challanNo,
        challanDate,
        lotNo,
        rows: rows.map((r) => ({
            itemCode: r.itemCode,
            description: r.description,
            physicalQty: r.physicalQty,
        })),
    });
    return data;
}
