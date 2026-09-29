// ==========================================================
// NEST SMALL FINANCE BANK - CORE BANKING SYSTEM (CBS)
// MODULE: STAFF / TELLER OPERATIONS (staff.js)
// ==========================================================

// --- CORE DATABASE UTILITIES ---
const Core = {
    getDB: () => JSON.parse(localStorage.getItem('nest_db')) || { 
        branchVault: 10326000, 
        activeCustomers: [], 
        activeLoans: [], 
        kycQueue: [], 
        activationBuffer: [],
        transactionLedger: [],
        exceptionTickets: [],
        sanctionedLoans: [],
        rejectedLoans: []
    },
    saveDB: (db) => localStorage.setItem('nest_db', JSON.stringify(db)),
    generateAcc: () => "925" + Math.floor(100000000 + Math.random() * 900000000),
    generateCIF: () => "CIF" + Math.floor(100000 + Math.random() * 900000),
    generateTxn: () => "TXN" + Math.floor(10000000 + Math.random() * 90000000),
    generateLoanNo: () => "LN" + Math.floor(10000000 + Math.random() * 90000000),
    generateTicket: () => "EXC" + Math.floor(1000 + Math.random() * 9000)
};

// Initialize DB on first load
if (!localStorage.getItem('nest_db')) Core.saveDB(Core.getDB());

// --- NAVIGATION & UI CONTROL ---
function showMod(id) {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active', 'hidden'));
    document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
    
    const target = document.getElementById('mod-' + id);
    if(target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
    
    if (id === 'hver') refreshHVER();
    if (id === 'mledg') renderMasterLedger();
    if (id === 'admin-ops') loadAdminOps();
}

function updateVaultDisplay() {
    const db = Core.getDB();
    const vaultEl = document.getElementById('vault-amt');
    if (vaultEl) vaultEl.innerText = "₹" + (db.branchVault || 0).toLocaleString('en-IN');
}

// Ensure vault updates on load
window.onload = () => {
    updateVaultDisplay();
};


// ==========================================================
// [F2] UNIVERSAL INQUIRY SYSTEM
// ==========================================================

function inquire(queryStr) {
    const query = queryStr || document.getElementById('inq-acc').value.trim();
    if(!query) return;
    
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.acc === query || x.cif === query);
    
    if(!c) return alert("HAC01: Record not found in system.");

    try {
        document.getElementById('q-name').innerText = c.personal?.name ? c.personal.name.toUpperCase() : "N/A";
        document.getElementById('q-bal').innerText = "₹" + (parseFloat(c.product?.deposit) || 0).toLocaleString('en-IN');
        document.getElementById('q-acc').innerText = c.acc || "N/A";
        document.getElementById('q-scheme').innerText = c.product?.schemeName || "N/A";
        document.getElementById('q-cif').innerText = c.cif || "N/A";
        document.getElementById('q-ckyc').innerText = c.ckycID || "PENDING";
        
        document.getElementById('q-father').innerText = c.personal?.father ? c.personal.father.toUpperCase() : "N/A";
        document.getElementById('q-mother').innerText = c.personal?.mother ? c.personal.mother.toUpperCase() : "N/A";
        document.getElementById('q-dob').innerText = c.personal?.dob || "N/A";
        
        // Safely access dropdown data
        document.getElementById('q-edu').innerText = c.personal?.edu || "N/A";
        document.getElementById('q-emp').innerText = c.personal?.emp || "N/A";
        
        document.getElementById('q-pan').innerText = c.regulatory?.pan ? c.regulatory.pan.toUpperCase() : "N/A";
        
        // Protect Aadhaar redaction
        let aadhaar = c.regulatory?.aadhaar || "";
        document.getElementById('q-aad').innerText = aadhaar.length > 4 ? "XXXX-XXXX-" + aadhaar.slice(-4) : "N/A";
        
        let nomName = c.nominee?.name || "N/A";
        let nomRel = c.nominee?.relation || "N/A";
        document.getElementById('q-nom').innerText = `${nomName} (${nomRel})`;
        
        document.getElementById('q-add').innerText = c.personal?.address || "N/A";
        
        showMod('search');
    } catch (err) {
        console.error("Inquiry Rendering Error:", err);
        alert("System recovered from a missing data error. Some fields may show as N/A.");
        showMod('search');
    }
}


// ==========================================================
// [F3] RETAIL ACCOUNT ORIGINATION (HACM)
// ==========================================================

function submitHACM() {
    const schemeObj = document.getElementById('h-scheme');
    const schemeText = schemeObj.options[schemeObj.selectedIndex].text;
    const initialDeposit = parseFloat(document.getElementById('h-dep').value) || 0;
    const schemeCode = schemeObj.value;
    
    // Scheme Validation Rules
    if(schemeCode === 'REG_CUR' && initialDeposit < 10000) return alert("RULE VIOLATION: Regular Current requires min ₹10,000");
    if(schemeCode === 'ELITE_CUR' && initialDeposit < 20000) return alert("RULE VIOLATION: Elite Current requires min ₹20,000");

    const db = Core.getDB();

    // SAFETY CHECK: Ensure arrays exist
    if (!db.kycQueue) db.kycQueue = [];
    if (!db.activationBuffer) db.activationBuffer = [];

    const app = {
        appID: "APP" + Math.floor(100000 + Math.random() * 900000),
        personal: {
            name: document.getElementById('h-name').value.trim(),
            father: document.getElementById('h-father').value.trim(),
            mother: document.getElementById('h-mother').value.trim(),
            dob: document.getElementById('h-dob').value,
            edu: document.getElementById('h-edu') ? document.getElementById('h-edu').value : "N/A",
            emp: document.getElementById('h-emp') ? document.getElementById('h-emp').value : "N/A",
            marital: document.getElementById('h-marital') ? document.getElementById('h-marital').value : "N/A",
            mobile: document.getElementById('h-mob').value,
            altMobile: document.getElementById('h-alt-mob').value,
            email: document.getElementById('h-email').value,
            address: document.getElementById('h-add').value
        },
        regulatory: {
            pan: document.getElementById('h-pan').value.toUpperCase(),
            aadhaar: document.getElementById('h-aad').value
        },
        nominee: {
            name: document.getElementById('h-nom-name').value,
            relation: document.getElementById('h-nom-rel').value,
            contact: document.getElementById('h-nom-contact').value
        },
        product: {
            schemeCode: schemeCode,
            schemeName: schemeText,
            deposit: initialDeposit,
            cardReq: document.getElementById('h-card-req').value === 'YES',
            cardType: document.getElementById('h-card-type').value
        },
        status: "KYC_PENDING",
        date: new Date().toLocaleString()
    };

    if (!app.personal.name || !app.regulatory.pan || !app.personal.mobile) {
        return alert("CRITICAL ERROR: Name, PAN, and Mobile Number are required.");
    }

    db.kycQueue.push(app);
    Core.saveDB(db);

    alert(`SUBMITTED SUCCESSFULLY!\nApplication ID: ${app.appID}\nStatus: Queued for Compliance`);
    
    document.querySelectorAll('#mod-hacm input, #mod-hacm textarea').forEach(i => i.value = "");
    document.querySelectorAll('#mod-hacm select').forEach(s => s.selectedIndex = 0);
    
    showMod('hver');
}


// ==========================================================
// [F4] COMPLIANCE & CKYC DESK (HVER)
// ==========================================================

function refreshHVER() {
    const db = Core.getDB();
    const tbody = document.getElementById('hver-tbody');
    if (!tbody) return;
    
    const queue = db.kycQueue || [];
    
    if (queue.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center font-bold text-gray-400">NO APPLICATIONS PENDING CKYC</td></tr>`;
    } else {
        tbody.innerHTML = queue.map(a => `
            <tr class="bg-white border-b">
                <td class="p-3 font-bold text-[#000080]">${a.appID}</td>
                <td class="p-3 font-bold">${a.personal?.name || 'UNKNOWN'}</td>
                <td class="p-3 uppercase font-mono">${a.regulatory?.pan || 'N/A'}</td>
                <td class="p-3"><button onclick="initiateCKYC('${a.appID}')" class="pinnacle-btn !bg-blue-50">INITIATE CKYC</button></td>
            </tr>
        `).join('');
    }

    const readyTbody = document.getElementById('ready-tbody');
    if (readyTbody) {
        const buffer = db.activationBuffer || [];
        if (buffer.length === 0) {
            readyTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center font-bold text-gray-400">NO ACCOUNTS READY FOR PRINTING</td></tr>`;
        } else {
            readyTbody.innerHTML = buffer.map(a => `
                <tr class="bg-green-50 border-b">
                    <td class="p-3 font-bold text-emerald-800">${a.appID}</td>
                    <td class="p-3 font-bold">${a.personal?.name || 'UNKNOWN'}</td>
                    <td class="p-3 font-mono">READY</td>
                    <td class="p-3"><button onclick="printAdvice('${a.appID}')" class="pinnacle-btn !bg-white">PRINT ACTIVATION SLIP</button></td>
                </tr>
            `).join('');
        }
    }
}

function initiateCKYC(appID) {
    const db = Core.getDB();
    const idx = db.kycQueue.findIndex(x => x.appID === appID);
    if(idx === -1) return alert("Application not found.");
    
    const app = db.kycQueue[idx];
    const generatedCKYC = "100" + Math.floor(10000000000 + Math.random() * 90000000000);
    
    const pasted = prompt(`CENTRAL KYC REGISTRY\nName: ${app.personal.name}\nPAN: ${app.regulatory.pan}\n\nSystem generated CKYC ID: ${generatedCKYC}\n\nTo simulate biometric match, please type the CKYC ID below:`);
    
    if(pasted === generatedCKYC) {
        const processedApp = db.kycQueue.splice(idx, 1)[0];
        processedApp.ckycID = generatedCKYC;
        processedApp.acc = Core.generateAcc();
        processedApp.cif = Core.generateCIF();
        processedApp.ifsc = "NSTIN00001";
        processedApp.accountStatus = "ACTIVE";
        
        if(!db.activationBuffer) db.activationBuffer = [];
        db.activationBuffer.push(processedApp);
        
        Core.saveDB(db);
        refreshHVER();
        alert("CKYC Matched. Moved to Printing Buffer.");
    } else {
        alert("CKYC Verification Failed or Cancelled.");
    }
}

function printAdvice(appID) {
    const db = Core.getDB();
    const idx = db.activationBuffer.findIndex(x => x.appID === appID);
    if(idx === -1) return alert("Record missing.");
    
    const c = db.activationBuffer.splice(idx, 1)[0];
    db.activeCustomers.push(c);
    
    Core.saveDB(db);
    refreshHVER();
    
    // Add initial deposit to transaction ledger if > 0
    if (c.product.deposit > 0) {
        const txn = { 
            txnID: Core.generateTxn(), 
            date: new Date().toLocaleString(), 
            acc: c.acc, 
            name: c.personal.name, 
            amt: c.product.deposit, 
            type: 'CASH_CR', 
            newBal: c.product.deposit 
        };
        db.transactionLedger.unshift(txn);
        db.branchVault += c.product.deposit;
        Core.saveDB(db);
        updateVaultDisplay();
    }
    
    alert(`ACCOUNT ACTIVATED SUCCESSFULLY!\nA/C No: ${c.acc}\nCIF: ${c.cif}`);
}


// ==========================================================
// [F5] MASTER LEDGER (CASA & LOANS)
// ==========================================================

function renderMasterLedger(type = 'CASA') {
    const db = Core.getDB();
    const container = document.getElementById('ledger-container');
    if (!container) return;

    let tabs = `<div class="flex gap-4 mb-6 border-b pb-2">
        <button onclick="renderMasterLedger('CASA')" class="pinnacle-btn" style="${type==='CASA'?'background:#000080;color:white':''}">CASA PORTFOLIO</button>
        <button onclick="renderMasterLedger('LOAN')" class="pinnacle-btn" style="${type==='LOAN'?'background:#064e3b;color:white':''}">LOAN PORTFOLIO</button>
    </div>`;

    if (type === 'CASA') {
        container.innerHTML = tabs + db.activeCustomers.map(c => `<div class="master-row grid grid-cols-6 gap-4 items-center">
            <div class="font-bold">${c.acc}</div>
            <div>${c.personal?.name || 'UNKNOWN'}</div>
            <div class="text-[10px] text-gray-500">${c.product?.schemeName || 'N/A'}</div>
            <div class="font-bold text-emerald-700">₹${parseFloat(c.product?.deposit || 0).toLocaleString('en-IN')}</div>
            <div class="italic">${c.accountStatus || 'ACTIVE'}</div>
            <button onclick="inquire('${c.acc}')" class="pinnacle-btn">DETAIL</button>
        </div>`).join('');
    } else {
        container.innerHTML = tabs + (db.activeLoans || []).map(l => `<div class="master-row grid grid-cols-6 gap-4 items-center" style="background:#f0fdf4; border:1px solid #059669;">
            <div class="font-bold">${l.loanAcc}</div>
            <div>${l.name}</div>
            <div class="font-bold text-red-700">₹${parseFloat(l.amt || 0).toLocaleString('en-IN')}</div>
            <div>ROI: ${l.roi}%</div>
            <div>${l.disburseDate || 'PENDING'}</div>
            <button onclick="viewLoanStatement('${l.loanAcc}')" class="pinnacle-btn !bg-emerald-900 !text-white">STATEMENT</button>
        </div>`).join('') || tabs + "<p class='mt-4 text-gray-500'>NO ACTIVE LOANS IN PORTFOLIO</p>";
    }
}


// ==========================================================
// [F6] TELLER CASH OPERATIONS
// ==========================================================

function fetchTellerAccount() {
    const query = document.getElementById('t-inq').value.trim();
    if(!query) return;
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.acc === query || x.cif === query);
    
    if(c) {
        document.getElementById('t-name').innerText = c.personal.name;
        document.getElementById('t-bal').innerText = "₹" + parseFloat(c.product.deposit).toLocaleString('en-IN');
        document.getElementById('t-stat').innerText = c.accountStatus || "ACTIVE";
    } else {
        alert("Account not found.");
    }
}

function executeTellerTxn() {
    const query = document.getElementById('t-inq').value.trim();
    const amt = parseFloat(document.getElementById('t-amt').value);
    const type = document.getElementById('t-type').value;
    
    if(!query || isNaN(amt) || amt <= 0) return alert("Invalid inputs.");
    
    const db = Core.getDB();
    const idx = db.activeCustomers.findIndex(x => x.acc === query || x.cif === query);
    
    if (idx === -1) return alert("HTM01: Account not found.");
    const c = db.activeCustomers[idx];

    if(c.accountStatus === "FROZEN" || c.accountStatus === "CLOSED") {
        return alert(`TRANSACTION BLOCKED: Account is ${c.accountStatus}.`);
    }

    let currentBal = parseFloat(c.product.deposit) || 0;
    
    if (type === 'CASH_DR' && currentBal < amt) return alert("HTM02: Insufficient Funds.");

    if (type === 'CASH_DR') { 
        c.product.deposit = currentBal - amt; 
        db.branchVault -= amt; 
    } else { 
        c.product.deposit = currentBal + amt; 
        db.branchVault += amt; 
    }

    const txn = { 
        txnID: Core.generateTxn(), 
        date: new Date().toLocaleString(), 
        acc: c.acc, 
        name: c.personal.name, 
        amt, 
        type, 
        newBal: c.product.deposit 
    };
    
    db.transactionLedger.unshift(txn); 
    Core.saveDB(db); 
    
    updateVaultDisplay();
    fetchTellerAccount(); // Refresh the mini display
    
    // Clear input
    document.getElementById('t-amt').value = '';
    
    // Trigger professional receipt
    printTellerSlip(txn); 
}


// ==========================================================
// [F7] SUPERVISOR EXCEPTION & OVERRIDE DESK
// ==========================================================

function refreshExceptionDesk() {
    const db = Core.getDB();
    
    // CASA Exceptions
    const openCASA = (db.exceptionTickets || []).filter(t => t.status === "OPEN" && t.type !== "LOAN_REJECT");
    const casaTbody = document.getElementById('exc-tbody');
    if(casaTbody) {
        casaTbody.innerHTML = openCASA.map(t => `<tr class="bg-white border-b">
            <td class="p-3 font-bold text-red-600">${t.ticketID}</td>
            <td class="p-3">${t.acc}</td>
            <td class="p-3">${t.issue}</td>
            <td class="p-3">${t.date}</td>
            <td class="p-3"><button onclick="loadOverrideForm('${t.ticketID}', '${t.acc}')" class="pinnacle-btn">FIX</button></td>
        </tr>`).join('') || `<tr><td colspan='5' class='p-4 text-center font-bold text-gray-500'>NO CASA EXCEPTIONS</td></tr>`;
    }

    // LOAN Exceptions
    const openLoans = (db.exceptionTickets || []).filter(t => t.status === "OPEN" && t.type === "LOAN_REJECT");
    const loanTbody = document.getElementById('exc-loan-tbody');
    if(loanTbody) {
        loanTbody.innerHTML = openLoans.map(t => `<tr class="bg-white border-b">
            <td class="p-3 font-bold text-red-600">${t.ticketID}</td>
            <td class="p-3 font-bold">${t.appID}</td>
            <td class="p-3">${t.issue}</td>
            <td class="p-3"><button onclick="forceApproveLoan('${t.ticketID}', '${t.appID}')" class="pinnacle-btn !bg-red-900 !text-white">FORCE APPROVE</button></td>
        </tr>`).join('') || `<tr><td colspan='4' class='p-4 text-center font-bold text-gray-500'>NO LOAN EXCEPTIONS</td></tr>`;
    }
}

// Supervisor Force Approve Loan
function forceApproveLoan(ticketID, appID) {
    if(!confirm("Authorize Override?")) return;
    
    let overrideRate = prompt("SUPERVISOR ACTION: Enter the final approved Interest Rate (%) for this file:");
    if(!overrideRate || isNaN(parseFloat(overrideRate))) return alert("Valid rate required.");
    
    const db = Core.getDB();
    const rIdx = db.rejectedLoans.findIndex(x => x.appID === appID); 
    if(rIdx === -1) return alert("Application not found in rejected queue.");
    
    const approvedLoan = db.rejectedLoans.splice(rIdx, 1)[0];
    approvedLoan.roi = parseFloat(overrideRate); 
    approvedLoan.status = "SANCTIONED_OVERRIDE"; 
    
    if(!db.sanctionedLoans) db.sanctionedLoans = [];
    db.sanctionedLoans.push(approvedLoan);
    
    const tIdx = db.exceptionTickets.findIndex(t => t.ticketID === ticketID); 
    if(tIdx !== -1) {
        db.exceptionTickets[tIdx].status = "RESOLVED";
        db.exceptionTickets[tIdx].resolutionNote = "Supervisor Forced Rate: " + overrideRate + "%";
    }
    
    Core.saveDB(db); 
    alert(`Override Successful. File ${appID} moved to Sanctioned Queue.`); 
    refreshExceptionDesk();
}

// CASA God-Mode Variables
let activeOverrideTicket = null; 

function loadOverrideForm(ticketID, acc) {
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.acc === acc);
    
    if (!c) return alert("System Error: Account not found in database.");

    activeOverrideTicket = ticketID;
    
    // Safely fill the fields if they exist in HTML
    const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
    
    setVal('ov-acc', c.acc);
    setVal('ov-stat', c.accountStatus || "ACTIVE");
    setVal('ov-bal', c.product?.deposit || 0);
    setVal('ov-name', c.personal?.name || "");
    setVal('ov-father', c.personal?.father || "");
    setVal('ov-mother', c.personal?.mother || "");
    setVal('ov-dob', c.personal?.dob || "");
    setVal('ov-pan', c.regulatory?.pan || "");
    setVal('ov-aad', c.regulatory?.aadhaar || "");
    setVal('ov-mob', c.personal?.mobile || "");
    setVal('ov-edu', c.personal?.edu || "");
    setVal('ov-emp', c.personal?.emp || "");
    setVal('ov-marital', c.personal?.marital || "");

    const formArea = document.getElementById('override-form-area');
    if(formArea) {
        formArea.classList.remove('hidden');
        formArea.scrollIntoView({ behavior: 'smooth' });
    }
}

function executeOverride() {
    const db = Core.getDB();
    const accNo = document.getElementById('ov-acc')?.value;
    if (!accNo) return alert("Error: No account selected.");

    const cIdx = db.activeCustomers.findIndex(x => x.acc === accNo);
    if (cIdx === -1) return alert("Error saving data: Account not found.");

    const getVal = (id) => document.getElementById(id)?.value;

    // Safely apply edits directly to the database
    if (getVal('ov-stat')) db.activeCustomers[cIdx].accountStatus = getVal('ov-stat');
    if (getVal('ov-bal')) db.activeCustomers[cIdx].product.deposit = parseFloat(getVal('ov-bal')) || 0;
    if (getVal('ov-name')) db.activeCustomers[cIdx].personal.name = getVal('ov-name');
    if (getVal('ov-mob')) db.activeCustomers[cIdx].personal.mobile = getVal('ov-mob');
    if (getVal('ov-pan')) db.activeCustomers[cIdx].regulatory.pan = getVal('ov-pan').toUpperCase();

    // Mark the CASA ticket as resolved
    const tIdx = (db.exceptionTickets || []).findIndex(t => t.ticketID === activeOverrideTicket);
    if (tIdx !== -1) {
        db.exceptionTickets[tIdx].status = "RESOLVED";
        db.exceptionTickets[tIdx].resolutionNote = "MANUAL OVERRIDE APPLIED";
        db.exceptionTickets[tIdx].resolvedDate = new Date().toLocaleString();
    }

    Core.saveDB(db);
    alert(`OVERRIDE SUCCESSFUL!\nAccount ${accNo} updated and ticket closed.`);
    
    const formArea = document.getElementById('override-form-area');
    if(formArea) formArea.classList.add('hidden');
    
    refreshExceptionDesk();
}


// ==========================================================
// [F8 & F9] LOAN ORIGINATION & PROCESSING LOGIC
// ==========================================================
// (Assuming your previous custom loan logic works fine, 
//  this section acts as a placeholder or can be merged with your existing LOS code)

function toggleLOSCif() {
    const sel = document.getElementById('los-existing').value;
    document.getElementById('los-cif-box').style.display = sel === 'YES' ? 'block' : 'none';
    document.getElementById('los-fetch-btn').style.display = sel === 'YES' ? 'block' : 'none';
}

function fetchCifForLOS() {
    const cif = document.getElementById('los-cif').value.trim();
    if(!cif) return;
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.cif === cif);
    if(c) {
        document.getElementById('los-name').value = c.personal.name;
        document.getElementById('los-pan').value = c.regulatory.pan;
        document.getElementById('los-mob').value = c.personal.mobile;
        document.getElementById('los-add').value = c.personal.address;
    } else {
        alert("CIF Not Found");
    }
}

// Basic Evaluation Stub
function evaluateLoanRisk() {
    const amt = parseFloat(document.getElementById('los-amt').value);
    const inc = parseFloat(document.getElementById('los-income').value);
    if(!amt || !inc) return alert("Fill Amount and Income");
    
    const box = document.getElementById('los-risk-box');
    box.classList.remove('hidden');
    
    const dti = (amt/60) / inc; // Rough DTI
    const score = dti < 0.4 ? 750 : (dti < 0.6 ? 650 : 500);
    
    document.getElementById('risk-score').innerText = score;
    document.getElementById('risk-band').innerText = score > 700 ? "LOW RISK" : "HIGH RISK";
    document.getElementById('risk-ltv').innerText = "N/A";
}


// ==========================================================
// [F10] ADMIN VAULT MANAGEMENT
// ==========================================================

function loadAdminOps() {
    const db = Core.getDB();
    const vaultDisplay = document.getElementById('admin-current-vault');
    if(vaultDisplay) vaultDisplay.innerText = "₹" + (db.branchVault || 0).toLocaleString('en-IN');
}

function updateBranchVault() {
    const action = document.getElementById('admin-vault-action').value;
    const amount = parseFloat(document.getElementById('admin-vault-amt').value);
    const pin = document.getElementById('admin-vault-pin').value;
    
    if (pin !== "1234") return alert("SECURITY ERROR: Invalid Authorization PIN.");
    if (isNaN(amount) || amount <= 0) return alert("ERROR: Please enter a valid positive amount.");

    const db = Core.getDB();
    let oldBal = db.branchVault || 0;

    if (action === "ADD") {
        db.branchVault = oldBal + amount;
    } else if (action === "REMOVE") {
        if (amount > oldBal) return alert("ERROR: Cannot remove more cash than exists in the vault.");
        db.branchVault = oldBal - amount;
    } else if (action === "SET") {
        db.branchVault = amount;
    }

    Core.saveDB(db);
    updateVaultDisplay();
    loadAdminOps(); 
    
    document.getElementById('admin-vault-amt').value = '';
    document.getElementById('admin-vault-pin').value = '';
    
    alert(`VAULT UPDATED SUCCESSFULLY.\nNew Balance: ₹${db.branchVault.toLocaleString('en-IN')}`);
}


// ==========================================================
// PROFESSIONAL DOCUMENT GENERATORS (RECEIPTS & STATEMENTS)
// ==========================================================

function printTellerSlip(t) {
    const html = `
    <div style="font-family:monospace; padding:40px; border:2px solid #000; width:450px; margin:auto; line-height:1.5;">
        <h2 style="text-align:center; border-bottom:1px solid #000; padding-bottom:10px;">NEST SMALL FINANCE BANK</h2>
        <h3 style="text-align:center;">TELLER TRANSACTION ADVICE</h3>
        <p><b>TXN ID:</b> ${t.txnID} <span style="float:right">${t.date}</span></p>
        <hr>
        <p><b>A/C NO:</b> ${t.acc}</p>
        <p><b>HOLDER:</b> ${t.name.toUpperCase()}</p>
        <p><b>TYPE:</b> ${t.type === 'CASH_CR' ? 'CASH DEPOSIT (CR)' : 'CASH WITHDRAWAL (DR)'}</p>
        <p style="font-size:20px;"><b>AMOUNT: ₹${t.amt.toLocaleString('en-IN')}</b></p>
        <hr>
        <p><b>AVAILABLE BALANCE: ₹${t.newBal.toLocaleString('en-IN')}</b></p>
        <br><br><br>
        <p>--------------------------<br>OFFICIAL SIGNATORY</p>
        <p style="text-align:center; font-size:10px;">COMPUTER GENERATED RECEIPT - NO SIGNATURE REQUIRED</p>
    </div>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

function viewLoanStatement(loanNo) {
    const db = Core.getDB();
    const l = db.activeLoans.find(x => x.loanAcc === loanNo);
    if(!l) return alert("Loan record not found.");
    
    const principal = parseFloat(l.amt);
    const rate = parseFloat(l.roi) / 100;
    const totalInt = principal * rate * (parseFloat(l.term) / 12);
    const emi = (principal + totalInt) / parseFloat(l.term);

    const html = `
    <div style="font-family:monospace; padding:30px; border:2px solid #064e3b; max-width:650px; margin:auto; line-height:1.6;">
        <h2 style="text-align:center; color:#064e3b; border-bottom:2px solid #064e3b; padding-bottom:10px;">NEST SMALL FINANCE BANK - LOAN STATEMENT</h2>
        <table style="width:100%; margin-top:20px; border-collapse:collapse;">
            <tr><td><b>LOAN ACC NO:</b></td><td>${l.loanAcc}</td><td><b>CIF:</b></td><td>${l.cif || 'N/A'}</td></tr>
            <tr><td><b>HOLDER NAME:</b></td><td>${l.name.toUpperCase()}</td><td><b>LOAN TYPE:</b></td><td>${l.type || 'TERM LOAN'}</td></tr>
            <tr><td><b>ROI:</b></td><td>${l.roi}% (Fixed)</td><td><b>TENURE:</b></td><td>${l.term} MONTHS</td></tr>
        </table>
        <hr style="margin:20px 0;">
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:15px; text-align:center;">
            <div style="border:1px solid #ccc; padding:10px;"><p style="font-size:10px; margin:0;">PRINCIPAL</p><b>₹${principal.toLocaleString('en-IN')}</b></div>
            <div style="border:1px solid #ccc; padding:10px;"><p style="font-size:10px; margin:0;">TOTAL INTEREST</p><b>₹${Math.round(totalInt).toLocaleString('en-IN')}</b></div>
            <div style="border:1px solid #ccc; padding:10px;"><p style="font-size:10px; margin:0;">MONTHLY EMI</p><b style="color:#b91c1c;">₹${Math.round(emi).toLocaleString('en-IN')}</b></div>
        </div>
        <hr style="margin:20px 0;">
        <p><b>ACCOUNT STATUS:</b> <span style="color:green;">ACTIVE</span></p>
        <p><b>DISBURSEMENT DATE:</b> ${l.disburseDate || new Date().toLocaleDateString()}</p>
        <br><br><p style="text-align:center; font-size:10px; color:#666;">NEST SFB CORE BANKING v22.0 - INTERNAL PORTAL</p>
    </div>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}