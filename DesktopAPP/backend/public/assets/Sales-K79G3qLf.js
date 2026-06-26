import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{a as t,h as n,y as r}from"./vendor-react-CZ6eXxXM.js";import{n as i}from"./vendor-ui-DG_ijCa8.js";import{t as a}from"./axios-toAVjyjV.js";import{t as o}from"./index-CC7Dkp6f.js";import{t as s}from"./formatters-yODfG97X.js";import{t as c}from"./DataBackupModal--1R7fUqH.js";var l=e(r(),1),u=t();function d(){let[e,t]=(0,l.useState)([]),[r,d]=(0,l.useState)(!0),[f,p]=(0,l.useState)([]),{hasFullAccess:m}=o(),h=n(),[g,_]=(0,l.useState)(!1),[v,y]=(0,l.useState)({from:``,to:``,bill_type:``,search:``,shop_id:``,is_old_mobile:!1});(0,l.useEffect)(()=>{b(),m()&&a.get(`/shops`).then(e=>p(e.data))},[v]);let b=async()=>{d(!0);try{let{data:e}=await a.get(`/sale-invoices`,{params:v});t(e.data||e)}catch{i.error(`Failed to load sales`)}finally{d(!1)}},x=async e=>{if(window.confirm(`Cancel this sale? Stock will be restored.`))try{await a.post(`/sale-invoices/${e}/cancel`),i.success(`Sale cancelled successfully`),b()}catch{i.error(`Error cancelling sale`)}},S=async e=>{if(window.confirm(`Mark this finance payment as RECEIVED?`))try{await a.post(`/sale-invoices/${e}/receive-finance`),i.success(`Finance payment marked as received`),b()}catch(e){i.error(e.response?.data?.message||`Failed to update finance status`)}},C=async e=>{if(window.confirm(`PERMANENTLY DELETE this invoice? Stock will be restored.`))try{await a.delete(`/sale-invoices/${e}`),i.success(`Invoice deleted`),b()}catch{i.error(`Error deleting invoice`)}},w=async e=>{if(window.confirm(`Convert this Kaccha bill to Pakka?`))try{let t=await a.post(`/sale-invoices/${e}/convert-to-pakka`);i.success(`Pakka bill created: ${t.data.invoice_no}`),b()}catch{i.error(`Conversion failed`)}},T=e=>{switch(e){case`paid`:return(0,u.jsx)(`span`,{className:`badge-paid`,children:`PAID`});case`partial`:return(0,u.jsx)(`span`,{className:`badge-partial`,children:`PARTIAL`});case`unpaid`:return(0,u.jsx)(`span`,{className:`badge-unpaid`,children:`UNPAID`});default:return null}};return(0,u.jsxs)(`div`,{className:`container-fluid py-3`,children:[(0,u.jsxs)(`div`,{className:`page-header mb-3 d-flex justify-content-between align-items-center`,children:[(0,u.jsxs)(`div`,{className:`text-uppercase`,children:[(0,u.jsx)(`h2`,{className:`mb-0 fw-bold`,children:`🧾 SALES MANAGEMENT`}),(0,u.jsx)(`p`,{className:`text-muted small mb-0`,children:`MANAGE CUSTOMER INVOICES, PAYMENTS AND BILLING`})]}),(0,u.jsxs)(`div`,{className:`d-flex gap-2`,children:[(0,u.jsx)(`button`,{onClick:()=>_(!0),className:`btn btn-outline-dark shadow-sm text-uppercase fw-bold`,children:`Backup / Restore`}),(0,u.jsx)(`button`,{onClick:()=>h(`/sales/new`),className:`btn btn-primary shadow-sm text-uppercase fw-bold`,children:`+ New Sale`})]})]}),(0,u.jsx)(c,{isOpen:g,onClose:()=>_(!1),onRefresh:b,title:`Sales Data Backup`,endpoint:`/sale-invoices`,typeLabel:`Sales`}),(0,u.jsx)(`div`,{className:`card sales-card shadow-sm mb-4 p-3 bg-white`,children:(0,u.jsxs)(`div`,{className:`row g-2 text-uppercase`,children:[(0,u.jsxs)(`div`,{className:`col-12 col-md-3`,children:[(0,u.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Date Range`}),(0,u.jsxs)(`div`,{className:`input-group input-group-sm`,children:[(0,u.jsx)(`input`,{type:`date`,className:`form-control`,value:v.from,onChange:e=>y({...v,from:e.target.value})}),(0,u.jsx)(`span`,{className:`input-group-text`,children:`—`}),(0,u.jsx)(`input`,{type:`date`,className:`form-control`,value:v.to,onChange:e=>y({...v,to:e.target.value})})]})]}),(0,u.jsxs)(`div`,{className:`col-12 col-md-2`,children:[(0,u.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Bill Type`}),(0,u.jsxs)(`select`,{className:`form-select form-select-sm`,value:v.bill_type,onChange:e=>y({...v,bill_type:e.target.value}),children:[(0,u.jsx)(`option`,{value:``,children:`ALL BILLS`}),(0,u.jsx)(`option`,{value:`kaccha`,children:`KACCHA`}),(0,u.jsx)(`option`,{value:`pakka`,children:`PAKKA`})]})]}),m()&&(0,u.jsxs)(`div`,{className:`col-12 col-md-2`,children:[(0,u.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Shop Branch`}),(0,u.jsxs)(`select`,{className:`form-select form-select-sm`,value:v.shop_id,onChange:e=>y({...v,shop_id:e.target.value}),children:[(0,u.jsx)(`option`,{value:``,children:`ALL BRANCHES`}),f.map(e=>(0,u.jsx)(`option`,{value:e.id,children:e.name.toUpperCase()},e.id))]})]}),(0,u.jsxs)(`div`,{className:`col-12 col-md-3`,children:[(0,u.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Search Invoice / Customer`}),(0,u.jsx)(`input`,{type:`text`,className:`form-control form-control-sm text-uppercase`,placeholder:`SEARCH...`,value:v.search,onChange:e=>y({...v,search:e.target.value})})]}),(0,u.jsx)(`div`,{className:`col-12 col-md-2 d-flex align-items-end`,children:(0,u.jsx)(`button`,{className:`btn btn-sm btn-outline-secondary w-100 fw-bold border-2`,onClick:()=>y({from:``,to:``,bill_type:``,search:``,shop_id:``,is_old_mobile:!1}),children:`RESET`})})]})}),(0,u.jsx)(`div`,{className:`sales-table-wrap bg-white`,children:(0,u.jsx)(`div`,{className:`table-responsive`,children:(0,u.jsxs)(`table`,{className:`sales-table mb-0 text-uppercase`,children:[(0,u.jsx)(`thead`,{children:(0,u.jsxs)(`tr`,{children:[(0,u.jsx)(`th`,{className:`ps-4`,children:`Customer Name`}),(0,u.jsx)(`th`,{children:`Date / Shop`}),(0,u.jsx)(`th`,{className:`text-end`,children:`Grand Total`}),(0,u.jsx)(`th`,{className:`text-end`,style:{color:`#475569`},children:`Discount`}),(0,u.jsx)(`th`,{className:`text-end`,children:`Paid`}),(0,u.jsx)(`th`,{className:`text-end`,children:`Balance`}),(0,u.jsx)(`th`,{className:`text-center`,style:{width:`230px`},children:`Actions`}),(0,u.jsx)(`th`,{children:`Invoice #`}),(0,u.jsx)(`th`,{className:`text-center`,children:`Status`})]})}),(0,u.jsx)(`tbody`,{children:r?(0,u.jsx)(`tr`,{children:(0,u.jsx)(`td`,{colSpan:9,className:`text-center py-5`,children:(0,u.jsx)(`div`,{className:`spinner-border text-primary`})})}):e.length===0?(0,u.jsx)(`tr`,{children:(0,u.jsx)(`td`,{colSpan:9,className:`text-center py-5 text-muted fw-bold`,children:`NO SALES FOUND.`})}):e.map(e=>{let t=e.finance_payment_status===`RECEIVED`?parseFloat(e.finance_amount||0):0,n=parseFloat(e.total_paid||0)+parseFloat(e.exchange_paid||0)+t,r=Math.max(0,parseFloat(e.grand_total)-n);return(0,u.jsxs)(`tr`,{className:e.is_cancelled?`opacity-50 text-decoration-line-through`:``,children:[(0,u.jsxs)(`td`,{className:`ps-4 cursor-pointer`,onClick:()=>h(`/sales/${e.id}`),children:[(0,u.jsx)(`span`,{className:`fw-bold text-decoration-underline`,style:{color:`#1e293b`},children:e.customer?.name}),(0,u.jsxs)(`div`,{className:`x-small text-muted`,style:{textDecoration:`none`},children:[`📞 `,e.customer?.phone]})]}),(0,u.jsxs)(`td`,{children:[(0,u.jsx)(`div`,{className:`fw-bold`,children:s(e.sale_date)}),(0,u.jsx)(`div`,{className:`x-small text-muted`,children:e.shop?.name})]}),(0,u.jsxs)(`td`,{className:`text-end fw-bold`,children:[`₹`,parseFloat(e.grand_total).toLocaleString(`en-IN`)]}),(0,u.jsx)(`td`,{className:`text-end fw-bold`,style:{color:`#475569`},children:parseFloat(e.discount||0)+parseFloat(e.cash_discount||0)>0?`- ₹${(parseFloat(e.discount||0)+parseFloat(e.cash_discount||0)).toLocaleString(`en-IN`)}`:`—`}),(0,u.jsxs)(`td`,{className:`text-end fw-bold`,style:{color:`#1e293b`},children:[`₹`,parseFloat(e.total_paid).toLocaleString(`en-IN`)]}),(0,u.jsxs)(`td`,{className:`text-end fw-bold`,style:{color:r>0?`#1e293b`:`#64748b`},children:[`₹`,r.toLocaleString(`en-IN`)]}),(0,u.jsx)(`td`,{className:`text-center`,children:(0,u.jsxs)(`div`,{className:`d-flex justify-content-center gap-1`,children:[!e.is_cancelled&&(0,u.jsxs)(u.Fragment,{children:[(0,u.jsx)(`button`,{onClick:()=>h(`/sales/${e.id}`),className:`pm-act-btn btn-xs`,title:`View Details`,children:`VIEW`}),(0,u.jsx)(`button`,{onClick:()=>h(`/sales/${e.id}/edit`),className:`pm-act-btn btn-xs`,children:`EDIT`}),e.bill_type===`kaccha`&&(0,u.jsx)(`button`,{onClick:()=>w(e.id),className:`pm-act-btn btn-xs`,children:`PAKKA`}),(0,u.jsx)(`button`,{onClick:()=>x(e.id),className:`pm-act-btn btn-xs`,children:`CANCEL`})]}),(0,u.jsx)(`button`,{onClick:()=>C(e.id),className:`pm-act-btn btn-xs`,style:{color:`#b91c1c`,borderColor:`#fca5a5`},children:`DEL`})]})}),(0,u.jsxs)(`td`,{className:`cursor-pointer`,onClick:()=>h(`/sales/${e.id}`),children:[(0,u.jsx)(`span`,{className:`fw-bold text-decoration-underline`,style:{color:`#1e293b`},children:e.invoice_no}),(0,u.jsx)(`div`,{className:`d-flex flex-wrap gap-1 mt-1`,children:(0,u.jsx)(`span`,{className:`badge-received`,style:{fontSize:`0.6rem`,padding:`2px 6px`},children:e.bill_type.toUpperCase()})})]}),(0,u.jsx)(`td`,{className:`text-center`,children:e.is_cancelled?(0,u.jsx)(`span`,{className:`badge-ordered`,children:`CANCELLED`}):(0,u.jsxs)(`div`,{className:`d-flex flex-column align-items-center gap-1`,children:[T(e.payment_status),parseFloat(e.finance_amount||0)>0&&(e.finance_payment_status===`RECEIVED`?(0,u.jsxs)(`span`,{className:`badge-paid`,style:{fontSize:`0.6rem`,marginTop:`2px`},children:[`EMI PAID: `,e.financer?.name||`FINANCER`,` (₹`,parseFloat(e.finance_amount).toLocaleString(`en-IN`),`)`]}):(0,u.jsxs)(`span`,{className:`badge-unpaid cursor-pointer`,style:{fontSize:`0.6rem`,marginTop:`2px`,cursor:`pointer`},title:`Click to mark finance payment as received`,onClick:()=>S(e.id),children:[`EMI PEND: `,e.financer?.name||`FINANCER`,` (₹`,parseFloat(e.finance_amount).toLocaleString(`en-IN`),`) ⏳`]}))]})})]},e.id)})})]})})}),(0,u.jsx)(`style`,{children:`
          .x-small { font-size: 0.65rem; }
          .btn-xs { padding: 2px 6px; font-size: 0.7rem; font-weight: bold; }
          .sales-card {
              border: 1px solid #cbd5e1 !important;
              box-shadow: none !important;
              border-radius: 8px;
          }
          .sales-table-wrap {
              background: #fff;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #cbd5e1;
              box-shadow: none !important;
          }
          .sales-table {
              width: 100%;
              border-collapse: collapse;
              font-size: .78rem;
          }
          .sales-table thead tr {
              background: #f1f5f9;
              border-bottom: 2px solid #cbd5e1;
          }
          .sales-table thead th {
              color: #1e293b;
              font-size: .65rem;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              padding: 12px 14px;
              border: 1px solid #cbd5e1 !important;
          }
          .sales-table tbody tr {
              border-bottom: 1px solid #cbd5e1;
          }
          .sales-table tbody tr:hover {
              background: #f8fafc;
          }
          .sales-table td {
              padding: 12px 14px;
              vertical-align: top;
              border: 1px solid #cbd5e1 !important;
              color: #1e293b;
          }

          /* Desaturated Badges */
          .badge-ordered {
              background: #f8fafc;
              color: #475569;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 10px;
              border-radius: 4px;
              border: 1px solid #cbd5e1;
              letter-spacing: .5px;
              display: inline-block;
          }
          .badge-received {
              background: #f1f5f9;
              color: #1e293b;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 10px;
              border-radius: 4px;
              border: 1px solid #94a3b8;
              letter-spacing: .5px;
              display: inline-block;
          }
          .badge-unpaid {
              background: #fff;
              color: #b91c1c;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #fca5a5;
              display: inline-block;
          }
          .badge-partial {
              background: #fff;
              color: #0284c7;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #bae6fd;
              display: inline-block;
          }
          .badge-paid {
              background: #fff;
              color: #16a34a;
              font-size: .6rem;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #bbf7d0;
              display: inline-block;
          }
          .cursor-pointer {
              cursor: pointer;
          }
      `})]})}export{d as default};