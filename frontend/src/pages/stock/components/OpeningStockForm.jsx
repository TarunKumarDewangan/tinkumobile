import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../api/axios';
import BarcodeScannerModal from '../../../components/BarcodeScannerModal';
import BulkScanModal from '../../../components/BulkScanModal';
import StockExcelImportModal from '../../../components/StockExcelImportModal';

export default function OpeningStockForm({ 
  openingStockItems, 
  setOpeningStockItems, 
  form, 
  setForm, 
  shops, 
  baseProducts, 
  categories, 
  isOwner, 
  loading, 
  setLoading,
  onSuccess 
}) {
  const [showBulkScan, setShowBulkScan] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [scanner, setScanner] = useState({ show: false, itemIndex: null });

  const updateOpeningItem = (i, field, val) => {
    const newItems = [...openingStockItems];
    newItems[i][field] = val;
    
    // Auto-split IMEIs if they are comma/space/tab-separated
    if (field === 'imei' && (val.includes(',') || val.includes('\n') || val.includes('\t') || (val.includes(' ') && val.trim().split(/[\s,]+/).length > 1))) {
      const imeis = val.split(/[\s,\t\r\n]+/).filter(Boolean);
      if (imeis.length > 1) {
          const baseItem = { ...newItems[i] };
          newItems[i].imei = imeis[0];
          newItems[i].quantity = 1;
          
          const newRows = imeis.slice(1).map(imei => ({
              ...baseItem,
              imei: imei,
              quantity: 1
          }));
          newItems.splice(i + 1, 0, ...newRows);
          setOpeningStockItems(newItems);
          return;
      }
    }

    if (field === 'product_id' && val) {
        const p = baseProducts.find(x => x.id == val);
        if (p) {
            newItems[i].unit_price = p.purchase_price;
            newItems[i].selling_price = p.selling_price;
            newItems[i].wholeseller_price = p.wholeseller_price || '';
            newItems[i].min_selling_price = p.min_selling_price || '';
            newItems[i].max_selling_price = p.max_selling_price || '';
            newItems[i].incentive_amount = p.incentive_amount || '';
            if (p.attributes) {
                newItems[i].ram = p.attributes.ram || '';
                newItems[i].storage = p.attributes.storage || '';
                newItems[i].color = p.attributes.color || '';
            }
        }
    }
    setOpeningStockItems(newItems);
  };

  const handleBulkAddItems = (newItems) => {
    setOpeningStockItems(prev => {
        let current = [...prev];
        // If first item is empty/default, remove it before merging
        if (current.length === 1 && !current[0].product_id && !current[0].imei && !current[0].new_product_name) {
            current = [];
        }

        // Prevent adding items that already exist in the list (by IMEI)
        const existingImeis = new Set(current.map(i => i.imei).filter(Boolean));
        const filteredNewItems = newItems.filter(item => {
            if (!item.imei) return true;
            if (existingImeis.has(item.imei)) {
                console.warn(`Skipping duplicate IMEI during import: ${item.imei}`);
                return false;
            }
            return true;
        });

        const skippedCount = newItems.length - filteredNewItems.length;
        if (skippedCount > 0) {
            toast.warning(`Skipped ${skippedCount} duplicate IMEI numbers.`);
        }

        return [...current, ...filteredNewItems];
    });
  };

  const handleFindEraseDuplicates = () => {
    const imeis = new Set();
    const uniqueItems = [];
    let duplicateCount = 0;

    openingStockItems.forEach(item => {
        if (item.imei && imeis.has(item.imei)) {
            duplicateCount++;
        } else {
            if (item.imei) imeis.add(item.imei);
            uniqueItems.push(item);
        }
    });

    if (duplicateCount > 0) {
        if (window.confirm(`Found ${duplicateCount} duplicate IMEI entries. Erase them?`)) {
            setOpeningStockItems(uniqueItems);
            toast.success(`Erased ${duplicateCount} duplicate entries.`);
        }
    } else {
        toast.info("No duplicate IMEIs found in the current list.");
    }
  };

  const removeOpeningItem = (i) => {
    setOpeningStockItems(openingStockItems.filter((_, idx) => idx !== i));
  };

  const handleBulkAddClick = () => {
    const pin = window.prompt("Enter Admin PIN to Bulk Add Products:");
    if (pin === "71727378") {
      setShowBulkScan(true);
    } else if (pin !== null) {
      toast.error("Incorrect PIN");
    }
  };

  const handleExcelImportClick = () => {
    const pin = window.prompt("Enter Admin PIN to Import Excel:");
    if (pin === "71727378") {
      setShowExcelImport(true);
    } else if (pin !== null) {
      toast.error("Incorrect PIN");
    }
  };

  const handleClearExcel = () => {
    const hasExcelItems = openingStockItems.some(i => i._from_excel);
    if (!hasExcelItems) {
      toast.info("No Excel items to clear.");
      return;
    }
    const pin = window.prompt("Enter Admin PIN to Clear Excel Imports:");
    if (pin === "71727378") {
      setOpeningStockItems(prev => prev.filter(i => !i._from_excel));
      toast.success("Cleared all items imported from Excel.");
    } else if (pin !== null) {
      toast.error("Incorrect PIN");
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (openingStockItems.length === 0) return;
    
    const invalid = openingStockItems.some(item => !item.is_new && !item.product_id);
    const invalidNew = openingStockItems.some(item => item.is_new && !item.new_product_name);
    if (invalid || invalidNew) {
        toast.error('Please complete all product selections');
        return;
    }

    setLoading(true);
    try {
        const payload = {
            items: openingStockItems,
            adjustment_date: form.adjustment_date,
            shop_id: form.shop_id,
            notes: form.notes
        };
        const response = await api.post('/stock-adjustments/bulk', payload);
        
        if (response.data.ignored_imeis && response.data.ignored_imeis.length > 0) {
             toast.warning(response.data.message, { autoClose: 8000 });
        } else {
             toast.success(response.data.message || `✅ Successfully added items to stock!`);
        }
        
        setOpeningStockItems([]);
        onSuccess && onSuccess();
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error saving stock');
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleBulkSubmit}>
      <div className="pf-card">
        <div className="pf-sec">📋 General Information</div>
        <div className="row g-3 mb-2">
          {isOwner && (
            <div className="col-12 col-md-4">
              <span className="pf-lbl">Target Shop / Branch *</span>
              <select className="pf-inp" style={{borderColor:'#6366f1'}} required value={form.shop_id} onChange={e => setForm({...form, shop_id: e.target.value})}>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name.toUpperCase()} {s.is_main ? '⭐' : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md-3">
            <span className="pf-lbl">Stock Entry Date</span>
            <input type="date" className="pf-inp" required value={form.adjustment_date} onChange={e => setForm({...form, adjustment_date: e.target.value})} />
          </div>
          <div className="col-12 col-md-5">
            <span className="pf-lbl">General Notes</span>
            <input type="text" className="pf-inp" placeholder="E.G. OPENING STOCK..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value.toUpperCase()})} />
          </div>
        </div>
      </div>

      <div className="pf-card">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="pf-sec mb-0">📦 Stock Items ({openingStockItems.length})</div>
          <div className="d-flex gap-2">
            <button type="button" className="pf-bulk shadow-sm" style={{background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', letterSpacing: 0.5}} onClick={handleFindEraseDuplicates}>
              🔍 Find & Erase Duplicates
            </button>
            <button type="button" className="pf-bulk shadow-sm" style={{background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', letterSpacing: 0.5}} onClick={handleClearExcel}>
              🗑️ Clear Excel Imports
            </button>
            <button type="button" className="pf-bulk shadow-sm" style={{background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', letterSpacing: 0.5}} onClick={handleExcelImportClick}>
              📥 Import Excel (PIN)
            </button>
            <button type="button" className="pf-bulk shadow-sm" style={{background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', letterSpacing: 0.5}} onClick={handleBulkAddClick}>
              + Bulk Add Products (PIN)
            </button>
          </div>
        </div>

        {openingStockItems.length === 0 ? (
          <div className="text-center py-5" style={{background:'#f8fafc', borderRadius:12, border:'2px dashed #cbd5e1'}}>
            <div style={{fontSize:'3rem', opacity:0.4, marginBottom:10}}>📥</div>
            <div className="fw-bold" style={{color:'#64748b'}}>No items added yet.</div>
            <div className="small text-muted mb-3">Use the Bulk Add button above to scan and add inventory.</div>
            <button type="button" className="btn btn-sm text-white fw-bold shadow-sm px-4" style={{background:'#6366f1', borderRadius:20}} onClick={handleBulkAddClick}>
              Start Bulk Entry
            </button>
          </div>
        ) : openingStockItems.map((item, i) => {
          const marginVal = parseFloat(item.selling_price || 0) - parseFloat(item.unit_price || 0);
          const marginPer = item.unit_price > 0 ? (marginVal / item.unit_price) * 100 : 0;
          
          return (
            <div key={i} className="pf-item">
              <button type="button" onClick={() => removeOpeningItem(i)} style={{position:'absolute',top:8,right:10,background:'none',border:'none',color:'#94a3b8',cursor:'pointer',fontSize:'.9rem',fontWeight:700,lineHeight:1}}>✕</button>
              
              <div className="row g-2 mb-2">
                <div className="col-12 col-md-3">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                    <span className="pf-lbl" style={{marginBottom:0}}>Product</span>
                    <label style={{fontSize:'.6rem',color:'#94a3b8',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                      New? <input type="checkbox" checked={item.is_new} onChange={e => updateOpeningItem(i, 'is_new', e.target.checked)} style={{accentColor:'#6366f1'}}/>
                    </label>
                  </div>
                  {item.is_new ? (
                    <input type="text" className="pf-inp" placeholder="PRODUCT NAME" required value={item.new_product_name} onChange={e => updateOpeningItem(i, 'new_product_name', e.target.value.toUpperCase())} />
                  ) : (
                    <select className="pf-inp" required value={item.product_id} onChange={e => updateOpeningItem(i, 'product_id', e.target.value)}>
                      <option value="">— CHOOSE PRODUCT —</option>
                      {baseProducts.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                    </select>
                  )}
                </div>

                <div className="col-12 col-md-4">
                  <span className="pf-lbl">IMEI / Serial Numbers</span>
                  <div className="d-flex flex-column gap-1">
                    {[...Array(item.quantity || 1)].map((_, idx) => {
                      const imeis = item.imei ? item.imei.split(/[\s,]+/).filter(Boolean) : [];
                      return (
                        <div key={idx} style={{display:'flex',gap:4}}>
                          <input 
                            type="text" 
                            className="pf-inp" 
                            style={{fontSize:'.72rem',padding:'4px 8px'}}
                            placeholder={`IMEI ${idx + 1}`} 
                            value={imeis[idx] || ''} 
                            onChange={e => {
                              const currentImeis = [...imeis];
                              currentImeis[idx] = e.target.value.toUpperCase();
                              updateOpeningItem(i, 'imei', currentImeis.join(' '));
                            }} 
                            onPaste={e => {
                              const pastedText = e.clipboardData.getData('text');
                              const splitImeis = pastedText.split(/[\s,]+/).filter(Boolean);
                              if (splitImeis.length > 1) {
                                  e.preventDefault();
                                  updateOpeningItem(i, 'imei', splitImeis.join(','));
                              }
                            }}
                          />
                          {idx === 0 && (
                            <button type="button" onClick={() => setScanner({ show: true, itemIndex: i })} style={{background:'#6366f1',border:'none',color:'#fff',borderRadius:7,padding:'0 9px',cursor:'pointer',fontSize:'.8rem'}}>📷</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="col-4 col-md-1">
                  <span className="pf-lbl">Qty</span>
                  <input type="number" className="pf-inp" style={{textAlign:'center',fontWeight:800}} min="1" value={item.quantity} onChange={e => updateOpeningItem(i, 'quantity', parseInt(e.target.value) || 1)} />
                </div>

                <div className="col-4 col-md-1">
                  <span className="pf-lbl">RAM</span>
                  <input type="text" className="pf-inp" placeholder="8GB" value={item.ram} onChange={e => updateOpeningItem(i, 'ram', e.target.value.toUpperCase())} />
                </div>
                <div className="col-4 col-md-1">
                  <span className="pf-lbl">Storage</span>
                  <input type="text" className="pf-inp" placeholder="128" value={item.storage} onChange={e => updateOpeningItem(i, 'storage', e.target.value.toUpperCase())} />
                </div>
                <div className="col-4 col-md-2">
                  <span className="pf-lbl">Color</span>
                  <input type="text" className="pf-inp" placeholder="RED" value={item.color} onChange={e => updateOpeningItem(i, 'color', e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="row g-2 align-items-end">
                <div className="col-4 col-md-2">
                  <span className="pf-price-lbl">DP ₹</span>
                  <input type="number" className="pf-inp" style={{fontWeight:700}} step="0.01" value={item.unit_price} onChange={e => updateOpeningItem(i, 'unit_price', e.target.value)} />
                </div>
                <div className="col-4 col-md-2">
                  <span className="pf-price-lbl" style={{color:'#059669'}}>MOP ₹</span>
                  <input type="number" className="pf-inp" style={{borderColor:'#6ee7b7',color:'#059669',fontWeight:700}} step="0.01" value={item.selling_price} onChange={e => updateOpeningItem(i, 'selling_price', e.target.value)} />
                </div>
                <div className="col-4 col-md-1">
                  <span className="pf-price-lbl" style={{color:'#6366f1'}}>WHOLE ₹</span>
                  <input type="number" className="pf-inp" style={{borderColor:'#a5b4fc',color:'#6366f1'}} step="0.01" value={item.wholeseller_price} onChange={e => updateOpeningItem(i, 'wholeseller_price', e.target.value)} />
                </div>
                <div className="col-4 col-md-1">
                  <span className="pf-price-lbl" style={{color:'#0284c7'}}>CUST ₹</span>
                  <input type="number" className="pf-inp" style={{borderColor:'#93c5fd',color:'#0284c7'}} step="0.01" value={item.max_selling_price} onChange={e => updateOpeningItem(i, 'max_selling_price', e.target.value)} />
                </div>
                <div className="col-4 col-md-1">
                  <span className="pf-price-lbl" style={{color:'#dc2626'}}>MIN ₹</span>
                  <input type="number" className="pf-inp" style={{borderColor:'#fca5a5',color:'#dc2626'}} step="0.01" value={item.min_selling_price} onChange={e => updateOpeningItem(i, 'min_selling_price', e.target.value)} />
                </div>
                <div className="col-4 col-md-1">
                  <span className="pf-price-lbl" style={{color:'#6366f1'}}>COM ₹</span>
                  <input type="number" className="pf-inp" style={{borderColor:'#a5b4fc',color:'#6366f1'}} step="0.01" value={item.incentive_amount} onChange={e => updateOpeningItem(i, 'incentive_amount', e.target.value)} />
                </div>
                <div className="col-12 col-md-4">
                  <div style={{background:'#f1f5f9',borderRadius:8,padding:'5px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'.62rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Margin</span>
                    <span style={{fontWeight:700,color:marginVal>=0?'#059669':'#dc2626',fontSize:'.78rem'}}>₹{marginVal.toLocaleString('en-IN')} ({marginPer.toFixed(1)}%)</span>
                  </div>
                    <div style={{textAlign:'right',marginTop:4,fontSize:'.75rem',color:'#64748b'}}>
                      Item Total: <span style={{fontWeight:700,color:'#6366f1',fontSize:'.88rem'}}>₹{(parseFloat(item.quantity||0)*parseFloat(item.unit_price||0)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
          );
        })}
      </div>

      <div style={{marginTop:24,textAlign:'right'}}>
        <button type="submit" disabled={loading} className="pf-submit green" style={{padding:'12px 60px',fontSize:'1rem'}}>
          {loading ? <span className="spinner-border spinner-border-sm me-2" /> : '✅ Confirm & Add to Stock'}
        </button>
      </div>

      <BarcodeScannerModal 
        show={scanner.show} 
        onHide={() => setScanner({ show: false, itemIndex: null })}
        onScanSuccess={(text) => {
          const newItems = [...openingStockItems];
          newItems[scanner.itemIndex].imei = text;
          setOpeningStockItems(newItems);
          toast.success(`Scanned: ${text}`);
        }}
      />

      <BulkScanModal 
        show={showBulkScan} 
        onHide={() => setShowBulkScan(false)}
        products={baseProducts}
        categories={categories}
        onAddItems={handleBulkAddItems}
      />

      <StockExcelImportModal
        show={showExcelImport}
        onHide={() => setShowExcelImport(false)}
        products={baseProducts}
        categories={categories}
        onAddItems={(items) => handleBulkAddItems(items.map(i => ({...i, _from_excel: true})))}
      />
    </form>
  );
}
