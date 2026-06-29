import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{a as t,h as n,l as r,y as i}from"./vendor-react-CZ6eXxXM.js";import{n as a}from"./vendor-ui-DG_ijCa8.js";import{t as o}from"./axios-toAVjyjV.js";import{t as s}from"./index-BwRu6Tn2.js";import{t as c}from"./formatters-yODfG97X.js";import{t as l}from"./DataBackupModal--1R7fUqH.js";var u=e(i(),1),d=t();function f(){let[e,t]=(0,u.useState)([]),[i,f]=(0,u.useState)(!0),[p,m]=(0,u.useState)([]),{hasFullAccess:h}=s(),g=n(),[_]=r(),v=_.get(`category_group`)||`new_mobile`,[y,b]=(0,u.useState)(!1),[x,S]=(0,u.useState)({from:``,to:``,bill_type:``,search:_.get(`search`)||``,shop_id:``,is_old_mobile:!1});(0,u.useEffect)(()=>{let e=_.get(`search`)||``;S(t=>({...t,search:e}))},[_]),(0,u.useEffect)(()=>{C(),h()&&o.get(`/shops`).then(e=>m(e.data))},[x]);let C=async()=>{f(!0);try{let{data:e}=await o.get(`/sale-invoices`,{params:{...x,category_group:v}});t(e.data||e)}catch{a.error(`Failed to load sales`)}finally{f(!1)}},w=async e=>{if(window.confirm(`Cancel this sale? Stock will be restored.`))try{await o.post(`/sale-invoices/${e}/cancel`),a.success(`Sale cancelled successfully`),C()}catch{a.error(`Error cancelling sale`)}},T=async e=>{if(window.confirm(`Mark this finance payment as RECEIVED?`))try{await o.post(`/sale-invoices/${e}/receive-finance`),a.success(`Finance payment marked as received`),C()}catch(e){a.error(e.response?.data?.message||`Failed to update finance status`)}},E=async e=>{if(window.confirm(`PERMANENTLY DELETE this invoice? Stock will be restored.`))try{await o.delete(`/sale-invoices/${e}`),a.success(`Invoice deleted`),C()}catch{a.error(`Error deleting invoice`)}},D=async e=>{if(window.confirm(`Convert this Kaccha bill to Pakka?`))try{let t=await o.post(`/sale-invoices/${e}/convert-to-pakka`);a.success(`Pakka bill created: ${t.data.invoice_no}`),C()}catch{a.error(`Conversion failed`)}},O=e=>{switch(e){case`paid`:return(0,d.jsx)(`span`,{className:`badge-paid`,children:`PAID`});case`partial`:return(0,d.jsx)(`span`,{className:`badge-partial`,children:`PARTIAL`});case`unpaid`:return(0,d.jsx)(`span`,{className:`badge-unpaid`,children:`UNPAID`});default:return null}};return(0,d.jsxs)(`div`,{className:`container-fluid py-3`,children:[(0,d.jsxs)(`div`,{className:`page-header mb-3 d-flex justify-content-between align-items-center`,children:[(0,d.jsxs)(`div`,{className:`text-uppercase`,children:[(0,d.jsxs)(`h2`,{className:`mb-0 fw-bold`,children:[`🧾 `,v===`master`?`Master Sales Management`:v===`other`?`Other Sales Management`:`SALES MANAGEMENT`]}),(0,d.jsx)(`p`,{className:`text-muted small mb-0`,children:v===`master`?`MANAGE CUSTOMER INVOICES ACROSS ALL CATEGORIES`:v===`other`?`MANAGE CUSTOMER INVOICES FOR ACCESSORIES & SIM CARDS`:`MANAGE CUSTOMER INVOICES, PAYMENTS AND BILLING`})]}),(0,d.jsxs)(`div`,{className:`d-flex gap-2`,children:[(0,d.jsx)(`button`,{onClick:()=>b(!0),className:`btn btn-outline-dark shadow-sm text-uppercase fw-bold`,children:`Backup / Restore`}),(0,d.jsx)(`button`,{onClick:()=>g(v===`master`?`/sales/new-master`:v&&v!==`master`?`/sales/new?category_group=${v}`:`/sales/new?category_group=new_mobile`),className:`btn btn-primary shadow-sm text-uppercase fw-bold`,children:`+ New Sale`})]})]}),(0,d.jsx)(l,{isOpen:y,onClose:()=>b(!1),onRefresh:C,title:`Sales Data Backup`,endpoint:`/sale-invoices`,typeLabel:`Sales`}),(0,d.jsx)(`div`,{className:`card sales-card shadow-sm mb-4 p-3 bg-white`,children:(0,d.jsxs)(`div`,{className:`row g-2 text-uppercase`,children:[(0,d.jsxs)(`div`,{className:`col-12 col-md-3`,children:[(0,d.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Date Range`}),(0,d.jsxs)(`div`,{className:`input-group input-group-sm`,children:[(0,d.jsx)(`input`,{type:`date`,className:`form-control`,value:x.from,onChange:e=>S({...x,from:e.target.value})}),(0,d.jsx)(`span`,{className:`input-group-text`,children:`—`}),(0,d.jsx)(`input`,{type:`date`,className:`form-control`,value:x.to,onChange:e=>S({...x,to:e.target.value})})]})]}),(0,d.jsxs)(`div`,{className:`col-12 col-md-2`,children:[(0,d.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Bill Type`}),(0,d.jsxs)(`select`,{className:`form-select form-select-sm`,value:x.bill_type,onChange:e=>S({...x,bill_type:e.target.value}),children:[(0,d.jsx)(`option`,{value:``,children:`ALL BILLS`}),(0,d.jsx)(`option`,{value:`kaccha`,children:`KACCHA`}),(0,d.jsx)(`option`,{value:`pakka`,children:`PAKKA`})]})]}),h()&&(0,d.jsxs)(`div`,{className:`col-12 col-md-2`,children:[(0,d.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Shop Branch`}),(0,d.jsxs)(`select`,{className:`form-select form-select-sm`,value:x.shop_id,onChange:e=>S({...x,shop_id:e.target.value}),children:[(0,d.jsx)(`option`,{value:``,children:`ALL BRANCHES`}),p.map(e=>(0,d.jsx)(`option`,{value:e.id,children:e.name.toUpperCase()},e.id))]})]}),(0,d.jsxs)(`div`,{className:`col-12 col-md-3`,children:[(0,d.jsx)(`label`,{className:`small text-muted mb-1 fw-bold`,children:`Search Invoice / Customer`}),(0,d.jsx)(`input`,{type:`text`,className:`form-control form-control-sm text-uppercase`,placeholder:`SEARCH...`,value:x.search,onChange:e=>S({...x,search:e.target.value})})]}),(0,d.jsx)(`div`,{className:`col-12 col-md-2 d-flex align-items-end`,children:(0,d.jsx)(`button`,{className:`btn btn-sm btn-outline-secondary w-100 fw-bold border-2`,onClick:()=>S({from:``,to:``,bill_type:``,search:``,shop_id:``,is_old_mobile:!1}),children:`RESET`})})]})}),(0,d.jsx)(`div`,{className:`sales-table-wrap bg-white`,children:(0,d.jsx)(`div`,{className:`table-responsive`,children:(0,d.jsxs)(`table`,{className:`sales-table mb-0 text-uppercase`,children:[(0,d.jsx)(`thead`,{children:(0,d.jsxs)(`tr`,{children:[(0,d.jsx)(`th`,{className:`ps-4`,children:`Customer Name`}),(0,d.jsx)(`th`,{children:`Products & Description`}),(0,d.jsx)(`th`,{children:`Date / Shop`}),(0,d.jsx)(`th`,{className:`text-end`,children:`Grand Total`}),(0,d.jsx)(`th`,{className:`text-end`,style:{color:`#475569`},children:`Discount`}),(0,d.jsx)(`th`,{className:`text-end`,children:`Paid`}),(0,d.jsx)(`th`,{className:`text-end`,children:`Balance`}),(0,d.jsx)(`th`,{className:`text-center`,style:{width:`230px`},children:`Actions`}),(0,d.jsx)(`th`,{children:`Invoice #`}),(0,d.jsx)(`th`,{className:`text-center`,children:`Status`})]})}),(0,d.jsx)(`tbody`,{children:i?(0,d.jsx)(`tr`,{children:(0,d.jsx)(`td`,{colSpan:10,className:`text-center py-5`,children:(0,d.jsx)(`div`,{className:`spinner-border text-primary`})})}):e.length===0?(0,d.jsx)(`tr`,{children:(0,d.jsx)(`td`,{colSpan:10,className:`text-center py-5 text-muted fw-bold`,children:`NO SALES FOUND.`})}):e.map(e=>{let t=e.finance_payment_status===`RECEIVED`?parseFloat(e.finance_amount||0):0,n=parseFloat(e.total_paid||0)+parseFloat(e.exchange_paid||0)+t,r=Math.max(0,parseFloat(e.grand_total)-n);return(0,d.jsxs)(`tr`,{className:e.is_cancelled?`opacity-50 text-decoration-line-through`:``,children:[(0,d.jsxs)(`td`,{className:`ps-4 cursor-pointer`,onClick:()=>g(v?`/sales/${e.id}?category_group=${v}`:`/sales/${e.id}`),children:[(0,d.jsx)(`span`,{className:`fw-bold text-decoration-underline`,style:{color:`#1e293b`},children:e.customer?.name}),(0,d.jsxs)(`div`,{className:`x-small text-muted`,style:{textDecoration:`none`},children:[`📞 `,e.customer?.phone]})]}),(0,d.jsx)(`td`,{children:e.items?.map((t,n)=>{let r=t.product?.brand?.name||t.product?.attributes?.brand||``,i=`${r?r+` `:``}${t.product?.name||`UNKNOWN PRODUCT`}`.toUpperCase();return(0,d.jsxs)(`div`,{className:`mb-2`,style:{borderBottom:n<e.items.length-1?`1px dashed #cbd5e1`:`none`,paddingBottom:n<e.items.length-1?`6px`:`0`},children:[(0,d.jsx)(`div`,{className:`fw-bold`,style:{fontSize:`.75rem`,color:`#1e293b`},children:i}),t.description&&(0,d.jsxs)(`div`,{className:`x-small text-muted fw-semibold`,style:{marginTop:`2px`},children:[`DESCRIPTION: `,t.description]})]},n)})}),(0,d.jsxs)(`td`,{children:[(0,d.jsx)(`div`,{className:`fw-bold`,children:c(e.sale_date)}),(0,d.jsx)(`div`,{className:`x-small text-muted`,children:e.shop?.name})]}),(0,d.jsxs)(`td`,{className:`text-end fw-bold`,children:[`₹`,parseFloat(e.grand_total).toLocaleString(`en-IN`)]}),(0,d.jsx)(`td`,{className:`text-end fw-bold`,style:{color:`#475569`},children:parseFloat(e.discount||0)+parseFloat(e.cash_discount||0)>0?`- ₹${(parseFloat(e.discount||0)+parseFloat(e.cash_discount||0)).toLocaleString(`en-IN`)}`:`—`}),(0,d.jsxs)(`td`,{className:`text-end fw-bold`,style:{color:`#1e293b`},children:[`₹`,parseFloat(e.total_paid).toLocaleString(`en-IN`)]}),(0,d.jsxs)(`td`,{className:`text-end fw-bold`,style:{color:r>0?`#1e293b`:`#64748b`},children:[`₹`,r.toLocaleString(`en-IN`)]}),(0,d.jsx)(`td`,{className:`text-center`,children:(0,d.jsxs)(`div`,{className:`d-flex justify-content-center gap-1`,children:[!e.is_cancelled&&(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(`button`,{onClick:()=>g(v?`/sales/${e.id}?category_group=${v}`:`/sales/${e.id}`),className:`pm-act-btn btn-xs`,title:`View Details`,children:`VIEW`}),(0,d.jsx)(`button`,{onClick:()=>g(v===`master`?`/sales/${e.id}/edit-master`:v?`/sales/${e.id}/edit?category_group=${v}`:`/sales/${e.id}/edit`),className:`pm-act-btn btn-xs`,children:`EDIT`}),e.bill_type===`kaccha`&&(0,d.jsx)(`button`,{onClick:()=>D(e.id),className:`pm-act-btn btn-xs`,children:`PAKKA`}),(0,d.jsx)(`button`,{onClick:()=>w(e.id),className:`pm-act-btn btn-xs`,children:`CANCEL`})]}),(0,d.jsx)(`button`,{onClick:()=>E(e.id),className:`pm-act-btn btn-xs`,style:{color:`#b91c1c`,borderColor:`#fca5a5`},children:`DEL`})]})}),(0,d.jsxs)(`td`,{className:`cursor-pointer`,onClick:()=>g(v?`/sales/${e.id}?category_group=${v}`:`/sales/${e.id}`),children:[(0,d.jsx)(`span`,{className:`fw-bold text-decoration-underline`,style:{color:`#1e293b`},children:e.invoice_no}),(0,d.jsx)(`div`,{className:`d-flex flex-wrap gap-1 mt-1`,children:(0,d.jsx)(`span`,{className:`badge-received`,style:{fontSize:`0.6rem`,padding:`2px 6px`},children:e.bill_type.toUpperCase()})})]}),(0,d.jsx)(`td`,{className:`text-center`,children:e.is_cancelled?(0,d.jsx)(`span`,{className:`badge-ordered`,children:`CANCELLED`}):(0,d.jsxs)(`div`,{className:`d-flex flex-column align-items-center gap-1`,children:[O(e.payment_status),parseFloat(e.finance_amount||0)>0&&(e.finance_payment_status===`RECEIVED`?(0,d.jsxs)(`span`,{className:`badge-paid`,style:{fontSize:`0.6rem`,marginTop:`2px`},children:[`EMI PAID: `,e.financer?.name||`FINANCER`,` (₹`,parseFloat(e.finance_amount).toLocaleString(`en-IN`),`)`]}):(0,d.jsxs)(`span`,{className:`badge-unpaid cursor-pointer`,style:{fontSize:`0.6rem`,marginTop:`2px`,cursor:`pointer`},title:`Click to mark finance payment as received`,onClick:()=>T(e.id),children:[`EMI PEND: `,e.financer?.name||`FINANCER`,` (₹`,parseFloat(e.finance_amount).toLocaleString(`en-IN`),`) ⏳`]}))]})})]},e.id)})})]})})}),(0,d.jsx)(`style`,{children:`
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
      `})]})}export{f as default};