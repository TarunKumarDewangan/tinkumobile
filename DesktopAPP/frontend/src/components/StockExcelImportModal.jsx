import { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

export default function StockExcelImportModal({ show, onHide, products, categories, onAddItems }) {
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');

  const handleImport = () => {
    try {
      const lines = importText.split('\n');
      const items = [];
      
      const mobileNewCatId = categories?.find(c => c.slug?.toLowerCase() === 'mobile-new')?.id || 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('\t').map(p => p.trim());
        
        // Ensure row has at least 8 parts based on image: S/N, COMPANY, MODEL, MOP, RAM, STORAGE, COLOR, IMEI
        if (parts.length >= 8) {
          const [sn, company, model, mopStr, ram, storage, color, imei] = parts;
          
          // Skip header row
          if (sn.toLowerCase() === 's/n' || company.toLowerCase() === 'company') continue;
          
          const mop = parseFloat(mopStr) || 0;
          const fullProductName = `${company} ${model}`.trim();
          
          // Try to match existing product
          let productId = '';
          let isNew = true;
          
          const existingProduct = products.find(p => p.name.toLowerCase() === fullProductName.toLowerCase());
          
          if (existingProduct) {
             productId = existingProduct.id;
             isNew = false;
          }

          items.push({
            product_id: productId,
            is_new: isNew,
            new_product_name: isNew ? fullProductName : '',
            category_id: isNew ? mobileNewCatId : (existingProduct?.category_id || mobileNewCatId),
            imei: imei,
            ram: ram,
            storage: storage,
            color: color,
            quantity: 1,
            unit_price: existingProduct?.purchase_price || '',
            selling_price: mop || existingProduct?.selling_price || '',
            wholeseller_price: existingProduct?.wholeseller_price || '',
            min_selling_price: existingProduct?.min_selling_price || '',
            max_selling_price: existingProduct?.max_selling_price || '',
            incentive_amount: existingProduct?.incentive_amount || ''
          });
        } else {
            console.warn(`Line ${i+1} skipped due to insufficient columns: ${line}`);
        }
      }

      if (items.length === 0) {
        setError('No valid rows found. Please copy and paste from Excel matching the required columns (min 8 columns).');
        return;
      }

      onAddItems(items);
      setImportText('');
      setError('');
      onHide();
    } catch (e) {
      setError('Error parsing text. Ensure it is tab-separated (copied from Excel).');
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-bold fs-5">📥 Bulk Excel Import (Copy & Paste)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="alert alert-info py-2" style={{fontSize: '.85rem'}}>
          <strong>Expected Columns (Tab separated):</strong><br/>
          <code>S/N | COMPANY | MODEL | MOP | RAM | STORAGE | COLOR | IMEI</code><br/>
          <small className="text-muted">You can safely copy the header row, it will be skipped automatically.</small>
        </div>
        {error && <div className="alert alert-danger py-2" style={{fontSize: '.85rem'}}>{error}</div>}
        <textarea
          className="form-control"
          rows={10}
          placeholder="Paste your Excel data here..."
          value={importText}
          onChange={e => setImportText(e.target.value)}
          style={{fontSize: '.8rem', fontFamily: 'monospace', whiteSpace: 'pre'}}
        ></textarea>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={handleImport} disabled={!importText.trim()} style={{background: '#6366f1', borderColor: '#6366f1'}}>
          ✅ Process Import
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
