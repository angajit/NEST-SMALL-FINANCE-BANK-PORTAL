/**
 * NEST CBS - Staff Operations Logic v22.0 (FULL ENTERPRISE EDITION)
 */

let currentSessionCKYC = "";
let activeOverrideTicket = null; 
let activeLoanApp = null; 

window.onload = function() {
    refreshVaultDisplay();
};

// --- 1. UNIVERSAL NAVIGATION ---
function showMod(id) {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    let target = document.getElementById('mod-' + id);
    if (target) target.classList.add('active');

    if(id === 'hver') refreshHVER();
    if(id === 'ledger') renderMasterLedger('CASA');
    if(id === 'teller') refreshVaultDisplay();
    if(id === 'override') refreshExceptionDesk(); 
    if(id === 'los-process') refreshLosQueues();
}

function updateSchemeInfo() {
    const key = document.getElementById('h-scheme').value;
    const s = PRODUCT_MASTER.schemes[key];
    document.getElementById('scheme-note').innerText = `RULE: MAB ₹${s.mab} | MIN OPENING ₹${s.min}`;
}

// --- 2. [F3] & [F4] CASA ORIGINATION & COMPLIANCE ---
function submitHACM() {
    const schemeObj = document.getElementById('h-scheme');
    const schemeText = schemeObj.options[schemeObj.selectedIndex].text;
    const initialDeposit = parseFloat(document.getElementById('h-dep').value) || 0;
    
    const app = {
        appID: "APP" + Math.floor(100000 + Math.random() * 900000),
        personal: {
            name: document.getElementById('h-name').value.trim(),
            father: document.getElementById('h-father').value.trim(),
            mother: document.getElementById('h-mother').value.trim(),
            dob: document.getElementById('h-dob').value,
            edu: document.getElementById('h-edu').value,
            emp: document.getElementById('h-emp').value,
            marital: document.getElementById('h-marital').value,
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
            schemeName: schemeText,
            deposit: initialDeposit,
            cardReq: document.getElementById('h-card-req').value,
            cardType: document.getElementById('h-card-type').value
        },
        status: "KYC_PENDING", date: new Date().toLocaleString()
    };

    if (!app.personal.name || !app.regulatory.pan || !app.personal.mobile) {
        return alert("CRITICAL ERROR: Name, PAN, and Mobile are required.");
    }

    const db = Core.getDB();
    db.kycQueue.push(app);
    Core.saveDB(db);
    alert(`SUBMITTED SUCCESSFULLY!\nApplication ID: ${app.appID}\nStatus: Queued for Compliance`);
    document.querySelectorAll('#mod-hacm input, #mod-hacm textarea').forEach(i => i.value = "");
    showMod('hver');
}

function initiateCKYC() {
    document.getElementById('ckyc-loader').classList.remove('hidden');
    setTimeout(() => {
        currentSessionCKYC = Core.generateCKYC();
        document.getElementById('ckyc-loader').classList.add('hidden');
        document.getElementById('gen-ckyc-val').innerText = currentSessionCKYC;
        document.getElementById('ckyc-output').classList.remove('hidden');
    }, 2000);
}

function verifyAndApprove() {
    if(document.getElementById('ckyc-pasted').value.trim() === currentSessionCKYC) {
        const db = Core.getDB();
        const app = db.kycQueue.shift();
        app.ckycID = currentSessionCKYC;
        app.acc = Core.generateAcc(); 
        app.cif = Core.generateCIF();
        app.accountStatus = "ACTIVE";
        db.activationBuffer.push(app);
        Core.saveDB(db);
        refreshHVER();
        document.getElementById('ckyc-output').classList.add('hidden');
        alert("CKYC Verified. Ready for printing.");
    } else { alert("CKYC Mismatch Error."); }
}

function printAdvice(id) {
    const db = Core.getDB();
    const idx = db.activationBuffer.findIndex(x => x.appID === id);
    const c = db.activationBuffer.splice(idx, 1)[0];
    db.activeCustomers.push(c);
    Core.saveDB(db);
    refreshHVER();
    alert(`Account Activated Successfully: ${c.acc}`);
}

function refreshHVER() {
    const db = Core.getDB();
    document.getElementById('hver-tbody').innerHTML = db.kycQueue.map(a => `
        <tr class="border-b bg-white">
            <td class="p-3 font-bold">${a.appID}</td><td class="p-3">${a.personal.name}</td>
            <td class="p-3 uppercase font-mono">${a.regulatory.pan}</td>
            <td class="p-3"><button onclick="initiateCKYC()" class="pinnacle-btn !bg-blue-50">INITIATE CKYC</button></td>
        </tr>`).join('') || "<tr><td colspan='4' class='p-4 text-center'>No Applications Found.</td></tr>";

    document.getElementById('ready-tbody').innerHTML = db.activationBuffer.map(a => `
        <tr class="bg-green-50 border-b">
            <td class="p-3 font-bold text-emerald-800">${a.appID}</td><td class="p-3 font-bold">${a.personal.name}</td>
            <td class="p-3 font-mono">READY</td>
            <td class="p-3"><button onclick="printAdvice('${a.appID}')" class="pinnacle-btn !bg-white">PRINT SLIP & ACTIVATE</button></td>
        </tr>`).join('') || "<tr><td colspan='4' class='p-4 text-center'>No Accounts Ready.</td></tr>";
}

// --- 3. [F5] MASTER LEDGER & UNIVERSAL INQUIRY ---
function renderMasterLedger(type = 'CASA') {
    const db = Core.getDB();
    const container = document.getElementById('ledger-container');
    let tabs = `<div class="flex gap-4 mb-6 border-b-2 pb-2">
        <button onclick="renderMasterLedger('CASA')" class="pinnacle-btn ${type==='CASA'?'!bg-blue-900 !text-white':''}">[F5] SAVINGS ACCOUNTS</button>
        <button onclick="renderMasterLedger('LOAN')" class="pinnacle-btn ${type==='LOAN'?'!bg-emerald-900 !text-white':''}">[F5] ACTIVE LOANS</button>
    </div>`;

    if (type === 'CASA') {
        container.innerHTML = tabs + db.activeCustomers.map(c => `
            <div class="master-row grid grid-cols-6 gap-4">
                <div class="font-bold">${c.acc}</div><div class="font-bold">${c.personal.name}</div>
                <div class="text-[11px]">Last Change: ${c.lastModified || 'N/A'}</div>
                <div class="font-bold text-[#047857]">₹${parseFloat(c.product.deposit).toLocaleString('en-IN')}</div>
                <div class="text-[11px] font-black uppercase ${c.accountStatus==='FROZEN'?'text-red-600':'text-green-600'}">${c.accountStatus}</div>
                <div><button onclick="inquire('${c.acc}')" class="pinnacle-btn !text-[10px]">DETAILS</button></div>
            </div>`).join('') || tabs + "<div class='p-6 text-center font-bold'>NO ACTIVE RETAIL ACCOUNTS.</div>";
    } else {
        container.innerHTML = tabs + db.activeLoans.map(l => `
            <div class="master-row grid grid-cols-6 gap-4" style="background:#f0fdf4; border-color:#059669;">
                <div class="font-bold text-emerald-900">${l.loanAcc}</div><div class="font-bold">${l.name}</div>
                <div class="text-[11px] font-bold ${l.status==='CLOSED'?'text-red-600':'text-green-600'}">${l.status}</div>
                <div class="font-bold text-red-700">₹${l.amt.toLocaleString('en-IN')}</div>
                <div class="flex gap-2">
                    <button onclick="viewLoanStatement('${l.loanAcc}')" class="pinnacle-btn !bg-emerald-900 !text-white !text-[9px]">STMT</button>
                    <button onclick="reportError('${l.loanAcc}')" class="pinnacle-btn !bg-red-100 !text-red-900 !text-[9px]">REPORT</button>
                </div>
            </div>`).join('') || tabs + "<div class='p-6 text-center font-bold text-emerald-900'>NO LOAN PORTFOLIOS.</div>";
    }
}

// Pass an optional ID to auto-fill the modal
function reportError(targetId = "") {
    let a = document.getElementById('q-acc'); 
    let prefill = targetId || (a ? a.innerText.trim() : "");
    document.getElementById('error-modal-acc').value = prefill;
    document.getElementById('error-modal-text').value = "";
    document.getElementById('error-modal').style.display = 'flex';
}    

function inquire(query) {
    if(!query) return;
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.acc === query || x.cif === query);
    if(!c) return alert("Record Not Found in System.");

    document.getElementById('q-name').innerText = c.personal.name.toUpperCase();
    document.getElementById('q-bal').innerText = "₹" + parseFloat(c.product.deposit).toLocaleString('en-IN');
    document.getElementById('q-acc').innerText = c.acc;
    document.getElementById('q-scheme').innerText = c.product.schemeName;
    document.getElementById('q-cif').innerText = c.cif;
    document.getElementById('q-ckyc').innerText = c.ckycID || "PENDING";
    document.getElementById('q-father').innerText = c.personal.father.toUpperCase();
    document.getElementById('q-mother').innerText = c.personal.mother.toUpperCase();
    document.getElementById('q-dob').innerText = c.personal.dob;
    document.getElementById('q-edu').innerText = c.personal.edu;
    document.getElementById('q-emp').innerText = c.personal.emp;
    document.getElementById('q-pan').innerText = c.regulatory.pan;
    
    let aad = c.regulatory.aadhaar || "";
    document.getElementById('q-aad').innerText = aad.length > 4 ? "XXXX-XXXX-" + aad.slice(-4) : "N/A";
    document.getElementById('q-nom').innerText = `${c.nominee.name} (${c.nominee.relation})`;
    document.getElementById('q-add').innerText = c.personal.address;
    showMod('search');
}

// --- 4. [F6] TELLER OPERATIONS & VAULT ---
function refreshVaultDisplay() {
    const db = Core.getDB();
    const v = document.getElementById('vault-amt');
    if(v) v.innerText = "₹" + db.branchVault.toLocaleString('en-IN');
}

function fetchTellerAccount() {
    const query = document.getElementById('t-inq').value.trim();
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.acc === query || x.cif === query);
    const l = db.activeLoans.find(x => x.loanAcc === query);
    
    if(!c && !l) return alert("Account or Loan Not Found.");
    
    if (c) {
        document.getElementById('t-display-name').innerText = c.personal.name.toUpperCase();
        document.getElementById('t-display-bal').innerText = "CASA BAL: ₹" + parseFloat(c.product.deposit).toLocaleString('en-IN');
    } else if (l) {
        document.getElementById('t-display-name').innerText = l.name.toUpperCase() + " (LOAN A/C)";
        document.getElementById('t-display-bal').innerText = "DUE: ₹" + parseFloat(l.amt).toLocaleString('en-IN') + " | " + l.status;
    }
    document.getElementById('t-post-area').classList.remove('hidden');
}

function executeTellerTxn() {
    const acc = document.getElementById('t-inq').value.trim();
    const amt = parseFloat(document.getElementById('t-amt').value);
    const type = document.getElementById('t-type').value;
    const db = Core.getDB();
    
    const cIdx = db.activeCustomers.findIndex(x => x.acc === acc || x.cif === acc);
    const lIdx = db.activeLoans.findIndex(x => x.loanAcc === acc);
    
    if (cIdx === -1 && lIdx === -1) return alert("Account Not Found.");
    if (isNaN(amt) || amt <= 0) return alert("Invalid Amount.");

    let txnName = "";
    let newBal = 0;

    // CASA TRANSACTION
    if (cIdx !== -1) {
        let currentBal = parseFloat(db.activeCustomers[cIdx].product.deposit);
        if (type === 'CASH_DR' && currentBal < amt) return alert("Insufficient Funds.");
        if (type === 'CASH_DR' && db.branchVault < amt) return alert("Vault Limit Exceeded.");

        if (type === 'CASH_DR') { 
            db.activeCustomers[cIdx].product.deposit -= amt; 
            db.branchVault -= amt; 
        } else { 
            db.activeCustomers[cIdx].product.deposit += amt; 
            db.branchVault += amt; 
        }
        txnName = db.activeCustomers[cIdx].personal.name;
        newBal = db.activeCustomers[cIdx].product.deposit;
    } 
    // LOAN REPAYMENT TRANSACTION
    else if (lIdx !== -1) {
        if (db.activeLoans[lIdx].status === "CLOSED") return alert("This loan is already closed.");
        if (type === 'CASH_DR') return alert("Cannot withdraw cash from a Loan Account.");
        
        db.activeLoans[lIdx].amt -= amt;
        db.branchVault += amt;
        txnName = db.activeLoans[lIdx].name + " (LOAN REPAYMENT)";
        newBal = db.activeLoans[lIdx].amt;

        // Auto Close Loan if paid off
        if (db.activeLoans[lIdx].amt <= 0) {
            db.activeLoans[lIdx].status = "CLOSED";
            db.activeLoans[lIdx].closeDate = new Date().toLocaleString();
            alert("LOAN FULLY REPAID AND CLOSED! Generating NOC...");
            generateNOC(db.activeLoans[lIdx]);
        }
    }

    const txn = { txnID: Core.generateTxn(), date: new Date().toLocaleString(), acc: acc, name: txnName, amt: amt, type: type, newBal: newBal };
    db.transactionLedger.unshift(txn);
    Core.saveDB(db);
    refreshVaultDisplay();
    document.getElementById('t-amt').value = '';
    printTellerSlip(txn);
    alert("TRANSACTION SUCCESSFUL");
}

// --- 5. [F8] LOAN ORIGINATION SYSTEM (LOS) & RISK ENGINE ---
function runMonthlyBureauReporting() {
    const db = Core.getDB();
    if (db.activeCustomers.length === 0) return alert("No customers to report.");
    db.activeCustomers.forEach(c => {
        let score = db.creditBureau[c.cif] || 600;
        const hasLoan = db.activeLoans.some(l => l.cif === c.cif);
        score += hasLoan ? 10 : (Math.floor(Math.random() * 11) - 5);
        db.creditBureau[c.cif] = Math.min(900, Math.max(300, score));
    });
    Core.saveDB(db);
    alert("MONTHLY BUREAU REPORTING COMPLETE.");
}

function setCibilScore() {
    const cif = document.getElementById('los-cibil-cif').value.trim();
    const score = parseInt(document.getElementById('los-cibil-score').value);
    if(!cif || isNaN(score)) return alert("Valid CIF and Score required.");
    const db = Core.getDB();
    db.creditBureau[cif] = score;
    Core.saveDB(db);
    alert("BUREAU UPDATED FOR CIF: " + cif);
}

function fetchCifForLOS() {
    const cif = document.getElementById('los-cif').value.trim();
    const db = Core.getDB();
    const c = db.activeCustomers.find(x => x.cif === cif);
    if(c) {
        document.getElementById('los-name').value = c.personal.name;
        document.getElementById('los-pan').value = c.regulatory.pan;
        document.getElementById('los-name').readOnly = true;
        document.getElementById('los-pan').readOnly = true;
    } else { alert("Existing Customer Not Found."); }
}

function evaluateLoanRisk() {
    const cif = document.getElementById('los-cif').value.trim();
    const name = document.getElementById('los-name').value;
    const amt = parseFloat(document.getElementById('los-amt').value);
    const roi = parseFloat(document.getElementById('los-roi').value);
    const colReq = document.getElementById('los-col-req').value;
    const colVal = parseFloat(document.getElementById('los-col-val').value) || 0;

    if(!name || isNaN(amt) || isNaN(roi)) return alert("Missing required parameters.");

    const db = Core.getDB();
    const score = db.creditBureau[cif] || 0;
    
    let band = "NO HIT";
    if(score > 0 && score < 600) band = "HIGH RISK / AUTO-REJECT";
    else if(score >= 600 && score <= 720) band = "MEDIUM RISK";
    else if(score > 720) band = "LOW RISK";

    let ltv = (colReq === 'YES') ? (amt / colVal) * 100 : 0;

    document.getElementById('risk-score').innerText = score || "NO HIT";
    document.getElementById('risk-band').innerText = band;
    document.getElementById('risk-ltv').innerText = ltv ? ltv.toFixed(1) + "%" : "NA";
    
    if(band === "HIGH RISK / AUTO-REJECT") document.getElementById('risk-band').style.color = "#b91c1c";
    else document.getElementById('risk-band').style.color = "#047857";

    document.getElementById('los-risk-box').classList.remove('hidden');

    activeLoanApp = { 
        appID: "LAPP" + Math.floor(10000 + Math.random()*90000), 
        cif: cif || "NEW", name: name, pan: document.getElementById('los-pan').value,
        type: document.getElementById('los-type').value, amt: amt, roi: roi, 
        term: document.getElementById('los-term').value, freq: document.getElementById('los-freq').value,
        band: band, ltv: ltv
    };
}

function processLoan(decision) {
    if(!activeLoanApp) return;
    const db = Core.getDB();
    if (decision === 'APPROVE') {
        if(activeLoanApp.band === 'HIGH RISK / AUTO-REJECT') return alert("SYSTEM BLOCK: Cannot approve High Risk files. Must Decline and Escalate.");
        if(activeLoanApp.ltv > 75) return alert("SYSTEM BLOCK: LTV exceeds 75% limit.");
        
        activeLoanApp.status = "SANCTIONED";
        db.sanctionedLoans.push(activeLoanApp);
        alert("FILE APPROVED & SANCTIONED.");
    } else {
        activeLoanApp.reason = prompt("Reason for decline:") || "Policy Rejection";
        activeLoanApp.status = "REJECTED";
        db.rejectedLoans.push(activeLoanApp);
        alert("FILE REJECTED.");
    }
    
    Core.saveDB(db);
    document.getElementById('los-risk-box').classList.add('hidden');
    
    // Clear Form
    document.querySelectorAll('#mod-los-apply input').forEach(i => i.value = "");
    document.getElementById('los-name').readOnly = false;
    document.getElementById('los-pan').readOnly = false;
    activeLoanApp = null;
    showMod('los-process');
}

// --- 6. [F9] LOAN PROCESSING & DISBURSAL ---
function refreshLosQueues() {
    const db = Core.getDB();
    document.getElementById('sanction-tbody').innerHTML = db.sanctionedLoans.map(l => `
        <tr class="bg-white border-b">
            <td class="p-3 font-bold text-emerald-800">${l.appID}</td><td class="p-3">${l.name}</td>
            <td class="p-3 font-bold">₹${l.amt.toLocaleString()}</td><td class="p-3 text-blue-900 font-bold">${l.roi}%</td>
            <td class="p-3"><button onclick="loadDisbursal('${l.appID}')" class="pinnacle-btn">INITIATE</button></td>
        </tr>`).join('') || "<tr><td colspan='5' class='p-4 text-center'>No Sanctioned Files</td></tr>";
    
    document.getElementById('reject-tbody').innerHTML = db.rejectedLoans.map(l => `
        <tr class="bg-white border-b">
            <td class="p-3 font-bold">${l.appID}</td><td class="p-3">${l.name}</td>
            <td class="p-3 font-bold text-red-700">₹${l.amt.toLocaleString()}</td><td class="p-3 text-xs">${l.reason}</td>
            <td class="p-3"><button onclick="escalateLoan('${l.appID}')" class="pinnacle-btn">ESCALATE TO F7</button></td>
        </tr>`).join('') || "<tr><td colspan='5' class='p-4 text-center'>No Rejected Files</td></tr>";
}

function loadDisbursal(appID) {
    const db = Core.getDB();
    const l = db.sanctionedLoans.find(x => x.appID === appID);
    activeLoanApp = l;
    document.getElementById('dis-appid').innerText = appID;
    
    const today = new Date();
    document.getElementById('dis-sanc-date').value = today.toLocaleDateString();
    
    const emiDate = new Date(today); emiDate.setDate(today.getDate() + 30);
    document.getElementById('dis-emi-date').value = emiDate.toLocaleDateString();
    
    document.getElementById('dis-amt').value = l.amt;
    
    const interestTotal = l.amt * (l.roi / 100) * (l.term / 12); 
    const emi = (l.amt + interestTotal) / l.term;
    document.getElementById('dis-emi-amt').value = Math.round(emi);
    
    document.getElementById('disburse-form').classList.remove('hidden');
}

function executeDisbursement() {
    const db = Core.getDB();
    const targetAcc = document.getElementById('dis-acc').value.trim();
    const custIdx = db.activeCustomers.findIndex(x => x.acc === targetAcc);
    
    if(custIdx === -1) return alert("CASA Account Not Found for credit.");
    
    // Credit the CASA Account
    db.activeCustomers[custIdx].product.deposit = (parseFloat(db.activeCustomers[custIdx].product.deposit) || 0) + activeLoanApp.amt;
    
    // Deduct from Branch Vault
    db.branchVault -= activeLoanApp.amt;
    
    // Ledger Entry
    db.transactionLedger.unshift({ txnID: Core.generateTxn(), date: new Date().toLocaleString(), acc: targetAcc, name: activeLoanApp.name, amt: activeLoanApp.amt, type: 'LOAN_DISBURSAL_CR', newBal: db.activeCustomers[custIdx].product.deposit });

    // Move to Active Loans
    activeLoanApp.loanAcc = Core.generateLoanNo();
    activeLoanApp.linkedCASA = targetAcc;
    activeLoanApp.disburseDate = new Date().toLocaleString();
    activeLoanApp.status = "ACTIVE";
    db.activeLoans.push(activeLoanApp);
    
    // Remove from Sanction Queue
    db.sanctionedLoans = db.sanctionedLoans.filter(x => x.appID !== activeLoanApp.appID);
    
    Core.saveDB(db);
    alert(`DISBURSAL COMPLETE.\nLoan ${activeLoanApp.loanAcc} active.\nVault reduced. Amount credited to CASA ${targetAcc}.`);
    document.getElementById('disburse-form').classList.add('hidden');
    refreshLosQueues();
    refreshVaultDisplay(); // Update sidebar immediately
}
// --- 7. [F7] SUPERVISOR GOD-MODE & ESCALATION ---
function escalateLoan(appID) {
    const db = Core.getDB();
    const idx = db.rejectedLoans.findIndex(x => x.appID === appID);
    if(idx === -1) return;
    db.exceptionTickets.push({ ticketID: Core.generateTicket(), appID: appID, acc: "LOAN_APP", issue: `Override Req: ${db.rejectedLoans[idx].reason}`, status: "OPEN", date: new Date().toLocaleString(), type: "LOAN_REJECT" });
    Core.saveDB(db);
    alert("Escalated to Supervisor [F7].");
    refreshLosQueues();
}

function reportError() {
    let a = document.getElementById('q-acc'); 
    if(a) document.getElementById('error-modal-acc').value = a.innerText.trim();
    document.getElementById('error-modal-text').value = "";
    document.getElementById('error-modal').style.display = 'flex';
}

function closeErrorModal() { document.getElementById('error-modal').style.display = 'none'; }

function submitErrorModal() {
    const a = document.getElementById('error-modal-acc').value.trim();
    const i = document.getElementById('error-modal-text').value.trim();
    if(!a || !i) return alert("Validation Error.");
    
    const db = Core.getDB();
    db.exceptionTickets.push({ ticketID: Core.generateTicket(), acc: a, issue: i, status: "OPEN", date: new Date().toLocaleString() });
    Core.saveDB(db);
    closeErrorModal();
    alert("Ticket Raised Successfully.");
    refreshExceptionDesk();
}

function refreshExceptionDesk() {
    const db = Core.getDB();
    const openCASA = db.exceptionTickets.filter(t => t.status === "OPEN" && t.type !== "LOAN_REJECT");
    document.getElementById('exc-tbody').innerHTML = openCASA.map(t => `
        <tr class="bg-white border-b">
            <td class="p-3 font-bold text-red-600">${t.ticketID}</td><td class="p-3">${t.acc}</td>
            <td class="p-3">${t.issue}</td><td class="p-3">${t.date}</td>
            <td class="p-3"><button onclick="loadOverrideForm('${t.ticketID}', '${t.acc}')" class="pinnacle-btn">FIX</button></td>
        </tr>`).join('') || "<tr><td colspan='5' class='p-4 text-center font-bold'>NO CASA EXCEPTIONS</td></tr>";

    const openLoans = db.exceptionTickets.filter(t => t.status === "OPEN" && t.type === "LOAN_REJECT");
    document.getElementById('exc-loan-tbody').innerHTML = openLoans.map(t => `
        <tr class="bg-white border-b">
            <td class="p-3 font-bold text-red-600">${t.ticketID}</td><td class="p-3 font-bold">${t.appID}</td>
            <td class="p-3">${t.issue}</td>
            <td class="p-3"><button onclick="forceApproveLoan('${t.ticketID}', '${t.appID}')" class="pinnacle-btn !bg-red-900 !text-white">FORCE APPROVE</button></td>
        </tr>`).join('') || "<tr><td colspan='4' class='p-4 text-center font-bold'>NO LOAN EXCEPTIONS</td></tr>";
}

function forceApproveLoan(ticketID, appID) {
    if(!confirm("Authorize Override?")) return;
    let overrideRate = prompt("SUPERVISOR ACTION: Enter the final approved Interest Rate (%) for this file:");
    if(!overrideRate || isNaN(parseFloat(overrideRate))) return alert("Valid rate required.");
    
    const db = Core.getDB(); 
    const rIdx = db.rejectedLoans.findIndex(x => x.appID === appID); 
    if(rIdx === -1) return;
    
    const approvedLoan = db.rejectedLoans.splice(rIdx, 1)[0];
    approvedLoan.roi = parseFloat(overrideRate); 
    approvedLoan.status = "SANCTIONED_OVERRIDE"; 
    db.sanctionedLoans.push(approvedLoan);
    
    const tIdx = db.exceptionTickets.findIndex(t => t.ticketID === ticketID); 
    if(tIdx !== -1) db.exceptionTickets[tIdx].status = "RESOLVED";
    
    Core.saveDB(db); 
    alert("Overridden successfully. File moved to Sanctioned [F9]."); 
    refreshExceptionDesk();
}

function loadOverrideForm(ticketID, acc) {
    const db = Core.getDB();
    activeOverrideTicket = ticketID;
    const c = db.activeCustomers.find(x => x.acc === acc);
    if(!c) return alert("System Error: Account not found.");
    
    const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
    setVal('ov-acc', c.acc);
    setVal('ov-stat', c.accountStatus || "ACTIVE");
    setVal('ov-bal', c.product.deposit || 0);
    setVal('ov-name', c.personal.name || "");
    setVal('ov-father', c.personal.father || "");
    setVal('ov-mother', c.personal.mother || "");
    setVal('ov-dob', c.personal.dob || "");
    setVal('ov-pan', c.regulatory.pan || "");
    setVal('ov-aad', c.regulatory.aadhaar || "");
    setVal('ov-edu', c.personal.edu || "");
    setVal('ov-emp', c.personal.emp || "");
    setVal('ov-marital', c.personal.marital || "");
    setVal('ov-mob', c.personal.mobile || "");
    setVal('ov-nom-name', c.nominee?.name || "");
    setVal('ov-nom-rel', c.nominee?.relation || "");
    setVal('ov-add', c.personal.address || "");
    
    const formArea = document.getElementById('override-form-area');
    formArea.classList.remove('hidden');
    formArea.scrollIntoView({ behavior: 'smooth' });
}

function executeAdminOverride() {
    const db = Core.getDB();
    const acc = document.getElementById('ov-acc').value;
    const remarks = document.getElementById('ov-remarks').value.trim();
    const newStatus = document.getElementById('ov-stat').value;

    const cIdx = db.activeCustomers.findIndex(x => x.acc === acc);
    if (cIdx === -1) return alert("Error: Account not found.");

    if ((newStatus === 'FROZEN' || newStatus === 'CLOSED') && remarks === "") {
        return alert("Validation Failed: You must enter remarks to Freeze or Close an account.");
    }

    const getVal = (id) => document.getElementById(id)?.value;

    db.activeCustomers[cIdx].accountStatus = newStatus;
    db.activeCustomers[cIdx].statusRemarks = remarks;
    db.activeCustomers[cIdx].lastModified = new Date().toLocaleString();
    db.activeCustomers[cIdx].product.deposit = parseFloat(getVal('ov-bal')) || 0;
    db.activeCustomers[cIdx].personal.name = getVal('ov-name');
    db.activeCustomers[cIdx].personal.mobile = getVal('ov-mob');
    db.activeCustomers[cIdx].regulatory.pan = getVal('ov-pan').toUpperCase();

    const tIdx = db.exceptionTickets.findIndex(t => t.ticketID === activeOverrideTicket);
    if (tIdx !== -1) {
        db.exceptionTickets[tIdx].status = "RESOLVED";
        db.exceptionTickets[tIdx].resolutionNote = "MANUAL OVERRIDE APPLIED";
    }

    Core.saveDB(db);
    alert(`OVERRIDE SUCCESSFUL!\nAccount ${acc} updated. Changes timestamped.`);
    document.getElementById('override-form-area').classList.add('hidden');
    refreshExceptionDesk();
}

// --- 8. PRINTING & STATEMENTS ---
function printTellerSlip(t) {
    const html = `
    <div style="font-family:monospace; padding:40px; border:2px solid #000; width:450px; margin:auto;">
        <h2 style="text-align:center; border-bottom:1px solid #000; padding-bottom:10px;">NEST SMALL FINANCE BANK</h2>
        <h3 style="text-align:center;">TELLER TRANSACTION ADVICE</h3>
        <p><b>TXN ID:</b> ${t.txnID} <span style="float:right">${t.date}</span></p><hr>
        <p><b>A/C NO:</b> ${t.acc}</p><p><b>HOLDER:</b> ${t.name.toUpperCase()}</p>
        <p><b>TYPE:</b> ${t.type === 'CASH_CR' ? 'CASH DEPOSIT (CR)' : 'CASH WITHDRAWAL (DR)'}</p>
        <p style="font-size:20px;"><b>AMOUNT: ₹${t.amt.toLocaleString('en-IN')}</b></p><hr>
        <p><b>AVAILABLE BALANCE: ₹${t.newBal.toLocaleString('en-IN')}</b></p><br><br><br>
        <p>--------------------------<br>OFFICIAL SIGNATORY</p>
        <p style="text-align:center; font-size:10px;">COMPUTER GENERATED SLIP</p>
    </div>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500);
}

function viewLoanStatement(loanNo) {
    const db = Core.getDB();
    const l = db.activeLoans.find(x => x.loanAcc === loanNo);
    if (!l) return alert("Loan record missing.");

    const principal = parseFloat(l.amt);
    const rate = parseFloat(l.roi) / 100;
    const timeInYears = parseFloat(l.term) / 12;
    const totalInt = principal * rate * timeInYears;
    const emi = (principal + totalInt) / parseFloat(l.term);

    const html = `
    <div style="font-family:monospace; padding:30px; border:2px solid #064e3b; line-height:1.6; max-width:700px; margin:auto;">
        <h2 style="text-align:center; color:#064e3b; border-bottom:2px solid #064e3b; padding-bottom:10px;">NEST BANK - LOAN STATEMENT</h2>
        <table style="width:100%; margin-top:20px; border-collapse:collapse;">
            <tr><td><b>LOAN ACC NO:</b></td><td>${l.loanAcc}</td><td><b>CIF:</b></td><td>${l.cif}</td></tr>
            <tr><td><b>HOLDER NAME:</b></td><td>${l.name.toUpperCase()}</td><td><b>LOAN TYPE:</b></td><td>${l.type}</td></tr>
            <tr><td><b>PAN CARD:</b></td><td>${l.pan}</td><td><b>ROI:</b></td><td>${l.roi}% (Fixed)</td></tr>
        </table>
        <hr style="margin:20px 0;">
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px; text-align:center;">
            <div style="border:1px solid #ccc; padding:10px;"><p style="font-size:10px; margin:0;">PRINCIPAL</p><p style="font-size:18px; font-weight:bold; margin:5px 0;">₹${principal.toLocaleString('en-IN')}</p></div>
            <div style="border:1px solid #ccc; padding:10px;"><p style="font-size:10px; margin:0;">TOTAL INTEREST</p><p style="font-size:18px; font-weight:bold; margin:5px 0;">₹${Math.round(totalInt).toLocaleString('en-IN')}</p></div>
            <div style="border:1px solid #ccc; padding:10px;"><p style="font-size:10px; margin:0;">MONTHLY EMI</p><p style="font-size:18px; font-weight:bold; color:#b91c1c; margin:5px 0;">₹${Math.round(emi).toLocaleString('en-IN')}</p></div>
        </div>
        <table style="width:100%; margin-top:30px; border:1px solid #000; font-size:12px;">
            <tr style="background:#064e3b; color:white;"><th style="padding:10px;">Description</th><th>Date</th><th>Status</th><th>Amount</th></tr>
            <tr><td style="padding:10px;">Loan Disbursal</td><td>${l.disburseDate}</td><td>SUCCESS</td><td>₹${principal.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding:10px;">First EMI Due</td><td>30 Days from Disb.</td><td>PENDING</td><td>₹${Math.round(emi).toLocaleString('en-IN')}</td></tr>
        </table>
        <p style="margin-top:40px; font-size:10px; text-align:center; color:#666;">COMPUTER GENERATED LOAN ADVICE</p>
    </div>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500);
}
function generateNOC(l) {
    const html = `<html><body style="font-family:monospace; padding:50px; border:4px double #064e3b; max-width: 800px; margin: auto;">
        <h1 style="text-align:center; color:#064e3b;">NEST SMALL FINANCE BANK</h1>
        <h2 style="text-align:center; text-decoration:underline;">NO OBJECTION CERTIFICATE (NOC)</h2>
        <p style="text-align:right;"><b>Date:</b> ${new Date().toLocaleDateString()}</p>
        <p><b>To Whom It May Concern,</b></p>
        <p>This is to certify that the loan account bearing number <b>${l.loanAcc}</b> sanctioned to <b>${l.name.toUpperCase()}</b> (CIF: ${l.cif}) has been fully repaid and settled in our books as of <b>${l.closeDate}</b>.</p>
        <p>The Bank holds no further dues, charges, or claims against the borrower regarding this facility. Any collateral/lien attached to this loan is hereby released.</p>
        <br><br><p><b>AUTHORIZED SIGNATORY</b><br>Branch Manager, NEST SFB</p>
        <p style="font-size:10px; color:#666; text-align:center; margin-top:50px;">This is a computer-generated certificate and does not require a physical signature.</p>
    </body></html>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500);
}