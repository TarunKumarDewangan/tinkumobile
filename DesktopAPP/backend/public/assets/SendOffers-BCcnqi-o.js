import{r as e}from"./rolldown-runtime-Dw2cE7zH.js";import{a as t,h as n,y as r}from"./vendor-react-CZ6eXxXM.js";import{n as i}from"./vendor-ui-DG_ijCa8.js";import{t as a}from"./axios-toAVjyjV.js";import{t as o}from"./index-DT6Zt_-o.js";import{t as s}from"./react-select.esm-9gqwPwQ7.js";var c=e(r(),1),l=t();function u(){let{hasFullAccess:e}=o();n();let[t,r]=(0,c.useState)([]),[u,d]=(0,c.useState)(null),[f,p]=(0,c.useState)(``),[m,h]=(0,c.useState)(``),[g,_]=(0,c.useState)(!1),[v,y]=(0,c.useState)(!0);(0,c.useEffect)(()=>{a.get(`/customers`).then(e=>{r(e.data)}).catch(e=>{console.error(e),i.error(`Failed to load customers`)}).finally(()=>{y(!1)})},[]);let b=async e=>{if(e.preventDefault(),!u){i.error(`Please select a customer`);return}if(!f.trim()){i.error(`Please enter the offer details`);return}_(!0);try{let e={customer_id:u.value,offer:f,voucher_code:m||null},t=await a.post(`/customers/send-offer`,e);i.success(t.data.message||`Offer sent successfully via WhatsApp!`),p(``),h(``)}catch(e){console.error(e),i.error(e.response?.data?.message||`Failed to send offer. Verify WhatsApp service.`)}finally{_(!1)}},x=[{value:`all`,label:`📣 ALL CUSTOMERS (BULK SEND)`},...t.map(e=>({value:e.id,label:`${e.name.toUpperCase()} (${e.phone})`}))];return(0,l.jsxs)(`div`,{className:`so-wrap`,children:[(0,l.jsx)(`style`,{children:`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    .so-wrap {
      background: linear-gradient(160deg, #f0f4ff 0%, #f8faff 60%, #fafbfe 100%);
      min-height: calc(100vh - 60px);
      padding: 24px;
      font-family: 'Inter', sans-serif;
    }
    .so-card {
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      border: 1px solid rgba(226, 232, 240, 0.8);
      max-width: 600px;
      margin: 0 auto;
    }
    .so-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #1e293b;
    }
    .so-subtitle {
      font-size: 0.8rem;
      color: #64748b;
      margin-bottom: 24px;
    }
    .so-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: block;
      margin-bottom: 6px;
    }
    .so-textarea {
      font-size: 0.9rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      padding: 10px 12px;
      width: 100%;
      background: #f8fafc;
      transition: all 0.18s;
      color: #1e293b;
      font-weight: 500;
      resize: vertical;
      min-height: 120px;
    }
    .so-textarea:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .so-input {
      font-size: 0.9rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      padding: 10px 12px;
      width: 100%;
      background: #f8fafc;
      transition: all 0.18s;
      color: #1e293b;
      font-weight: 600;
    }
    .so-input:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .so-btn-send {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
      padding: 12px 24px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.4px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .so-btn-send:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .so-btn-send:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `}),(0,l.jsxs)(`div`,{className:`so-card mt-3`,children:[(0,l.jsxs)(`div`,{className:`d-flex align-items-center gap-2 mb-1`,children:[(0,l.jsx)(`span`,{style:{fontSize:`1.5rem`},children:`✉️`}),(0,l.jsx)(`span`,{className:`so-title`,children:`Send Offers`})]}),(0,l.jsx)(`p`,{className:`so-subtitle`,children:`Compose and send custom offers or vouchers via WhatsApp to your customers.`}),v?(0,l.jsx)(`div`,{className:`d-flex justify-content-center py-5`,children:(0,l.jsx)(`div`,{className:`spinner-border text-primary`,role:`status`,children:(0,l.jsx)(`span`,{className:`visually-hidden`,children:`Loading Customers...`})})}):(0,l.jsxs)(`form`,{onSubmit:b,children:[(0,l.jsxs)(`div`,{className:`mb-4`,children:[(0,l.jsx)(`label`,{className:`so-label`,children:`Select Customer *`}),(0,l.jsx)(s,{options:x,value:u,onChange:d,placeholder:`TYPE NAME OR PHONE TO SEARCH...`,isClearable:!0,styles:{control:e=>({...e,backgroundColor:`#f8fafc`,borderColor:`#e2e8f0`,borderRadius:`9px`,padding:`2px`,fontSize:`0.9rem`,fontWeight:`500`,boxShadow:`none`,"&:hover":{borderColor:`#6366f1`}}),option:(e,t)=>({...e,color:`#1e293b`,fontSize:`0.85rem`,textTransform:`uppercase`,backgroundColor:t.isSelected?`#e0e7ff`:t.isFocused?`#f1f5f9`:`#fff`,"&:active":{backgroundColor:`#c7d2fe`}}),input:e=>({...e,fontSize:`0.9rem`,fontWeight:`500`}),singleValue:e=>({...e,fontSize:`0.9rem`,fontWeight:`500`}),placeholder:e=>({...e,fontSize:`0.9rem`,fontWeight:`500`})}}),u?.value===`all`&&(0,l.jsx)(`div`,{className:`form-text text-danger fw-bold small mt-1`,children:`⚠️ WARNING: This will loop and send a separate WhatsApp message to ALL customers in the system!`})]}),(0,l.jsxs)(`div`,{className:`mb-4`,children:[(0,l.jsx)(`label`,{className:`so-label`,children:`Offer / Message *`}),(0,l.jsx)(`textarea`,{className:`so-textarea`,placeholder:`TYPE OFFER DETAILS HERE...`,required:!0,value:f,onChange:e=>p(e.target.value)})]}),(0,l.jsxs)(`div`,{className:`mb-4`,children:[(0,l.jsx)(`label`,{className:`so-label`,children:`Voucher Code (Optional)`}),(0,l.jsx)(`input`,{type:`text`,className:`so-input text-uppercase`,placeholder:`E.G. TINKU100, SAVE50`,value:m,onChange:e=>h(e.target.value.toUpperCase())})]}),(0,l.jsx)(`button`,{type:`submit`,className:`so-btn-send`,disabled:g,children:g?(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`span`,{className:`spinner-border spinner-border-sm`,role:`status`,"aria-hidden":`true`}),`SENDING MESSAGES...`]}):(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`span`,{children:`💬`}),` SEND VIA WHATSAPP`]})})]})]})]})}export{u as default};