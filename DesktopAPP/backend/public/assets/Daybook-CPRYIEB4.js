import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{a as t,s as n,y as r}from"./vendor-react-CZ6eXxXM.js";import{n as i}from"./vendor-ui-DG_ijCa8.js";import{t as a}from"./axios-toAVjyjV.js";var o=e(r(),1),s=t();function c(){let[e,t]=(0,o.useState)([]),[r,c]=(0,o.useState)({debit:0,credit:0}),[l,u]=(0,o.useState)(!1),[d,f]=(0,o.useState)({start:new Date().toISOString().split(`T`)[0],end:new Date().toISOString().split(`T`)[0]}),[p,m]=(0,o.useState)(`ALL`),h=(0,o.useMemo)(()=>e.filter(e=>p===`ALL`?!0:p===`SALE`?e.voucher_type===`SALE`:p===`REPAIR`?e.voucher_type===`REPAIR`:p===`RECHARGE`?(e.particulars||``).toUpperCase().includes(`RECHARGE`):p===`PURCHASE`?e.voucher_type===`PURCHASE`:p===`PAYMENT_RECEIPT`?[`PAYMENT`,`RECEIPT`].includes(e.voucher_type)&&!(e.particulars||``).toUpperCase().includes(`RECHARGE`):p===`AIRTEL`?e.voucher_type===`AIRTEL_RECOVERY`:!0),[e,p]),g=t=>e.filter(e=>t===`ALL`?!0:t===`SALE`?e.voucher_type===`SALE`:t===`REPAIR`?e.voucher_type===`REPAIR`:t===`RECHARGE`?(e.particulars||``).toUpperCase().includes(`RECHARGE`):t===`PURCHASE`?e.voucher_type===`PURCHASE`:t===`PAYMENT_RECEIPT`?[`PAYMENT`,`RECEIPT`].includes(e.voucher_type)&&!(e.particulars||``).toUpperCase().includes(`RECHARGE`):t===`AIRTEL`?e.voucher_type===`AIRTEL_RECOVERY`:!0).length,_=(0,o.useMemo)(()=>h.reduce((e,t)=>e+parseFloat(t.debit||0),0),[h]),v=(0,o.useMemo)(()=>h.reduce((e,t)=>e+parseFloat(t.credit||0),0),[h]),y=async()=>{u(!0);try{let{data:e}=await a.get(`/ledgers/daybook`,{params:{start_date:d.start,end_date:d.end}});t(e.entries),c(e.totals)}catch{i.error(`Failed to load Daybook`)}finally{u(!1)}};return(0,o.useEffect)(()=>{y()},[d]),(0,s.jsxs)(`div`,{className:`container-fluid py-4 animate-fadeIn`,children:[(0,s.jsxs)(`div`,{className:`d-flex justify-content-between align-items-center mb-4`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h2`,{className:`h4 mb-0 text-uppercase fw-bold text-dark`,children:`Daybook`}),(0,s.jsx)(`p`,{className:`text-muted small mb-0`,children:`View all unified ledger entries for the given date range`})]}),(0,s.jsxs)(`div`,{className:`d-flex gap-2 align-items-center bg-white p-2 rounded-2 border border-secondary border-opacity-25 shadow-none`,children:[(0,s.jsx)(`input`,{type:`date`,className:`form-control form-control-sm border-0 shadow-none bg-light`,value:d.start,onChange:e=>f({...d,start:e.target.value})}),(0,s.jsx)(`span`,{className:`text-muted small`,children:`to`}),(0,s.jsx)(`input`,{type:`date`,className:`form-control form-control-sm border-0 shadow-none bg-light`,value:d.end,onChange:e=>f({...d,end:e.target.value})})]})]}),(0,s.jsxs)(`div`,{className:`row g-3 mb-4`,children:[(0,s.jsx)(`div`,{className:`col-md-6`,children:(0,s.jsxs)(`div`,{className:`card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2`,children:[(0,s.jsx)(`div`,{className:`small text-uppercase fw-bold text-muted opacity-75 mb-1`,children:`Total Debit (Sales/Receivable/Paid Out)`}),(0,s.jsxs)(`div`,{className:`h4 mb-0 fw-bold text-dark`,children:[`₹`,_.toLocaleString(`en-IN`,{minimumFractionDigits:2})]})]})}),(0,s.jsx)(`div`,{className:`col-md-6`,children:(0,s.jsxs)(`div`,{className:`card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2`,children:[(0,s.jsx)(`div`,{className:`small text-uppercase fw-bold text-muted opacity-75 mb-1`,children:`Total Credit (Purchases/Payable/Received In)`}),(0,s.jsxs)(`div`,{className:`h4 mb-0 fw-bold text-dark`,children:[`₹`,v.toLocaleString(`en-IN`,{minimumFractionDigits:2})]})]})})]}),(0,s.jsx)(`div`,{className:`d-flex flex-wrap gap-2 mb-3 bg-light p-2 rounded-3 border`,children:[{id:`ALL`,label:`📖 All Entries`,color:`dark`},{id:`SALE`,label:`🧾 Sales`,color:`primary`},{id:`REPAIR`,label:`🔧 Repairs`,color:`warning`},{id:`RECHARGE`,label:`⚡ Recharges`,color:`info`},{id:`PURCHASE`,label:`🛒 Purchases`,color:`success`},{id:`PAYMENT_RECEIPT`,label:`💰 Payments/Receipts`,color:`secondary`},{id:`AIRTEL`,label:`📶 Airtel Recovery`,color:`danger`}].map(e=>{let t=p===e.id;return(0,s.jsxs)(`button`,{type:`button`,className:`btn btn-sm rounded-pill px-3 fw-bold transition-all ${t?`btn-${e.color}`:`btn-outline-secondary`}`,onClick:()=>m(e.id),style:{fontSize:`0.78rem`,borderWidth:`1.5px`,transform:t?`scale(1.03)`:`scale(1)`,boxShadow:t?`0 4px 10px rgba(0,0,0,0.1)`:`none`},children:[e.label,` `,(0,s.jsx)(`span`,{className:`badge ${t?`bg-white text-dark`:`bg-secondary text-white`} ms-1`,children:g(e.id)})]},e.id)})}),(0,s.jsx)(`div`,{className:`card border border-secondary border-opacity-25 rounded-2 shadow-none overflow-hidden bg-white`,children:(0,s.jsx)(`div`,{className:`table-responsive`,children:(0,s.jsxs)(`table`,{className:`table custom-tally-table mb-0`,children:[(0,s.jsx)(`thead`,{children:(0,s.jsxs)(`tr`,{children:[(0,s.jsx)(`th`,{className:`ps-3`,style:{width:`120px`},children:`Date`}),(0,s.jsx)(`th`,{children:`Entity Name`}),(0,s.jsx)(`th`,{style:{width:`150px`},children:`Voucher Type`}),(0,s.jsx)(`th`,{children:`Particulars`}),(0,s.jsx)(`th`,{className:`text-end`,style:{width:`140px`},children:`Debit (Dr)`}),(0,s.jsx)(`th`,{className:`text-end pe-3`,style:{width:`140px`},children:`Credit (Cr)`})]})}),(0,s.jsx)(`tbody`,{children:l?(0,s.jsx)(`tr`,{children:(0,s.jsx)(`td`,{colSpan:`6`,className:`text-center py-5 border-0`,children:(0,s.jsx)(`div`,{className:`spinner-border text-secondary`})})}):h.length===0?(0,s.jsx)(`tr`,{children:(0,s.jsxs)(`td`,{colSpan:`6`,className:`text-center py-5 text-muted border-0`,children:[(0,s.jsx)(`i`,{className:`bi bi-journal-x display-6 d-block mb-3 opacity-25`}),` No entries found matching the filter.`]})}):h.map(e=>(0,s.jsxs)(`tr`,{className:`tally-row`,children:[(0,s.jsx)(`td`,{className:`ps-3 text-muted small`,children:new Date(e.date).toLocaleDateString(`en-GB`)}),(0,s.jsx)(`td`,{children:(0,s.jsx)(n,{to:`/accounts/entity-ledger?id=${e.entity.id}&name=${encodeURIComponent(e.entity.name)}`,children:e.entity.name})}),(0,s.jsx)(`td`,{children:(0,s.jsx)(`span`,{className:`badge bg-light text-dark border border-secondary border-opacity-25`,children:e.voucher_type})}),(0,s.jsx)(`td`,{className:`small`,children:e.particulars}),(0,s.jsx)(`td`,{className:`text-end fw-bold ${e.debit>0?`text-dark`:`text-muted opacity-25`}`,children:e.debit>0?`₹${Number(e.debit).toLocaleString()}`:`—`}),(0,s.jsx)(`td`,{className:`text-end pe-3 fw-bold ${e.credit>0?`text-dark`:`text-muted opacity-25`}`,children:e.credit>0?`₹${Number(e.credit).toLocaleString()}`:`—`})]},e.id))})]})})}),(0,s.jsx)(`style`,{children:`
           @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
           .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
           
           .custom-tally-table {
               border-collapse: collapse !important;
               width: 100%;
           }
           .custom-tally-table thead th {
               background: #f8fafc;
               color: #475569;
               font-size: 0.75rem;
               font-weight: 700;
               text-transform: uppercase;
               padding: 0.65rem 0.5rem;
               border-bottom: 2px solid #cbd5e1 !important;
               border-right: 1px solid #cbd5e1 !important;
           }
           .custom-tally-table thead th:last-child {
               border-right: none !important;
           }
           .custom-tally-table tbody tr td {
               padding: 0.6rem 0.5rem;
               border-bottom: 1px solid #cbd5e1 !important;
               border-right: 1px solid #cbd5e1 !important;
           }
           .custom-tally-table tbody tr td:last-child {
               border-right: none !important;
           }
           .custom-tally-table tbody tr:last-child td {
               border-bottom: none !important;
           }
           .custom-tally-table tbody tr.tally-row:hover {
               background-color: #f1f5f9;
           }
           .custom-tally-table a {
               color: #1e293b;
               text-decoration: none;
               font-weight: bold;
           }
           .custom-tally-table a:hover {
               text-decoration: underline;
               color: #0d6efd;
           }
        `})]})}export{c as default};