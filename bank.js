/**
 * NEST SFB - CORE CBS ENGINE (LOS UPGRADED)
 */
const DB_KEY = 'NEST_SFB_v22_PRO';

const PRODUCT_MASTER = {
    schemes: {
        "LOTUS": { name: "Lotus Student (Zero Balance)", mab: 0, min: 0, maxInc: 10000 },
        "REGULAR": { name: "Savings Regular CASA", mab: 500, min: 500, maxInc: Infinity },
        "SKY": { name: "Sky High Interest Account", mab: 1000, min: 1000, maxInc: Infinity },
        "PREMIUM": { name: "Elite Privilege Savings", mab: 5000, min: 5000, maxInc: Infinity }
    },
    cards: {
        "RUPAY_LITE": { name: "NEST SFB Rupay Lite", joining: 0, annual: 270 },
        "RUPAY_STD": { name: "NEST SFB Rupay Card", joining: 199, annual: 270 },
        "PLATINUM": { name: "NEST SFB Platinum Card", joining: 299, annual: 399 }
    }
};

function initializeBank() {
    if (!localStorage.getItem(DB_KEY)) {
        localStorage.setItem(DB_KEY, JSON.stringify({
            activeCustomers: [], kycQueue: [], activationBuffer: [],
            branchVault: 10326000.00, // 1.03 Crore Starting Cash
            transactionLedger: [], exceptionTickets: [],
            creditBureau: {}, loanQueue: [], rejectedLoans: [],
            sanctionedLoans: [], activeLoans: []
        }));
    }
}

// Global Core Utilities
const Core = {
    getDB: () => {
        let db = JSON.parse(localStorage.getItem(DB_KEY));
        if (!db) { initializeBank(); db = JSON.parse(localStorage.getItem(DB_KEY)); }
        return db;
    },
    saveDB: (data) => localStorage.setItem(DB_KEY, JSON.stringify(data)),
    generateCIF: () => "CIF" + Math.floor(100000 + Math.random() * 900000),
    generateAcc: () => "9250" + Math.floor(10000000 + Math.random() * 90000000),
    generateTxn: () => "FT" + Date.now().toString().slice(-8),
    generateCKYC: () => "100" + Math.floor(10000000000 + Math.random() * 90000000000),
    generateLoanNo: () => "LN" + Math.floor(1000000 + Math.random() * 9000000),
    generateTicket: () => "EXC" + Math.floor(1000 + Math.random() * 9000)
};

initializeBank();