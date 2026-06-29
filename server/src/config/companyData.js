// ─── Company & Customer Master Data ───
// Hardcoded config (per request) — edit these values directly as needed.
// Values below were extracted from real past delivery challans on file.

// ── Electrolyte Solutions (your own company) — Section 1 of the PDF ──
const COMPANY = {
  companyName: 'Electrolyte Solutions',
  address: 'Unit No. 11, 3rd floor, B-Wing, Gami Industrial Park, Plot Number: C-39-A, TTC Industrial Area Pawane MIDC, Navi Mumbai - 400710',
  phone: '+91 9029352208',
  email: 'info@electrolytesolutions.in', // placeholder — update with real email
  gstin: '27AJYPY7934L1ZS',
  website: '', // optional, leave blank if none
  logo: '', // optional — path/URL to a logo image, leave blank if none
  terms: [
    'Subject to Navi Mumbai Jurisdiction.',
    'Our responsibility ceases as soon as the goods leave our premises.',
    'Goods once sold will not be taken back.',
    'Delivery ex-premises.',
    'Delivery challan is used for transportation purpose. (Not for Sale)',
  ],
};

// ── Customers (companies you dispatch repaired PCBs back to) ──
const CUSTOMERS = {
  Atomberg: {
    companyName: 'Atomberg Technologies Pvt. Ltd.',
    address: 'Mind Space Shelters LLP/Vithai Developers LLP, Gate No 51-59, Opp-Dana india, Bhamboli, Chakan, Pune - 410507',
    phone: '+91 7738590086',
    gstin: '27AAKCA4836H1ZI',
    email: '', // placeholder — fill in if available
    hsnCode: '85340000', // HSN used consistently for Atomberg PCBs on past challans
    defaultRate: 70, // ₹ per unit, as seen on past Atomberg challans
  },
  Bajaj: {
    companyName: 'Bajaj Electricals Limited',
    address: 'Shed B7, Galal No.1,2,3,4,5,6,7A,7B & 8A, Antariksh Logidrome, Mumbai-Nasik Highway, Amane Village, Bhiwandi, Maharashtra - 421302',
    phone: '+91 9833999575',
    gstin: '27AAACB2484Q1Z8',
    email: '', // placeholder — fill in if available
    hsnCode: '85166000', // HSN used consistently for Bajaj PCBs on past challans
    defaultRate: 80, // ₹ per unit, as seen on past Bajaj challans
  },
};

function getCompany() {
  return COMPANY;
}

function getCustomer(brand) {
  return CUSTOMERS[brand] || null;
}

function getAllCustomers() {
  return Object.keys(CUSTOMERS).map((brand) => ({ brand, ...CUSTOMERS[brand] }));
}

module.exports = { COMPANY, CUSTOMERS, getCompany, getCustomer, getAllCustomers };
