// ─── Vehicle Number → State Lookup ───
// Implements the logic described in the E-Way Bill reference notes:
// a vehicle plate's first two letters are an RTO state code (e.g. "DL", "MH",
// "TN"), which maps to a state - and every state also has a two-digit GST
// state code (e.g. Delhi = 07, Maharashtra = 27) used on GSTINs and E-Way
// Bills. This utility does both lookups from just the vehicle number.

// RTO (vehicle registration) 2-letter code -> state / UT name
const RTO_TO_STATE = {
    JK: 'Jammu and Kashmir',
    HP: 'Himachal Pradesh',
    PB: 'Punjab',
    CH: 'Chandigarh',
    UK: 'Uttarakhand',
    UA: 'Uttarakhand',
    HR: 'Haryana',
    DL: 'Delhi',
    RJ: 'Rajasthan',
    UP: 'Uttar Pradesh',
    BR: 'Bihar',
    WB: 'West Bengal',
    JH: 'Jharkhand',
    OD: 'Odisha',
    OR: 'Odisha',
    CG: 'Central/Chhattisgarh',
    MP: 'Madhya Pradesh',
    SK: 'Sikkim',
    AR: 'Arunachal Pradesh',
    NL: 'Nagaland',
    MN: 'Manipur',
    MZ: 'Mizoram',
    TR: 'Tripura',
    ML: 'Meghalaya',
    AS: 'Assam',
    GJ: 'Gujarat',
    DN: 'Dadra and Nagar Haveli and Daman and Diu',
    DD: 'Dadra and Nagar Haveli and Daman and Diu',
    MH: 'Maharashtra',
    KA: 'Karnataka',
    GA: 'Goa',
    LD: 'Lakshadweep',
    KL: 'Kerala',
    TN: 'Tamil Nadu',
    PY: 'Puducherry',
    AN: 'Andaman and Nicobar Islands',
    TS: 'Telangana',
    AP: 'Andhra Pradesh',
    LA: 'Ladakh',
};

// State / UT name -> 2-digit GST state code (from the GST state code master list)
const STATE_TO_GST_CODE = {
    'Jammu and Kashmir': '01',
    'Himachal Pradesh': '02',
    'Punjab': '03',
    'Chandigarh': '04',
    'Uttarakhand': '05',
    'Haryana': '06',
    'Delhi': '07',
    'Rajasthan': '08',
    'Uttar Pradesh': '09',
    'Bihar': '10',
    'Sikkim': '11',
    'Arunachal Pradesh': '12',
    'Nagaland': '13',
    'Manipur': '14',
    'Mizoram': '15',
    'Tripura': '16',
    'Meghalaya': '17',
    'Assam': '18',
    'West Bengal': '19',
    'Jharkhand': '20',
    'Odisha': '21',
    'Central/Chhattisgarh': '22',
    'Madhya Pradesh': '23',
    'Gujarat': '24',
    'Dadra and Nagar Haveli and Daman and Diu': '26',
    'Maharashtra': '27',
    'Karnataka': '29',
    'Goa': '30',
    'Lakshadweep': '31',
    'Kerala': '32',
    'Tamil Nadu': '33',
    'Puducherry': '34',
    'Andaman and Nicobar Islands': '35',
    'Telangana': '36',
    'Andhra Pradesh': '37',
    'Ladakh': '38',
};

// GST state code -> full name (reverse lookup, e.g. to label a GSTIN's state)
const GST_CODE_TO_STATE = Object.fromEntries(
    Object.entries(STATE_TO_GST_CODE).map(([name, code]) => [code, name])
);

// Given a vehicle number like "MH12AB1234" or "DL 01 XX 1234", returns
// { rtoCode, state, gstCode } or null if the prefix isn't recognised.
export function lookupStateFromVehicle(vehicleNo) {
    if (!vehicleNo) return null;
    const cleaned = vehicleNo.replace(/\s|-/g, '').toUpperCase();
    const rtoCode = cleaned.slice(0, 2);
    const state = RTO_TO_STATE[rtoCode];
    if (!state) return null;
    return { rtoCode, state, gstCode: STATE_TO_GST_CODE[state] || null };
}

// Given a GSTIN, returns its embedded 2-digit state code + state name.
export function lookupStateFromGstin(gstin) {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.slice(0, 2);
    const state = GST_CODE_TO_STATE[code];
    if (!state) return null;
    return { gstCode: code, state };
}

// Compares two GSTINs' state codes to decide Interstate (IGST) vs
// Intrastate (CGST+SGST), per the tax-calculation rule in the reference notes.
export function getSupplyType(supplierGstin, recipientGstin) {
    const supplier = lookupStateFromGstin(supplierGstin);
    const recipient = lookupStateFromGstin(recipientGstin);
    if (!supplier || !recipient) return null;
    const isInterstate = supplier.gstCode !== recipient.gstCode;
    return {
        supplierState: supplier.state,
        recipientState: recipient.state,
        isInterstate,
        taxType: isInterstate ? 'IGST' : 'CGST + SGST',
    };
}

// E-Way Bill validity: 1 day for the first 200km, +1 day per additional
// 200km (or part thereof), starting from validFrom.
export function calcValidUntil(validFrom, distanceKm) {
    const from = validFrom ? new Date(validFrom) : new Date();
    const km = parseInt(distanceKm, 10) || 0;
    const days = km > 0 ? Math.ceil(km / 200) : 1;
    const until = new Date(from);
    until.setDate(until.getDate() + days);
    return until;
}
