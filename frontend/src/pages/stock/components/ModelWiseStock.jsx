import React, { useState } from 'react';

export default function ModelWiseStock({ products, loading }) {
  const [showModels, setShowModels] = useState(true);

  // Group products by Brand and then by Model + Config
  const groupedData = products.reduce((acc, p) => {
    let brand = (p.attributes?.brand || '').trim();
    if (!brand) {
      // Try to extract brand from the first word of the name (e.g. "SAMSUNG A55" -> "SAMSUNG")
      brand = p.name ? p.name.split(' ')[0] : 'OTHER';
    }
    brand = brand.toUpperCase();

    const modelAttr = (p.attributes?.model || '').trim();
    let model = modelAttr;
    if (!model) {
      // If model attribute is missing, use the full name but remove the brand prefix if it exists
      model = p.name || 'UNKNOWN';
      if (model.toUpperCase().startsWith(brand)) {
        model = model.substring(brand.length).trim();
      }
    }
    model = model.toUpperCase();
    const ram = p.attributes?.ram || '';
    const storage = p.attributes?.storage || '';
    const config = ram || storage ? `(${ram}${ram && storage ? '/' : ''}${storage})` : '';
    const modelWithConfig = `${model} ${config}`.trim();
    const stock = parseInt(p.current_stock || 0);

    if (!acc[brand]) acc[brand] = { total: 0, models: {} };
    if (!acc[brand].models[modelWithConfig]) acc[brand].models[modelWithConfig] = 0;
    
    acc[brand].models[modelWithConfig] += stock;
    acc[brand].total += stock;
    return acc;
  }, {});

  const sortedBrands = Object.keys(groupedData).sort();

  return (
    <div className="fade-in">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="text-muted small fw-bold text-uppercase letter-spacing-1">
          📊 Inventory Distribution
        </div>
        <label style={{display:'flex',alignItems:'center',gap:10,background:'#fff',padding:'6px 14px',borderRadius:10,cursor:'pointer',border:'1.5px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}>
          <input 
            type="checkbox" 
            checked={showModels}
            onChange={e => setShowModels(e.target.checked)}
            style={{accentColor:'#6366f1',width:16,height:16}}
          />
          <span style={{fontSize:'.7rem',fontWeight:800,color:'#475569',letterSpacing:.5}}>SHOW MODEL DETAILS</span>
        </label>
      </div>

      <div className="pm-table-wrap">
        <div className="table-responsive">
          <table className="pm-table">
            <thead>
              <tr>
                <th className="ps-4" style={{ width: '40%' }}>Company / Brand</th>
                <th style={{ width: '40%' }}>{showModels ? 'Model & Configuration' : ''}</th>
                <th className="text-center" style={{ width: '20%' }}>Total Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-center py-5"><div className="spinner-border text-primary"/></td></tr>
              ) : sortedBrands.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-5 text-muted fw-bold">No stock data available</td></tr>
              ) : sortedBrands.map(brand => (
                <React.Fragment key={brand}>
                  <tr style={{ background: '#f8fafc', borderLeft: '4px solid #6366f1' }}>
                    <td className="ps-4 fw-800 text-primary" style={{ fontSize: '.85rem' }}>
                      🏢 {brand}
                    </td>
                    <td className="text-muted small italic">
                      {showModels ? `${Object.keys(groupedData[brand].models).length} Variants` : ''}
                    </td>
                    <td className="text-center">
                      <span className="pm-badge" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: '800', fontSize: '.75rem' }}>
                        {groupedData[brand].total} PCS
                      </span>
                    </td>
                  </tr>
                  {showModels && Object.keys(groupedData[brand].models).sort().map(modelConfig => (
                    <tr key={brand + modelConfig}>
                      <td className="ps-5"></td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#334155', fontSize: '.78rem' }}>
                          📱 {modelConfig}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="pm-badge" style={{ 
                          background: groupedData[brand].models[modelConfig] > 0 ? '#f0fdf4' : '#fee2e2', 
                          color: groupedData[brand].models[modelConfig] > 0 ? '#166534' : '#991b1b', 
                          border: `1px solid ${groupedData[brand].models[modelConfig] > 0 ? '#bbf7d0' : '#fecaca'}`,
                          minWidth: '60px',
                          fontSize: '.7rem'
                        }}>
                          {groupedData[brand].models[modelConfig]} PCS
                        </span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
