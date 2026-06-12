// ─── Master PCB Item Code Database ───
// Source: ATOMBERG_CHALLAN.xlsx and BAJAJ_CHALLAN.xlsx
// Maps item codes to PCB descriptions for both brands

export const ATOMBERG_ITEMS = {
    SA0087: 'PCB_Main_1200mm Ozeo_GV4',
    SA0038: 'PCB_Regulator_1200mm Renesa Alpha_GV4',
    SA0039: 'PCB_Remote_1200mm Studio+_GV4',
    SA0060: 'Power PCB BL_CF_Renesa_GV3',
    SA0061: 'Power PCB WH_CF_Renesa_GV3',
    SA0010: 'Digital PCB_1200mm_Renesa Smart+_GV3',
    SA0011: 'Consolidate PCB GV3_CF_Renesa+_GV3',
    SA0022: 'Main PCB_CF_1400mm Efficio_Reg 35W_GV2',
    SA0021: 'Main PCB_CF_1200mm Efficio_Reg_28W_GV2',
    SA0019: 'Consolidate PCB GV2_CF_Efficio_GV2',
};

export const BAJAJ_ITEMS = {
    '974267': 'MAIN PCB MAJESTY SLIM INDUCTION COOKER',
    '974268': 'CONTROL PCB MAJESTY SLIM INDUCTION',
    '974284': 'DISPLAY PCB ASSLY ICX 160 TS INDUCTION',
    '974290': 'DISPLAY PCB ASSLY ICX 190 TS INDUCTION',
    '974295': 'DISPLAY PCB ASSLY ICX 200 FP INDUCTION',
    '971054': 'MAIN PCB ASSLY SPLENDID 120 TS',
    '971055': 'DISPLAY PCB ASSLY SPLENDID 120 TS',
    '971064': 'MAIN PCB ASSLY SPLENDID 140 TS',
    '971065': 'DISPLAY PCB ASSLY SPLENDID 140 TS',
    '971039': 'MAIN PCB IRX 220F INFRARED COOKTOP',
    '971040': 'DISPLAY PCB IRX 220F INFRARED COOKTOP',
    '971084': 'DISPLAY PCB ICX 160 TS NEO',
    '971079': 'MAIN PCB ASSLY ICX 160 TS NEO',
    '971090': 'DISPLAY PCB ASSLY ICX 190 FS INDUCTION',
    '971089': 'MAIN PCB ASSLY ICX 190 FS INDUCTION',
    '974299': 'MAIN PCB ICX130/160/190TS/200FP INDUCTION',
    '9252950': 'MAIN PCB ASSLY CLASSICO SLEEK PLUS 1200',
    '974157': 'PCB ASSEMBLY (974157)',
    '974156': 'PCB ASSEMBLY (974156)',
    '974167': 'PCB ASSEMBLY (974167)',
};

export const ALL_ITEMS = {
    Atomberg: ATOMBERG_ITEMS,
    Bajaj: BAJAJ_ITEMS,
};

export function lookupDescription(brand, itemCode) {
    if (!brand || !itemCode) return '';
    const db = ALL_ITEMS[brand] || {};
    return db[itemCode.trim()] || '';
}

export function getItemCodes(brand) {
    if (!brand) return [];
    const db = ALL_ITEMS[brand] || {};
    return Object.keys(db);
}
