import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import BulkScanModal from '../../components/BulkScanModal';

export default function PurchaseForm() {
  const [searchParams] = useSearchParams();
  const category_group = searchParams.get('category_group') || 'new_mobile';
  const defaultCategoryId = category_group === 'other' ? 3 : 1;
  const [suppliers, setSuppliers] = useState([]);
  const [entitySuppliers, setEntitySuppliers] = useState([]);
  const [bankEntities, setBankEntities] = useState([]);
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands]         = useState([]);
  const [shops, setShops]           = useState([]);
  const [items, setItems]         = useState([]);
  const [form, setForm] = useState({
    shop_id: 1, // TinkuMobiles Main Branch as default
    supplier_id: '',
    purchase_date: new Date().toISOString().slice(0,10),
    received_at: new Date().toISOString().slice(0,10),
    status: 'ordered',
    bill_type: 'pakka',
    discount: 0,
    total_paid: 0,
    cgst_rate: 9,
    sgst_rate: 9,
    calculate_gst: true,
    cash_discount: 0,
    is_cash_discount_on_bill: true,
    notes: '',
    expected_delivery_date: '',
    rounding_mode: 'auto',
    round_off: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    is_gst_manual: false,
    gst_rounding_mode: '2pt',
    payment_method: 'CASH',
    other_payment_mode: ''
  });
  const [isManualRound, setIsManualRound] = useState(false);
  const [isManualGst, setIsManualGst] = useState(false);
  const navigate = useNavigate();
  const { id }     = useParams();
  const { isOwner, hasFullAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const enableBulkAdd = true; // Set to true to show "+ Bulk Add" button later

  const supplierOptions = useMemo(() => {
    const opts = [];
    if (suppliers.length > 0) {
      opts.push({
        label: '📋 Registered Suppliers',
        options: suppliers.map(s => ({ value: String(s.id), label: s.name }))
      });
    }
    if (entitySuppliers.length > 0) {
      opts.push({
        label: '🏢 Distributors / Entities',
        options: entitySuppliers.map(e => ({ value: `entity-${e.id}`, label: `${e.name} (${e.type})` }))
      });
    }
    return opts;
  }, [suppliers, entitySuppliers]);

  const selectedSupplierOption = useMemo(() => {
    if (!form.supplier_id) return null;
    for (const group of supplierOptions) {
      const found = group.options.find(opt => opt.value === String(form.supplier_id));
      if (found) return found;
    }
    return null;
  }, [form.supplier_id, supplierOptions]);

  // Quick Add Supplier
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    type: '',
    phone: '',
    address: '',
    email: '',
    gst_number: '',
    opening_balance: 0,
    balance_type: 'RECEIVABLE',
    description: '',
    voucher_code: '',
    events: []
  });
  const [customTypes, setCustomTypes] = useState([]);
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);

  useEffect(() => {
    loadSuppliers();
    api.get('/products', { params: { category_group } }).then(r  => {
      setProducts(r.data);
    });
    api.get('/categories').then(r => setCategories(r.data));
    api.get('/brands').then(r => setBrands(r.data));
    if (hasFullAccess()) {
      api.get('/shops').then(r => setShops(r.data));
    }

    if (id) {
      setLoading(true);
      api.get(`/purchase-invoices/${id}`).then(r => {
        const p = r.data;
        setForm({
          shop_id: p.shop_id,
          supplier_id: p.supplier_id,
          purchase_date: p.purchase_date,
          received_at: p.received_at ? new Date(p.received_at).toISOString().slice(0,10) : '',
          status: p.status,
          bill_type: p.bill_type || 'pakka',
          discount: p.discount,
          total_paid: p.total_paid || 0,
          cgst_rate: p.cgst_rate || 9,
          sgst_rate: p.sgst_rate || 9,
          calculate_gst: p.calculate_gst ?? true,
          cash_discount: p.cash_discount || 0,
          is_cash_discount_on_bill: p.is_cash_discount_on_bill ?? true,
          notes: p.notes || '',
          expected_delivery_date: p.expected_delivery_date || '',
          rounding_mode: p.rounding_mode || 'auto',
          round_off: p.round_off || 0,
          cgst_amount: p.cgst_amount || 0,
          sgst_amount: p.sgst_amount || 0,
          is_gst_manual: p.is_gst_manual ?? false,
          gst_rounding_mode: p.gst_rounding_mode || '2pt',
          payment_method: p.payment_method || 'CASH',
          other_payment_mode: p.other_payment_mode || ''
        });
        if (p.rounding_mode === 'manual') setIsManualRound(true);
        if (p.is_gst_manual) setIsManualGst(true);
        const rawRows = p.items.map(i => {
          const unit_price = parseFloat(i.unit_price) || 0;
          const gst = parseFloat(i.calc_gst_rate ?? 18) || 0;
          const tDisc = parseFloat(i.trade_disc_pct ?? 3.85) || 0;
          const cDisc = parseFloat(i.cash_disc_pct ?? 2) || 0;
          // apply_gst governs whether THIS line item is included in the invoice's GST-taxable
          // base (see InvoiceService::calculateTotals()). It must default to the invoice's own
          // GST setting when not yet explicitly recorded — gating on whether the product record
          // happens to have a gst_rate attribute was wrong and silently zeroed out GST on any
          // GST-applicable purchase whose product was never given that attribute.
          const applyGst = i.apply_gst !== null
            ? !!i.apply_gst
            : (p.calculate_gst ?? true);

          const factor = (1 - tDisc/100) * (1 - cDisc/100);
          const rate_ex_gst = factor > 0 ? parseFloat((unit_price / factor).toFixed(2)) : unit_price;
          const dp_inc_gst = applyGst ? parseFloat((rate_ex_gst * (1 + gst/100)).toFixed(2)) : rate_ex_gst;

          return {
            product_id: i.product_id,
            brand_id: i.product?.brand_id || '',
            is_new: false,
            new_product_name: '',
            category_id: i.product?.category_id || '',
            imei_list: i.imei ? i.imei.split(/[\s,]+/).filter(Boolean) : [''],
            ram: i.ram || '',
            storage: i.storage || '',
            color: i.color || '',
            quantity: i.quantity,
            unit_price: unit_price,
            rate_ex_gst: rate_ex_gst,
            dp_inc_gst: dp_inc_gst,
            calc_gst_rate: gst,
            trade_disc_pct: tDisc,
            cash_disc_pct: cDisc,
            apply_gst: applyGst,
            selling_price: i.selling_price || '',
            wholeseller_price: i.wholeseller_price || '',
            min_selling_price: i.min_selling_price || '',
            max_selling_price: i.max_selling_price || '',
            incentive_amount: i.incentive_amount || ''
          };
        });
        // Merge rows with same product+specs+price (old purchases saved one-row-per-IMEI)
        const grouped = [];
        const seenKeys = {};
        rawRows.forEach(row => {
          const key = `${row.product_id}|${(row.ram||'').toLowerCase()}|${(row.storage||'').toLowerCase()}|${(row.color||'').toLowerCase()}|${String(row.unit_price)}`;
          const idx = seenKeys[key];
          if (idx !== undefined) {
            grouped[idx].imei_list.push(...row.imei_list);
            grouped[idx].quantity = grouped[idx].imei_list.filter(Boolean).length || grouped[idx].quantity + row.quantity;
          } else {
            seenKeys[key] = grouped.length;
            grouped.push({ ...row, imei_list: [...row.imei_list] });
          }
        });
        setItems(grouped);
      }).finally(() => setLoading(false));
    }
  }, [isOwner, id]);

  const loadSuppliers = async () => {
    const [suppRes, entRes] = await Promise.all([
      api.get('/suppliers'),
      api.get('/entities').catch(() => ({ data: [] }))
    ]);
    setSuppliers(suppRes.data);
    // Entities with SUPPLIER, DISTRIBUTOR or SHOP_CUSTOMER type appear in a separate group
    const entityList = (entRes.data || []).filter(e =>
      ['SUPPLIER', 'DISTRIBUTOR', 'SHOP_CUSTOMER'].includes((e.type || '').toUpperCase())
    );
    setEntitySuppliers(entityList);
    setBankEntities((entRes.data || []).filter(e => ['BANK', 'CARD', 'UPI'].includes(e.type)));

    // Extract custom types from loaded entities
    const types = (entRes.data || []).map(e => e.type).filter(Boolean);
    const uniqueCustomTypes = Array.from(new Set(types)).filter(
      t => !['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'BANK', 'CARD', 'UPI', 'OTHER'].includes(t)
    );
    setCustomTypes(uniqueCustomTypes);
  };

  const handleQuickSupplierAdd = async (e) => {
    e.preventDefault();
    if (supplierSubmitting) return;
    setSupplierSubmitting(true);
    try {
      const { data } = await api.post('/entities', newSupplier);
      toast.success('✅ Entity added successfully!');
      setEntitySuppliers(prev => [...prev, data]);
      setForm(prev => ({ ...prev, supplier_id: `entity-${data.id}` }));
      setShowSupplierModal(false);
      setNewSupplier({
        name: '',
        type: '',
        phone: '',
        address: '',
        email: '',
        gst_number: '',
        opening_balance: 0,
        balance_type: 'RECEIVABLE',
        description: '',
        voucher_code: '',
        events: []
      });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add entity');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  
  const handleCreateBrand = async (inputValue) => {
    try {
      const res = await api.post('/brands', { name: inputValue.toUpperCase() });
      setBrands(prev => [...prev, res.data]);
      return res.data.id;
    } catch (e) {
      toast.error('Failed to create company/brand');
      return null;
    }
  };

  const duplicateRow = (i, type) => {
    const item = { ...items[i], imei_list: [''], quantity: 1 };
    if (type === 'color') {
      item.color = '';
    } else if (type === 'specs') {
      item.color = '';
      item.ram = '';
      item.storage = '';
    }
    const newItems = [...items];
    newItems.splice(i + 1, 0, item);
    setItems(newItems);
  };
  
  const updateItem = (i, field, val) => {
    const a = [...items];
    a[i][field] = val;

    if (['dp_inc_gst', 'rate_ex_gst', 'calc_gst_rate', 'trade_disc_pct', 'cash_disc_pct', 'unit_price'].includes(field)) {
      const gst = parseFloat(a[i].calc_gst_rate ?? 18) || 0;
      const tDisc = parseFloat(a[i].trade_disc_pct ?? 3.85) || 0;
      const cDisc = parseFloat(a[i].cash_disc_pct ?? 2) || 0;

      if (field === 'dp_inc_gst') {
        const dp = parseFloat(val) || 0;
        if (dp > 0) {
          const baseExGst = dp / (1 + (gst / 100));
          a[i].rate_ex_gst = parseFloat(baseExGst.toFixed(2));
          const afterTDisc = baseExGst - (baseExGst * tDisc / 100);
          const afterCDisc = afterTDisc - (afterTDisc * cDisc / 100);
          a[i].unit_price = parseFloat(afterCDisc.toFixed(2));
          a[i].selling_price = dp;
        } else {
          a[i].rate_ex_gst = '';
          a[i].unit_price = 0;
          a[i].selling_price = '';
        }
      } else if (field === 'rate_ex_gst') {
        const baseExGst = parseFloat(val) || 0;
        if (baseExGst > 0) {
          a[i].dp_inc_gst = parseFloat((baseExGst * (1 + (gst / 100))).toFixed(2));
          a[i].selling_price = a[i].dp_inc_gst;
          const afterTDisc = baseExGst - (baseExGst * tDisc / 100);
          const afterCDisc = afterTDisc - (afterTDisc * cDisc / 100);
          a[i].unit_price = parseFloat(afterCDisc.toFixed(2));
        } else {
          a[i].dp_inc_gst = '';
          a[i].unit_price = 0;
          a[i].selling_price = '';
        }
      } else if (field === 'unit_price') {
        const unit_price = parseFloat(val) || 0;
        a[i].unit_price = unit_price;
        const factor = (1 - tDisc/100) * (1 - cDisc/100);
        const baseExGst = factor > 0 ? unit_price / factor : unit_price;
        a[i].rate_ex_gst = parseFloat(baseExGst.toFixed(2));
        a[i].dp_inc_gst = parseFloat((baseExGst * (1 + (gst / 100))).toFixed(2));
        a[i].selling_price = a[i].dp_inc_gst;
      } else {
        const baseExGst = parseFloat(a[i].rate_ex_gst) || 0;
        const dp = parseFloat(a[i].dp_inc_gst) || 0;

        if (baseExGst > 0) {
          a[i].dp_inc_gst = parseFloat((baseExGst * (1 + (gst / 100))).toFixed(2));
          a[i].selling_price = a[i].dp_inc_gst;
          const afterTDisc = baseExGst - (baseExGst * tDisc / 100);
          const afterCDisc = afterTDisc - (afterTDisc * cDisc / 100);
          a[i].unit_price = parseFloat(afterCDisc.toFixed(2));
        } else if (dp > 0) {
          const calcBase = dp / (1 + (gst / 100));
          a[i].rate_ex_gst = parseFloat(calcBase.toFixed(2));
          a[i].selling_price = dp;
          const afterTDisc = calcBase - (calcBase * tDisc / 100);
          const afterCDisc = afterTDisc - (afterTDisc * cDisc / 100);
          a[i].unit_price = parseFloat(afterCDisc.toFixed(2));
        }
      }
    }
    
    // Auto-fill attributes if an existing product is selected
    if (field === 'product_id') {
      const p = products.find(x => x.id == val);
      if (p) {
        if (p.purchase_price && parseFloat(p.purchase_price) > 0) {
          a[i].unit_price = p.purchase_price;
          const gst = parseFloat(a[i].calc_gst_rate ?? 18) || 0;
          const tDisc = parseFloat(a[i].trade_disc_pct ?? 3.85) || 0;
          const cDisc = parseFloat(a[i].cash_disc_pct ?? 2) || 0;
          const factor = (1 - tDisc/100) * (1 - cDisc/100);
          const baseExGst = factor > 0 ? p.purchase_price / factor : p.purchase_price;
          a[i].rate_ex_gst = parseFloat(baseExGst.toFixed(2));
          a[i].dp_inc_gst = parseFloat((baseExGst * (1 + (gst / 100))).toFixed(2));
        }
        // if purchase_price is 0/null/empty, leave unit_price unchanged to force manual entry
        a[i].selling_price = (p.selling_price && parseFloat(p.selling_price) > 0) ? p.selling_price : (a[i].dp_inc_gst || '');
        a[i].wholeseller_price = p.wholeseller_price || '';
        a[i].min_selling_price = p.min_selling_price || '';
        a[i].max_selling_price = p.max_selling_price || '';
        a[i].incentive_amount = p.incentive_amount || '';
        // Search attributes if available (assuming Product model has them)
        if (p.attributes) {
          a[i].ram = p.attributes.ram || '';
          a[i].storage = p.attributes.storage || '';
          a[i].color = p.attributes.color || '';
        }
      }
    }
    setItems(a);
  };
  
  const updateImei = (itemIndex, imeiIndex, value) => {
    const a = [...items];
    const imeis = [...(a[itemIndex].imei_list || [])];
    imeis[imeiIndex] = value;
    a[itemIndex].imei_list = imeis;
    if (category_group !== 'other') {
      a[itemIndex].quantity = imeis.length;
    }
    setItems(a);
  };
  
  const handleQtyChange = (itemIndex, newQty) => {
    const a = [...items];
    // Allow empty string while user is typing — don't snap to 1 mid-edit
    if (newQty === '' || newQty === null || newQty === undefined) {
      a[itemIndex].quantity = '';
      setItems(a);
      return;
    }
    const qty = Math.max(1, parseInt(newQty) || 1);
    a[itemIndex].quantity = qty;
    if (category_group !== 'other') {
      const mobileQty = Math.min(25, qty);
      a[itemIndex].quantity = mobileQty;
      const currentImeis = [...(a[itemIndex].imei_list || [])];
      if (mobileQty > currentImeis.length) {
        const toAdd = mobileQty - currentImeis.length;
        for (let i = 0; i < toAdd; i++) currentImeis.push('');
      } else if (mobileQty < currentImeis.length) {
        currentImeis.splice(mobileQty);
      }
      a[itemIndex].imei_list = currentImeis;
    }
    setItems(a);
  };
  
  const qtyRefs = useRef({});
  const ramRefs = useRef({});

  const [scanner, setScanner] = useState({ show: false, itemIndex: null });
  const [showBulkScan, setShowBulkScan] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({ selling_price: '', wholeseller_price: '', min_selling_price: '', color: '', ram: '', storage: '' });

  const handleBulkEditApply = () => {
    setItems(prev => prev.map(item => {
      const updated = { ...item };
      if (bulkEditFields.selling_price !== '') updated.selling_price = bulkEditFields.selling_price;
      if (bulkEditFields.wholeseller_price !== '') updated.wholeseller_price = bulkEditFields.wholeseller_price;
      if (bulkEditFields.min_selling_price !== '') updated.min_selling_price = bulkEditFields.min_selling_price;
      if (bulkEditFields.color !== '') updated.color = bulkEditFields.color;
      if (bulkEditFields.ram !== '') updated.ram = bulkEditFields.ram;
      if (bulkEditFields.storage !== '') updated.storage = bulkEditFields.storage;
      return updated;
    }));
    setBulkEditFields({ selling_price: '', wholeseller_price: '', min_selling_price: '', color: '', ram: '', storage: '' });
    setShowBulkEditModal(false);
    toast.success(`✅ Applied to all ${items.length} items!`);
  };

  const handleAddBulkItems = (newItems) => {
    setItems(prev => {
      let current = [...prev];
      if (editingItemIndex !== null) {
        const normalized = normalizeBulkItem(newItems[0]);
        current[editingItemIndex] = normalized;
        setEditingItemIndex(null);
        return current;
      }
      
      if (current.length === 1 && !current[0].product_id && !current[0].imei_list?.length && !current[0].new_product_name) {
        current = [];
      }

      // Group new items with existing items if all specs match perfectly
      newItems.forEach(ni => {
        const normalized = normalizeBulkItem(ni);
        let match = current.find(c => 
          c.product_id == normalized.product_id && 
          c.is_new === normalized.is_new &&
          c.new_product_name === normalized.new_product_name &&
          c.ram === normalized.ram && 
          c.storage === normalized.storage && 
          c.color === normalized.color && 
          c.unit_price == normalized.unit_price
        );

        if (match) {
          if (normalized.imei_list?.[0]) {
            const imei = normalized.imei_list[0];
            if (!match.imei_list.includes(imei)) {
              match.imei_list = [...match.imei_list, imei];
              match.quantity = match.imei_list.length;
            }
          } else {
            match.quantity += Number(normalized.quantity) || 1;
          }
        } else {
          current.push(normalized);
        }
      });
      return current;
    });
  };

  // Normalize BulkScanModal output (single-string imei) to imei_list array format
  const normalizeBulkItem = (ni) => {
    const imeiArr = ni.imei ? [ni.imei] : [];
    const { imei, ...rest } = ni;
    return { ...rest, imei_list: imeiArr, quantity: Math.max(1, imeiArr.length || ni.quantity || 1) };
  };

  const handleOpenBulkEdit = (index) => {
    setEditingItemIndex(index);
    setShowBulkScan(true);
  };

  const getFieldConfig = (item) => {
    // Focused on New Mobiles (Mobile New)
    return {
      imei: { label: 'IMEI / Serial', placeholder: '15-digit IMEI', show: true },
      ram: { label: 'RAM', placeholder: 'e.g. 8GB', show: true },
      storage: { label: 'Storage', placeholder: 'e.g. 128GB', show: true },
      color: { label: 'Color', placeholder: 'e.g. Blue', show: true }
    };
  };

  const total      = items.reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0);
  // Mirrors InvoiceService::calculateTotals() on the backend: an item explicitly marked
  // apply_gst=false is excluded from the GST-taxable base, so the preview shown here matches
  // what actually gets saved instead of always taxing the full total.
  const gstTaxableTotal = items.reduce((s, i) => s + (i.apply_gst !== false ? (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)) : 0), 0);

  let rawCgstAmount = form.calculate_gst ? (gstTaxableTotal * (parseFloat(form.cgst_rate) || 0)) / 100 : 0;
  let rawSgstAmount = form.calculate_gst ? (gstTaxableTotal * (parseFloat(form.sgst_rate) || 0)) / 100 : 0;

  if (form.gst_rounding_mode === '2pt') {
    rawCgstAmount = parseFloat(rawCgstAmount.toFixed(2));
    rawSgstAmount = parseFloat(rawSgstAmount.toFixed(2));
  } else if (form.gst_rounding_mode === 'up') {
    rawCgstAmount = Math.ceil(rawCgstAmount);
    rawSgstAmount = Math.ceil(rawSgstAmount);
  } else if (form.gst_rounding_mode === 'down') {
    rawCgstAmount = Math.floor(rawCgstAmount);
    rawSgstAmount = Math.floor(rawSgstAmount);
  }

  const autoCgstAmount = rawCgstAmount;
  const autoSgstAmount = rawSgstAmount;

  const cgstAmount = isManualGst ? (parseFloat(form.cgst_amount) || 0) : autoCgstAmount;
  const sgstAmount = isManualGst ? (parseFloat(form.sgst_amount) || 0) : autoSgstAmount;

  const rawGrandTotal = total + cgstAmount + sgstAmount - (parseFloat(form.discount) || 0) - (form.is_cash_discount_on_bill ? (parseFloat(form.cash_discount) || 0) : 0);
  
  let grandTotal = Math.round(rawGrandTotal);
  if (form.rounding_mode === 'up') grandTotal = Math.ceil(rawGrandTotal);
  if (form.rounding_mode === 'down') grandTotal = Math.floor(rawGrandTotal);
  if (form.rounding_mode === 'manual') grandTotal = rawGrandTotal + (parseFloat(form.round_off) || 0);

  const roundOff = form.rounding_mode === 'manual' ? (parseFloat(form.round_off) || 0).toFixed(3) : (grandTotal - rawGrandTotal).toFixed(3);

  useEffect(() => {
    if (!isManualRound) {
        let roundedValue = Math.round(rawGrandTotal);
        if (form.rounding_mode === 'up') roundedValue = Math.ceil(rawGrandTotal);
        else if (form.rounding_mode === 'down') roundedValue = Math.floor(rawGrandTotal);
        
        const diff = roundedValue - rawGrandTotal;
        setForm(f => ({ ...f, round_off: parseFloat(diff.toFixed(3)) }));
    }
  }, [rawGrandTotal, form.rounding_mode, isManualRound]);

  const adjustRoundOff = (direction) => {
    const currentTotal = Math.round(grandTotal);
    const newTotal = currentTotal + direction;
    const newRoundOff = newTotal - rawGrandTotal;
    setForm(f => ({
      ...f,
      rounding_mode: 'manual',
      round_off: parseFloat(newRoundOff.toFixed(3))
    }));
    setIsManualRound(true);
  };

  const resetRoundOff = () => {
    setForm(f => ({
      ...f,
      rounding_mode: 'auto'
    }));
    setIsManualRound(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      if (e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
        e.preventDefault();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent double-submit
    setSubmitting(true);
    
    // Validation
    if (hasFullAccess() && !form.shop_id) {
      toast.error('Please select a shop');
      setSubmitting(false);
      return;
    }
    if (!form.supplier_id) {
      toast.error('Please select a supplier');
      setSubmitting(false);
      return;
    }
    const invalid = items.some(item => !item.is_new && !item.product_id);
    const invalidNew = items.some(item => item.is_new && (!item.new_product_name || !item.category_id));
    
    if (invalid || invalidNew) {
      toast.error('Please complete all product selections');
      setSubmitting(false);
      return;
    }

    // Validation: reject items with zero/empty unit_price to prevent corrupt data in DB
    const zeroPriceItem = items.find(it => { const p = parseFloat(it.unit_price); return isNaN(p) || p <= 0; });
    if (zeroPriceItem) {
      toast.error('Item #' + (items.indexOf(zeroPriceItem) + 1) + ' has ₹0 purchase price. Please enter a valid price before submitting.');
      setSubmitting(false);
      return;
    }

    try {
      setLoading(true);
      let finalForm = {
        ...form,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        round_off: parseFloat(roundOff),
        is_gst_manual: isManualGst
      };
      
      let flatItems = [];
      items.forEach(it => {
        const { imei_list, ...rest } = it;
        if (category_group === 'other') {
          flatItems.push({ ...rest, imei: imei_list?.[0] || '', quantity: rest.quantity || 1 });
        } else {
          // Store all IMEIs as comma-separated in one row so edit loads as one row
          const imeiArr = Array.isArray(imei_list) ? imei_list.filter(Boolean) : [];
          flatItems.push({ ...rest, imei: imeiArr.join(','), quantity: imeiArr.length || rest.quantity || 1 });
        }
      });
      
      finalForm.items = flatItems;

      if (form.payment_method === 'OTHER' && form.other_payment_mode) {
        finalForm.payment_method = form.other_payment_mode;
      }

      if (id) {
        await api.put(`/purchase-invoices/${id}`, finalForm);
        toast.success('✅ Purchase updated successfully!');
      } else {
        await api.post('/purchase-invoices', finalForm);
        toast.success(form.status === 'received' ? '✅ Purchase saved and stock updated!' : '📦 Purchase Order saved!');
      }
      navigate(category_group ? `/purchases?category_group=${category_group}` : '/purchases');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving purchase');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const S=`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    .pf-wrap{background:linear-gradient(160deg,#f0f4ff 0%,#f8faff 60%,#fafbfe 100%);min-height:100vh;padding:20px 24px;font-family:'Inter',sans-serif}
    .pf-hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:18px;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;box-shadow:0 8px 32px rgba(15,52,96,.35)}
    .pf-hero h2{color:#fff;font-size:1.1rem;font-weight:800;letter-spacing:.5px;margin:0}
    .pf-hero p{color:rgba(255,255,255,.45);font-size:.68rem;margin:3px 0 0;letter-spacing:.3px}
    .pf-back{background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.2);color:#fff;font-size:.72rem;font-weight:700;padding:8px 18px;border-radius:10px;cursor:pointer;transition:all .2s;letter-spacing:.3px}
    .pf-back:hover{background:rgba(255,255,255,.2);transform:translateX(-2px)}
    .pf-card{background:#fff;border-radius:16px;padding:20px 22px;margin-bottom:14px;box-shadow:0 2px 16px rgba(0,0,0,.06);border:1px solid rgba(226,232,240,.8)}
    .pf-sec{font-size:.62rem;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1.5px dashed #f1f5f9}
    .pf-lbl{font-size:.62rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:5px}
    .pf-inp{font-size:.8rem;border:1.5px solid #e2e8f0;border-radius:9px;padding:8px 11px;width:100%;background:#f8fafc;transition:all .18s;color:#1e293b;font-weight:500}
    .pf-inp:focus{outline:none;border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
    .pf-inp::placeholder{color:#cbd5e1;font-weight:400}
    .pf-item-card{background:#fff;border-radius:14px;border:1.5px solid #e2e8f0;padding:16px 18px;margin-bottom:10px;position:relative;transition:all .2s;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .pf-item-card:hover{border-color:#a5b4fc;box-shadow:0 4px 20px rgba(99,102,241,.1)}
    .pf-item-num{width:28px;height:28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:800;flex-shrink:0}
    .pf-bulk{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-weight:700;font-size:.74rem;padding:9px 18px;border-radius:10px;cursor:pointer;transition:all .18s;letter-spacing:.3px;box-shadow:0 4px 14px rgba(99,102,241,.3)}
    .pf-bulk:hover{opacity:.9;transform:translateY(-1px)}
    .pf-sum{background:#ffffff;border-radius:16px;padding:20px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);border:1.5px solid #cbd5e1;color:#0f172a}
    .pf-invoice-table{width:100%;border-collapse:collapse;border:1.5px solid #0f172a;margin-top:10px;margin-bottom:15px;background:#ffffff}
    .pf-invoice-table td{border:1.5px solid #0f172a;padding:8px 10px;font-size:0.8rem;color:#0f172a;vertical-align:middle;font-weight:600}
    .pf-invoice-table td.lbl{font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:#f8fafc;font-size:0.72rem;text-align:left}
    .pf-invoice-table td.val{font-weight:800;text-align:right;font-size:0.85rem}
    .pf-invoice-table tr.total-row{background:#f8fafc}
    .pf-invoice-table tr.total-row td{border-top:2.5px double #0f172a;border-bottom:2.5px double #0f172a;font-size:1.15rem;font-weight:900;color:#0f172a}
    .pf-sum-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(0,0,0,.06);font-size:.78rem}
    .pf-sum-row:last-child{border-bottom:none}
    .pf-grand{font-size:1.4rem;font-weight:900;color:#0f172a;letter-spacing:-.5px}
    .pf-submit{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-weight:700;font-size:.85rem;padding:12px 28px;border-radius:12px;cursor:pointer;transition:all .2s;letter-spacing:.4px;box-shadow:0 4px 16px rgba(99,102,241,.35)}
    .pf-submit:hover{opacity:.9;transform:translateY(-1px)}
    .pf-submit.green{background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 4px 16px rgba(5,150,105,.35)}
    .pf-field-group{background:#f8fafc;border-radius:10px;padding:10px 12px;border:1.5px solid #f1f5f9}
    .pf-field-group:focus-within{border-color:#c7d2fe;background:#fff}
  `;


  const isDefaultType = ['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'BANK', 'CARD', 'UPI'].includes(newSupplier.type);
  const isCustomType = customTypes.includes(newSupplier.type);
  const showCustomInput = newSupplier.type === 'OTHER' || (!isDefaultType && !isCustomType && newSupplier.type !== '');

  return (
    <div className="pf-wrap">
      <style>{S}</style>
      
      <div className="pf-hero">
        <div>
          <h2>{id ? '✍️ Edit Purchase' : '🛒 New Purchase'}</h2>
          <p>Manage purchase record and supplier details <span style={{fontSize:'.65rem', fontWeight:700, letterSpacing:1}}>· SHORTCUT: ALT + P</span></p>
        </div>
        <button type="button" className="pf-back" onClick={() => navigate(category_group ? `/purchases?category_group=${category_group}` : '/purchases')}>← Back</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
      ) : (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          {/* General Info */}
          <div className="pf-card">
            <div className="pf-sec">📋 General Information</div>
            <div className="row g-2">
              {hasFullAccess() && (
                <div className="col-6 col-md-2">
                  <span className="pf-lbl">Shop / Branch *</span>
                  <select className="pf-inp" required value={form.shop_id} onChange={e=>setForm({...form,shop_id:e.target.value})}>
                    <option value="">— Select —</option>
                    {shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-6 col-md-2">
                <span className="pf-lbl">Bill Type *</span>
                <select className="pf-inp" required value={form.bill_type} onChange={e=>setForm({...form,bill_type:e.target.value})}>
                  <option value="kaccha">Kaccha Bill</option>
                  <option value="pakka">Pakka Bill (GST)</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <span className="pf-lbl" style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  Supplier * <button type="button" onClick={()=>setShowSupplierModal(true)} style={{background:'none',border:'none',color:'#6366f1',fontWeight:700,fontSize:'.85rem',cursor:'pointer',padding:0}}>+ Add</button>
                </span>
                <Select
                  options={supplierOptions}
                  value={selectedSupplierOption}
                  onChange={opt => setForm({ ...form, supplier_id: opt ? opt.value : '' })}
                  placeholder="— Select Supplier —"
                  isSearchable
                  isClearable
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '36px',
                      fontSize: '0.8rem',
                      borderColor: '#cbd5e1',
                      borderRadius: '6px',
                      boxShadow: 'none'
                    }),
                    menu: (base) => ({ ...base, fontSize: '0.78rem', zIndex: 999 }),
                  }}
                />
              </div>
              <div className="col-6 col-md-2">
                <span className="pf-lbl">Purchase Date</span>
                <input type="date" className="pf-inp" value={form.purchase_date} onChange={e=>setForm({...form,purchase_date:e.target.value})}/>
              </div>
              <div className="col-6 col-md-2">
                <span className="pf-lbl">Status</span>
                <select className="pf-inp" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                  <option value="ordered">📦 Ordered</option>
                  <option value="received">✅ Received</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                {form.status === 'ordered' ? (
                  <>
                    <span className="pf-lbl" style={{color:'#6366f1'}}>Expected Delivery</span>
                    <input type="date" className="pf-inp" style={{borderColor:'#a5b4fc'}} value={form.expected_delivery_date} onChange={e=>setForm({...form,expected_delivery_date:e.target.value})}/>
                  </>
                ) : form.status === 'received' ? (
                  <>
                    <span className="pf-lbl" style={{color:'#059669'}}>Received At</span>
                    <input type="date" className="pf-inp" style={{borderColor:'#6ee7b7'}} value={form.received_at} onChange={e=>setForm({...form,received_at:e.target.value})}/>
                  </>
                ) : (
                  <div style={{visibility:'hidden'}}>
                    <span className="pf-lbl">Placeholder</span>
                    <input type="date" className="pf-inp" disabled/>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12">
              <div className="pf-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="pf-sec mb-0">📦 Purchase Items ({items.length})</div>
                  <div className="d-flex gap-2">
                    {items.length > 0 && (
                      <>
                        <button type="button" style={{background:'linear-gradient(135deg,#10b981,#059669)',border:'none',color:'#fff',fontWeight:700,fontSize:'.72rem',padding:'7px 14px',borderRadius:9,cursor:'pointer'}}
                          onClick={()=>setItems([...items,{product_id:'',brand_id:null,is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0,show_calc:true,dp_inc_gst:'',calc_gst_rate:18,trade_disc_pct:3.85,cash_disc_pct:2,rate_ex_gst:''}])}>
                          ➕ Add Row
                        </button>
                        <button type="button" style={{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',border:'none',color:'#fff',fontWeight:700,fontSize:'.72rem',padding:'7px 14px',borderRadius:9,cursor:'pointer'}}
                          onClick={() => { setBulkEditFields({ selling_price:'',wholeseller_price:'',min_selling_price:'',color:'',ram:'',storage:'' }); setShowBulkEditModal(true); }}>
                          ✏️ Bulk Edit
                        </button>
                      </>
                    )}
                    {enableBulkAdd && (
                      <button type="button" className="pf-bulk" onClick={()=>setShowBulkScan(true)}>+ Bulk Add</button>
                    )}
                  </div>
                </div>

                {items.length===0 ? (
                  <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8'}}>
                    <div style={{fontSize:'2.5rem',opacity:.3,marginBottom:8}}>🛒</div>
                    <div style={{fontWeight:700,fontSize:'.82rem',marginBottom:4}}>No items added yet</div>
                    <button type="button" style={{background:'#f1f5f9',border:'1.5px solid #e2e8f0',borderRadius:8,padding:'6px 16px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',color:'#6366f1'}}
                      onClick={()=>setItems([{product_id:'',is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0, show_calc: true, dp_inc_gst: '', calc_gst_rate: 18, trade_disc_pct: 3.85, cash_disc_pct: 2, rate_ex_gst: ''}])}>
                      + Add Item
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{overflowX: 'auto'}}>
                      <table className="pf-invoice-table" style={{minWidth: '1150px'}}>
                        <thead>
                          <tr style={{background: '#f8fafc', fontWeight: 800}}>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left'}}>Description of Goods</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '100px', textAlign: 'center'}}>HSN/SAC</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '80px', textAlign: 'center'}}>Quantity</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '110px', textAlign: 'right'}}>Rate (Incl. of Tax)</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '110px', textAlign: 'right'}}>Rate (Ex. GST)</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '60px', textAlign: 'center'}}>per</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '85px', textAlign: 'right'}}>Disc. %</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '85px', textAlign: 'right'}}>CD %</th>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '120px', textAlign: 'right'}}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => {
                            const lineTotal = (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0));
                            const baseTabIndex = i * 30;
                            return (
                              <tr key={i}>
                                <td style={{border: '1.5px solid #0f172a', padding: '8px', verticalAlign: 'top', width: '380px'}}>
                                  <div style={{display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6}}>
                                    <div className="pf-item-num" style={{width: 24, height: 24, fontSize: '0.65rem', flexShrink: 0}}>{i + 1}</div>
                                    <div style={{flex: 1}}>
                                      <CreatableSelect
                                        tabIndex={baseTabIndex + 1}
                                        options={products.map(p=>({value:p.id,label:`${p.brand?p.brand.name+' ':''}${p.name} ${p.attributes?.ram||p.attributes?.storage?`(${p.attributes.ram||''}/${p.attributes.storage||''})`:''} ${p.attributes?.color?`- ${p.attributes.color}`:''}`.trim().toUpperCase()}))}
                                        value={item.product_id?{value:item.product_id,label:(()=>{const p=products.find(p=>p.id===item.product_id);return p?`${p.brand?p.brand.name+' ':''}${p.name} ${p.attributes?.ram||p.attributes?.storage?`(${p.attributes.ram||''}/${p.attributes.storage||''})`:''} ${p.attributes?.color?`- ${p.attributes.color}`:''}`.trim().toUpperCase():'';})()}:(item.new_product_name?{value:'new',label:`${brands.find(b=>b.id===item.brand_id)?.name||''} ${item.new_product_name}`.trim().toUpperCase()}:null)}
                                        onChange={(opt)=>{if(opt){if(opt.value!=='new'){const p=products.find(p=>p.id===opt.value);updateItem(i,'product_id',opt.value);updateItem(i,'brand_id',p?.brand_id||'');updateItem(i,'new_product_name','');updateItem(i,'is_new',false);setTimeout(()=>{ramRefs.current[i]?.focus();},50);}}else{updateItem(i,'product_id','');updateItem(i,'brand_id','');updateItem(i,'new_product_name','');updateItem(i,'is_new',false);}}}
                                        onCreateOption={async(val)=>{const parts=val.trim().split(' ');const nb=parts[0].toUpperCase();const nm=parts.slice(1).join(' ').trim().toUpperCase();let bid=null;const eb=brands.find(b=>b.name.toUpperCase()===nb);if(eb){bid=eb.id;}else{bid=await handleCreateBrand(nb);}updateItem(i,'brand_id',bid);updateItem(i,'new_product_name',nm);updateItem(i,'product_id','');updateItem(i,'is_new',true);setTimeout(()=>{ramRefs.current[i]?.focus();},50);}}
                                        placeholder="— Select Company & Model —"
                                        isClearable
                                        styles={{
                                          control:(b)=>({...b,minHeight:'36px',fontSize:'.8rem',fontWeight:600,backgroundColor:'#f8fafc',borderColor:'#cbd5e1',borderRadius:'6px',boxShadow:'none'}),
                                          menu:(b)=>({...b,fontSize:'.78rem',zIndex:9999}),
                                          input:(b)=>({...b,fontSize:'.8rem',fontWeight:600}),
                                          singleValue:(b)=>({...b,fontSize:'.8rem',fontWeight:600}),
                                          placeholder:(b)=>({...b,fontSize:'.8rem',fontWeight:600})
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {item.is_new && category_group === 'other' && (
                                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Category:</span>
                                      <select
                                        className="form-select form-select-sm"
                                        style={{ fontSize: '0.75rem', padding: '2px 6px', width: 'auto' }}
                                        value={item.category_id || ''}
                                        onChange={e => updateItem(i, 'category_id', parseInt(e.target.value))}
                                      >
                                        <option value="">— Select Category —</option>
                                        {categories.filter(c => { const s = c.slug?.toLowerCase(); return s !== 'mobile-new' && s !== 'mobile-old'; }).map(c => (
                                          <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  
                                  <div style={{display: 'flex', gap: 4, marginBottom: 6}}>
                                    <input ref={el=>ramRefs.current[i]=el} type="text" list="ramOptions" className="pf-inp" style={{padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px'}} placeholder="RAM" value={item.ram} onChange={e=>updateItem(i,'ram',e.target.value)} tabIndex={baseTabIndex + 2}/>
                                    <input type="text" list="storageOptions" className="pf-inp" style={{padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px'}} placeholder="Storage" value={item.storage} onChange={e=>updateItem(i,'storage',e.target.value)} tabIndex={baseTabIndex + 3}/>
                                    <input type="text" list="colorOptions" className="pf-inp" style={{padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px'}} placeholder="Color" value={item.color} onChange={e=>updateItem(i,'color',e.target.value)} tabIndex={baseTabIndex + 4}/>
                                  </div>

                                  <div style={{background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 8px', marginBottom: 6}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                                      <span style={{fontSize: '0.65rem', fontWeight: 800, color: '#3730a3'}}>📱 IMEI / SERIAL</span>
                                      <button type="button" onClick={()=>setScanner({show:true,itemIndex:i})} style={{background:'#6366f1', border:'none', color:'#fff', borderRadius:4, padding:'2px 8px', cursor:'pointer', fontSize:'.65rem', fontWeight:700}}>📷 SCAN</button>
                                    </div>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: 4}}>
                                      {category_group === 'other' ? (
                                        <input
                                          type="text"
                                          className="pf-inp"
                                          style={{padding: '3px 6px', fontSize: '0.75rem', borderRadius: '4px', borderColor: '#a5b4fc', color: '#3730a3', fontWeight: 600}}
                                          placeholder="Serial / Batch (optional)"
                                          value={item.imei_list[0] || ''}
                                          onChange={e => updateImei(i, 0, e.target.value)}
                                          tabIndex={baseTabIndex + 6}
                                        />
                                      ) : (
                                        item.imei_list.map((imeiVal, imeiIdx) => (
                                          <input
                                            key={imeiIdx}
                                            type="text"
                                            className="pf-inp"
                                            style={{padding: '3px 6px', fontSize: '0.75rem', borderRadius: '4px', borderColor: '#a5b4fc', color: '#3730a3', fontWeight: 600}}
                                            placeholder={`IMEI ${imeiIdx + 1}`}
                                            value={imeiVal}
                                            onChange={e => updateImei(i, imeiIdx, e.target.value)}
                                            tabIndex={baseTabIndex + 6 + imeiIdx}
                                          />
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px', border: '1px solid #b7e4c7', marginBottom: 6}}>
                                    <div>
                                      <span style={{fontSize: '0.6rem', color: '#16a34a', display: 'block', fontWeight: 800, textAlign: 'center'}}>MOP</span>
                                      <input type="number" className="pf-inp" style={{padding: '3px 4px', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'right', fontWeight: 700, borderColor: '#86efac', background: '#fff'}} value={item.selling_price} onChange={e=>updateItem(i,'selling_price',parseFloat(e.target.value))} tabIndex={baseTabIndex + 6 + item.imei_list.length + 5}/>
                                    </div>
                                    <div>
                                      <span style={{fontSize: '0.6rem', color: '#4f46e5', display: 'block', fontWeight: 800, textAlign: 'center'}}>WHOLE.</span>
                                      <input type="number" className="pf-inp" style={{padding: '3px 4px', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'right', borderColor: '#cbd5e1', background: '#fff'}} value={item.wholeseller_price} onChange={e=>updateItem(i,'wholeseller_price',parseFloat(e.target.value))} tabIndex={baseTabIndex + 6 + item.imei_list.length + 6}/>
                                    </div>
                                    <div>
                                      <span style={{fontSize: '0.6rem', color: '#dc2626', display: 'block', fontWeight: 800, textAlign: 'center'}}>MIN</span>
                                      <input type="number" className="pf-inp" style={{padding: '3px 4px', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'right', borderColor: '#cbd5e1', background: '#fff'}} value={item.min_selling_price} onChange={e=>updateItem(i,'min_selling_price',parseFloat(e.target.value))} tabIndex={baseTabIndex + 6 + item.imei_list.length + 7}/>
                                    </div>
                                    <div>
                                      <span style={{fontSize: '0.6rem', color: '#7c3aed', display: 'block', fontWeight: 800, textAlign: 'center'}}>COMM.</span>
                                      <input type="number" className="pf-inp" style={{padding: '3px 4px', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'right', borderColor: '#cbd5e1', background: '#fff'}} value={item.incentive_amount} onChange={e=>updateItem(i,'incentive_amount',parseFloat(e.target.value))} tabIndex={baseTabIndex + 6 + item.imei_list.length + 8}/>
                                    </div>
                                  </div>

                                  <div style={{display: 'flex', gap: 4, justifyContent: 'flex-end'}}>
                                    <button type="button" onClick={()=>setItems([...items,{product_id:'',brand_id:null,is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0,show_calc:true,dp_inc_gst:'',calc_gst_rate:18,trade_disc_pct:3.85,cash_disc_pct:2,rate_ex_gst:''}])} style={{background:'#e0e7ff', border:'1px solid #c7d2fe', color:'#4338ca', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 9}>➕ NEW ROW</button>
                                    <button type="button" onClick={()=>duplicateRow(i,'color')} style={{background:'#f0fdf4', border:'1px solid #86efac', color:'#16a34a', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 10}>➕ COLOR</button>
                                    <button type="button" onClick={()=>duplicateRow(i,'specs')} style={{background:'#fefce8', border:'1px solid #fde047', color:'#ca8a04', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 11}>➕ SPECS</button>
                                    <button type="button" onClick={()=>removeItem(i)} style={{background:'#fef2f2', border:'1px solid #fecaca', color:'#ef4444', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 12}>🗑 REMOVE</button>
                                  </div>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'center', verticalAlign: 'top'}}>
                                  <span style={{fontSize: '0.75rem', fontWeight: 700, color: '#475569'}}>85171300</span>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'center', verticalAlign: 'top', width: '80px'}}>
                                  <input type="number" className="pf-inp" min="1" {...(category_group !== 'other' ? { max: 25 } : {})} value={item.quantity} onChange={e=>handleQtyChange(i, e.target.value)} onBlur={e=>{if(e.target.value===''||parseInt(e.target.value)<1)handleQtyChange(i,1);}} style={{textAlign:'center', fontWeight:800, padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={baseTabIndex + 5} ref={el=>qtyRefs.current[i]=el}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '110px'}}>
                                  <input type="number" className="pf-inp" placeholder="0.00" value={item.dp_inc_gst||''} onChange={e=>updateItem(i,'dp_inc_gst',e.target.value)} style={{textAlign:'right', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 2}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '110px'}}>
                                  <input type="number" className="pf-inp" step=".01" value={item.rate_ex_gst||''} onChange={e=>updateItem(i,'rate_ex_gst',parseFloat(e.target.value))} style={{textAlign:'right', fontWeight:800, color:'#4f46e5', background:'#eef2ff', borderColor:'#c7d2fe', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={baseTabIndex + 6 + item.imei_list.length}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'center', verticalAlign: 'top'}}>
                                  <span style={{fontSize: '0.75rem', fontWeight: 700, color: '#475569'}}>Pcs</span>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '85px'}}>
                                  <input type="number" className="pf-inp" value={item.trade_disc_pct??3.85} onChange={e=>updateItem(i,'trade_disc_pct',e.target.value)} style={{textAlign:'right', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 3}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '85px'}}>
                                  <input type="number" className="pf-inp" value={item.cash_disc_pct??2} onChange={e=>updateItem(i,'cash_disc_pct',e.target.value)} style={{textAlign:'right', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 4}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', verticalAlign: 'top', width: '120px', fontWeight: 800, fontSize: '0.85rem'}}>
                                  ₹{lineTotal.toLocaleString('en-IN',{minimumFractionDigits:2, maximumFractionDigits: 2})}
                                </td>
                              </tr>
                            );
                          })}

                          {/* SUB-TOTAL ROW */}
                          <tr style={{borderTop: '2px solid #0f172a'}}>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800}}>Subtotal</td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px', textAlign: 'center', fontWeight: 800, fontSize: '0.8rem'}}>
                              {items.reduce((s,i)=>s+(Number(i.quantity)||0),0)} Pcs
                            </td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem'}}>
                              ₹{total.toLocaleString('en-IN',{minimumFractionDigits:2, maximumFractionDigits: 2})}
                            </td>
                          </tr>

                          {/* BILL-LEVEL TRADE DISCOUNT ROW */}
                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800}}>Trade Discount (₹)</td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '6px 10px', textAlign: 'right'}}>
                              <input type="number" value={form.discount===0?'':form.discount} onFocus={e=>e.target.select()} onChange={e=>setForm({...form,discount:parseFloat(e.target.value)||0})}
                                style={{width:'90px',border:'1px solid #cbd5e1',borderRadius:4,textAlign:'right',fontWeight:700,padding:'2px 6px',fontSize:'.8rem',color:'#0f172a',background:'#fff'}} placeholder="0"/>
                            </td>
                          </tr>

                          {/* GST OPTIONS ROW */}
                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 800}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <input type="checkbox" id="calcGst" checked={form.calculate_gst} onChange={e=>setForm({...form,calculate_gst:e.target.checked})} style={{accentColor:'#0f172a'}}/>
                                <label htmlFor="calcGst" style={{cursor:'pointer',margin:0,fontWeight:700}}>GST Options</label>
                              </div>
                            </td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '6px 10px', textAlign: 'right'}}>
                              {form.calculate_gst && (
                                <div style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                                  {['exact','2pt','down','up'].map(m=>(
                                    <button key={m} type="button" onClick={()=>setForm({...form,gst_rounding_mode:m})}
                                      style={{background:form.gst_rounding_mode===m?'#0f172a':'#f1f5f9',border:'1px solid #cbd5e1',color:form.gst_rounding_mode===m?'#fff':'#0f172a',borderRadius:4,padding:'1px 5px',fontSize:'.6rem',cursor:'pointer',fontWeight:700}} title={`Rounding: ${m}`}>
                                      {m==='exact'?'Ex':m==='2pt'?'.00':m==='down'?'-':'+'}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* CGST ROW */}
                          {form.calculate_gst && (
                            <tr>
                              <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 700}}>Cgst Output</td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'center'}}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
                                  <input type="number" value={form.cgst_rate} onChange={e=>setForm({...form,cgst_rate:e.target.value})} style={{width:45,border:'1px solid #cbd5e1',borderRadius:4,textAlign:'center',fontSize:'.75rem',padding:'2px 4px',background:'#fff',color:'#0f172a',fontWeight:700}}/>
                                  <span style={{fontSize:'.75rem',fontWeight:700}}>%</span>
                                </div>
                              </td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem'}}>
                                {isManualGst ? (
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                                    <input type="number" step="0.01" value={form.cgst_amount} onChange={e=>setForm({...form,cgst_amount:parseFloat(e.target.value)||0})}
                                      style={{width:75,border:'1px solid #0f172a',borderRadius:4,color:'#0f172a',textAlign:'right',fontSize:'.78rem',padding:'2px 6px',background:'#fff',fontWeight:700}}/>
                                    <button type="button" onClick={()=>{setIsManualGst(false); setForm(f=>({...f,is_gst_manual:false}))}} style={{background:'none',border:'none',color:'#ef4444',fontSize:'.65rem',cursor:'pointer',padding:0}}>↺</button>
                                  </div>
                                ) : (
                                  <span onClick={()=>{setIsManualGst(true); setForm(f=>({...f,cgst_amount:cgstAmount.toFixed(2),is_gst_manual:true}))}} style={{cursor:'pointer',borderBottom:'1px dashed #0f172a'}} title="Click to override manually">₹{cgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 3})} ✏️</span>
                                )}
                              </td>
                            </tr>
                          )}

                          {/* SGST ROW */}
                          {form.calculate_gst && (
                            <tr>
                              <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 700}}>Sgst Output</td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'center'}}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
                                  <input type="number" value={form.sgst_rate} onChange={e=>setForm({...form,sgst_rate:e.target.value})} style={{width:45,border:'1px solid #cbd5e1',borderRadius:4,textAlign:'center',fontSize:'.75rem',padding:'2px 4px',background:'#fff',color:'#0f172a',fontWeight:700}}/>
                                  <span style={{fontSize:'.75rem',fontWeight:700}}>%</span>
                                </div>
                              </td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                              <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem'}}>
                                {isManualGst ? (
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                                    <input type="number" step="0.01" value={form.sgst_amount} onChange={e=>setForm({...form,sgst_amount:parseFloat(e.target.value)||0})}
                                      style={{width:75,border:'1px solid #0f172a',borderRadius:4,color:'#0f172a',textAlign:'right',fontSize:'.78rem',padding:'2px 6px',background:'#fff',fontWeight:700}}/>
                                    <button type="button" onClick={()=>{setIsManualGst(false); setForm(f=>({...f,is_gst_manual:false}))}} style={{background:'none',border:'none',color:'#ef4444',fontSize:'.65rem',cursor:'pointer',padding:0}}>↺</button>
                                  </div>
                                ) : (
                                  <span onClick={()=>{setIsManualGst(true); setForm(f=>({...f,sgst_amount:sgstAmount.toFixed(2),is_gst_manual:true}))}} style={{cursor:'pointer',borderBottom:'1px dashed #0f172a'}} title="Click to override manually">₹{sgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 3})} ✏️</span>
                                )}
                              </td>
                            </tr>
                          )}

                          {/* BILL-LEVEL CASH DISCOUNT ROW */}
                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 800}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span>Cash Discount</span>
                                <label style={{fontSize:'.65rem',color:'#64748b',cursor:'pointer',margin:0}}>
                                  <input type="checkbox" checked={form.is_cash_discount_on_bill} onChange={e=>setForm({...form,is_cash_discount_on_bill:e.target.checked})} style={{marginRight:4,accentColor:'#0f172a'}}/>On Bill
                                </label>
                              </div>
                            </td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '6px 10px', textAlign: 'right'}}>
                              <input type="number" value={form.cash_discount===0?'':form.cash_discount} onFocus={e=>e.target.select()} onChange={e=>setForm({...form,cash_discount:parseFloat(e.target.value)||0})}
                                style={{width:80,border:'1px solid #cbd5e1',borderRadius:4,textAlign:'right',fontWeight:700,padding:'2px 6px',fontSize:'.8rem',color:'#0f172a',background:'#fff'}} placeholder="0"/>
                            </td>
                          </tr>

                          {/* LESS: ROUNDUP ROW */}
                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 800}}>Less: Roundup</td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '6px 10px', textAlign: 'right'}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
                                <button type="button" onClick={()=>adjustRoundOff(-1)} style={{background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:4,padding:'1px 7px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',color:'#0f172a'}}>-</button>
                                <button type="button" onClick={()=>adjustRoundOff(1)} style={{background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:4,padding:'1px 7px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',color:'#0f172a'}}>+</button>
                                {form.rounding_mode !== 'auto' && (
                                  <button type="button" onClick={resetRoundOff} style={{background:'#fee2e2',border:'1px solid #fecaca',borderRadius:4,padding:'1px 6px',fontSize:'.65rem',fontWeight:700,cursor:'pointer',color:'#dc2626'}}>Auto</button>
                                )}
                                <span style={{marginLeft:4,color:parseFloat(roundOff)>=0?'#15803d':'#b91c1c',fontWeight:800}}>
                                  {parseFloat(roundOff) >= 0 
                                    ? `+${parseFloat(roundOff).toFixed(2)}` 
                                    : `(-)${Math.abs(parseFloat(roundOff)).toFixed(2)}`
                                  }
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* TOTAL GRAND ROW */}
                          <tr className="total-row" style={{background: '#f8fafc'}}>
                            <td style={{border: '1.5px solid #0f172a', fontWeight: 900, fontSize: '0.95rem', padding: '8px 10px'}}>Total</td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem'}}>
                              {items.reduce((s,i)=>s+(Number(i.quantity)||0),0)} Pcs
                            </td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', color: '#0f172a'}}>
                              ₹{grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2, maximumFractionDigits: 2})}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <button type="button" style={{background:'#fff',color:'#6366f1',border:'2px dashed #a5b4fc',borderRadius:12,padding:'11px 28px',fontSize:'.8rem',fontWeight:700,cursor:'pointer',width:'100%',marginTop:10}}
                      onClick={()=>setItems([...items,{product_id:'',brand_id:null,is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0,show_calc:true,dp_inc_gst:'',calc_gst_rate:18,trade_disc_pct:3.85,cash_disc_pct:2,rate_ex_gst:''}])}>
                      + Add More Items
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="col-12">
              <div className="pf-card">
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <span className="pf-lbl">Internal Notes / Reminders</span>
                    <textarea className="pf-inp" rows={2} placeholder="e.g. Bill No, Payment Due Date..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value.toUpperCase()})}/>
                  </div>
                  <div className="col-12 col-md-3">
                    <span className="pf-lbl" style={{color:'#059669'}}>Initial Payment Paid (₹)</span>
                    <div style={{display:'flex',gap:0}}>
                      <span style={{background:'#059669',color:'#fff',fontWeight:700,padding:'5px 10px',borderRadius:'7px 0 0 7px',fontSize:'.82rem'}}>₹</span>
                      <input type="number" className="pf-inp" style={{borderRadius:'0 7px 7px 0',borderLeft:'none',color:'#059669',fontWeight:700,borderColor:'#6ee7b7'}}
                        placeholder="0.00" value={form.total_paid===0?'':form.total_paid} onFocus={e=>e.target.select()} onChange={e=>setForm({...form,total_paid:parseFloat(e.target.value)||0})}/>
                    </div>
                    {parseFloat(form.total_paid) > 0 && (
                      <>
                        <select className="pf-inp mt-1" style={{fontSize:'.7rem',height:'28px',padding:'2px 8px'}} value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
                          <option value="CASH">CASH</option>
                          <option value="PHONEPE">PHONEPE</option>
                          <option value="GPAY">GPAY</option>
                          <option value="BANK / NEFT">BANK / NEFT</option>
                          {bankEntities.length > 0 && <option disabled>── MY BANKS/CARDS ──</option>}
                          {bankEntities.map(b => (
                            <option key={b.id} value={b.name}>🏦 {b.name.toUpperCase()}</option>
                          ))}
                          <option value="OTHER">OTHER</option>
                        </select>
                        {form.payment_method === 'OTHER' && (
                          <input 
                            className="pf-inp mt-1" 
                            style={{fontSize:'.7rem',height:'28px',padding:'2px 8px',borderColor:'#6366f1',color:'#6366f1',fontWeight:700}}
                            placeholder="SPECIFY MODE..."
                            value={form.other_payment_mode}
                            onChange={e=>setForm({...form,other_payment_mode:e.target.value.toUpperCase()})}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <div className="col-12 col-md-3">
                    <span className="pf-lbl" style={{color:'#dc2626'}}>Pending Balance</span>
                    <div style={{background:'#fef2f2',border:'1.5px solid #fca5a5',borderRadius:8,padding:'8px 12px'}}>
                      <div style={{fontWeight:800,fontSize:'1rem',color:'#dc2626'}}>₹{(grandTotal-(parseFloat(form.total_paid)||0)).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{marginTop:16,display:'flex',justifyContent:'flex-end',gap:8}}>
                  <button type="button" onClick={()=>navigate(category_group ? `/purchases?category_group=${category_group}` : '/purchases')} style={{background:'#f1f5f9',border:'1px solid #cbd5e1',color:'#475569',fontWeight:700,fontSize:'.85rem',padding:'10px 24px',borderRadius:10,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" disabled={loading || submitting} className={`pf-submit${form.status==='received'?' green':''}`} style={{fontSize:'.85rem',padding:'10px 32px'}}>
                    {loading || submitting ? 'Processing...' : id ? `Update ${form.bill_type} Purchase` : (form.status==='received'?`✅ Save & Add Stock`:`📦 Save Order`)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modals */}
      <Modal show={showSupplierModal} onHide={() => setShowSupplierModal(false)} centered className="text-uppercase modal-dialog-scrollable">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fw-bold text-uppercase" style={{ fontSize: '1rem' }}>New Entity</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleQuickSupplierAdd}>
          <Modal.Body className="p-4">
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-bold small text-muted text-uppercase">Entity Name *</label>
                <input 
                  type="text" 
                  className="form-control text-uppercase" 
                  required 
                  value={newSupplier.name}
                  onChange={e => setNewSupplier({...newSupplier, name: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Category *</label>
                <select 
                  className="form-select fw-semibold text-uppercase"
                  required
                  value={
                    isDefaultType || isCustomType
                      ? newSupplier.type
                      : (newSupplier.type ? 'OTHER' : '')
                  }
                  onChange={e => setNewSupplier({...newSupplier, type: e.target.value})}
                >
                  <option value="">Select Category...</option>
                  <option value="CUSTOMER">NORMAL CUSTOMER</option>
                  <option value="SHOP_CUSTOMER">SHOP CUSTOMER</option>
                  <option value="SHOP">SHOP</option>
                  <option value="SUPPLIER">SUPPLIER</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  <option value="BANK">BANK</option>
                  <option value="CARD">CARD</option>
                  <option value="UPI">UPI</option>
                  {customTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="OTHER">OTHER / CUSTOM TYPE</option>
                </select>
              </div>

              {showCustomInput && (
                <div className="col-12">
                  <label className="form-label fw-bold small text-muted text-uppercase">Custom Category / Type *</label>
                  <input 
                    type="text" 
                    className="form-control fw-bold text-uppercase"
                    required
                    placeholder="Type custom category name..."
                    value={newSupplier.type === 'OTHER' ? '' : newSupplier.type}
                    onChange={e => setNewSupplier({...newSupplier, type: e.target.value.toUpperCase()})}
                  />
                </div>
              )}
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={newSupplier.phone}
                  onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Address"
                  value={newSupplier.address}
                  onChange={e => setNewSupplier({...newSupplier, address: e.target.value})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">GST Number</label>
                <input 
                  type="text" 
                  className="form-control text-uppercase"
                  placeholder="Optional"
                  value={newSupplier.gst_number}
                  onChange={e => setNewSupplier({...newSupplier, gst_number: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Opening Balance</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={newSupplier.opening_balance}
                  onChange={e => setNewSupplier({...newSupplier, opening_balance: e.target.value})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Balance Type</label>
                <select 
                  className="form-select text-uppercase"
                  value={newSupplier.balance_type}
                  onChange={e => setNewSupplier({...newSupplier, balance_type: e.target.value})}
                >
                  <option value="RECEIVABLE">THEY OWE ME (Receivable)</option>
                  <option value="PAYABLE">I OWE THEM (Payable)</option>
                </select>
              </div>

              {['CUSTOMER', 'SHOP_CUSTOMER'].includes(newSupplier.type) && (
                <>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted text-uppercase">Email</label>
                    <input 
                      type="email" 
                      className="form-control text-uppercase"
                      placeholder="Email address"
                      value={newSupplier.email || ''}
                      onChange={e => setNewSupplier({...newSupplier, email: e.target.value})}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted text-uppercase">Voucher Code</label>
                    <input 
                      type="text" 
                      className="form-control text-primary fw-semibold text-uppercase"
                      placeholder="Voucher Code"
                      value={newSupplier.voucher_code || ''}
                      onChange={e => setNewSupplier({...newSupplier, voucher_code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="col-12 mt-3 pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                        🎂 Customer Events
                      </h6>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary fw-bold" 
                        onClick={() => setNewSupplier({...newSupplier, events: [...(newSupplier.events || []), { type: '', name: '', date: '' }]})}
                        style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '4px 12px' }}
                      >
                        + Add Event
                      </button>
                    </div>
                    <p className="text-muted x-small text-uppercase mb-3 fw-semibold" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                      Click "+ Add Event" to track birthdays, etc.
                    </p>

                    <div className="row g-2">
                      {(newSupplier.events || []).map((ev, idx) => (
                        <div key={idx} className="col-12 p-3 bg-light rounded border mb-2">
                          <div className="row g-2 align-items-center">
                            
                            <div className="col-12 col-md-4">
                              <select 
                                className="form-select form-select-sm fw-semibold text-uppercase" 
                                value={ev.type} 
                                onChange={e => {
                                  const newEvents = [...newSupplier.events];
                                  newEvents[idx].type = e.target.value;
                                  setNewSupplier({...newSupplier, events: newEvents});
                                }}
                              >
                                <option value="">Select Type</option>
                                <option value="dob">DOB</option>
                                <option value="anniversary">Anniversary</option>
                                <option value="other">Other</option>
                              </select>
                            </div>

                            {ev.type === 'other' && (
                              <div className="col-12 col-md-3">
                                <input 
                                  className="form-control form-control-sm fw-semibold text-uppercase" 
                                  placeholder="Event Name" 
                                  value={ev.name || ''} 
                                  onChange={e => {
                                    const newEvents = [...newSupplier.events];
                                    newEvents[idx].name = e.target.value.toUpperCase();
                                    setNewSupplier({...newSupplier, events: newEvents});
                                  }}
                                />
                              </div>
                            )}

                            <div className={`col-md-${ev.type === 'other' ? '4' : '7'}`}>
                              <input 
                                className="form-control form-control-sm fw-semibold" 
                                type="date" 
                                value={ev.date} 
                                onChange={e => {
                                  const newEvents = [...newSupplier.events];
                                  newEvents[idx].date = e.target.value;
                                  setNewSupplier({...newSupplier, events: newEvents});
                                }}
                              />
                            </div>

                            <div className="col-12 col-md-1 text-end">
                              <button 
                                type="button" 
                                className="btn btn-sm btn-link text-danger p-0 border-0 bg-transparent" 
                                onClick={() => {
                                  const newEvents = newSupplier.events.filter((_, i) => i !== idx);
                                  setNewSupplier({...newSupplier, events: newEvents});
                                }}
                              >
                                ❌
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="col-12">
                <label className="form-label fw-bold small text-muted text-uppercase">Description / Notes</label>
                <textarea 
                  className="form-control text-uppercase"
                  rows="2"
                  value={newSupplier.description}
                  onChange={e => setNewSupplier({...newSupplier, description: e.target.value.toUpperCase()})}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 p-4 pt-0">
            <Button variant="light" onClick={() => setShowSupplierModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" className="fw-bold px-4" disabled={supplierSubmitting}>
              {supplierSubmitting ? 'SAVING...' : 'SAVE ACCOUNT'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      <BarcodeScannerModal 
        show={scanner.show} 
        onHide={() => setScanner({ show: false, itemIndex: null })}
        onScanSuccess={(text) => {
          const idx = scanner.itemIndex;
          if (idx !== null && items[idx]) {
            const emptySlot = items[idx].imei_list.findIndex(v => !v.trim());
            updateImei(idx, emptySlot >= 0 ? emptySlot : 0, text);
          }
          toast.success(`Scanned: ${text}`);
        }}
      />

      <BulkScanModal 
        show={showBulkScan} 
        onHide={() => { setShowBulkScan(false); setEditingItemIndex(null); }}
        products={products}
        categories={categories}
        onAddItems={handleAddBulkItems}
        initialData={editingItemIndex !== null ? items[editingItemIndex] : null}
      />

      {/* ── BULK EDIT MODAL ── */}
      <Modal show={showBulkEditModal} onHide={() => setShowBulkEditModal(false)} centered size="md">
        <Modal.Header closeButton style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)',border:'none',padding:'18px 24px'}}>
          <Modal.Title className="text-white fw-bold d-flex align-items-center gap-2" style={{fontSize:'.95rem'}}>
            <span style={{background:'rgba(255,255,255,.15)',borderRadius:10,padding:'6px 10px'}}>✏️</span>
            Bulk Edit — {items.length} Item{items.length !== 1 ? 's' : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{background:'#f8fafc',padding:'20px 24px'}}>
          <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'10px 14px',marginBottom:18,fontSize:'.75rem',color:'#1d4ed8',fontWeight:600}}>
            💡 Only filled fields will be updated. Leave blank to keep existing values.
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div>
              <label style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.7px',textTransform:'uppercase',color:'#16a34a',display:'block',marginBottom:5}}>MOP (Selling Price) ₹</label>
              <input type="number" placeholder="e.g. 18999"
                style={{border:'1.5px solid #86efac',borderRadius:9,padding:'9px 12px',width:'100%',fontSize:'.85rem',fontWeight:700,background:'#fff',outline:'none',color:'#1e293b'}}
                value={bulkEditFields.selling_price}
                onChange={e => setBulkEditFields(p => ({...p, selling_price: e.target.value}))} />
            </div>
            <div>
              <label style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.7px',textTransform:'uppercase',color:'#6366f1',display:'block',marginBottom:5}}>Wholesale Price ₹</label>
              <input type="number" placeholder="e.g. 17500"
                style={{border:'1.5px solid #a5b4fc',borderRadius:9,padding:'9px 12px',width:'100%',fontSize:'.85rem',fontWeight:700,background:'#fff',outline:'none',color:'#1e293b'}}
                value={bulkEditFields.wholeseller_price}
                onChange={e => setBulkEditFields(p => ({...p, wholeseller_price: e.target.value}))} />
            </div>
            <div>
              <label style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.7px',textTransform:'uppercase',color:'#dc2626',display:'block',marginBottom:5}}>Min Selling Price ₹</label>
              <input type="number" placeholder="e.g. 17000"
                style={{border:'1.5px solid #fca5a5',borderRadius:9,padding:'9px 12px',width:'100%',fontSize:'.85rem',fontWeight:700,background:'#fff',outline:'none',color:'#1e293b'}}
                value={bulkEditFields.min_selling_price}
                onChange={e => setBulkEditFields(p => ({...p, min_selling_price: e.target.value}))} />
            </div>
            <div>
              <label style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.7px',textTransform:'uppercase',color:'#7c3aed',display:'block',marginBottom:5}}>Color</label>
              <input type="text" list="beColorOpts" placeholder="e.g. Starry Night"
                style={{border:'1.5px solid #ddd6fe',borderRadius:9,padding:'9px 12px',width:'100%',fontSize:'.85rem',fontWeight:700,background:'#fff',outline:'none',color:'#1e293b'}}
                value={bulkEditFields.color}
                onChange={e => setBulkEditFields(p => ({...p, color: e.target.value}))} />
              <datalist id="beColorOpts">{['Black','White','Blue','Gold','Silver','Red','Grey'].map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.7px',textTransform:'uppercase',color:'#0369a1',display:'block',marginBottom:5}}>RAM</label>
              <input type="text" list="beRamOpts" placeholder="e.g. 8GB"
                style={{border:'1.5px solid #bae6fd',borderRadius:9,padding:'9px 12px',width:'100%',fontSize:'.85rem',fontWeight:700,background:'#fff',outline:'none',color:'#1e293b'}}
                value={bulkEditFields.ram}
                onChange={e => setBulkEditFields(p => ({...p, ram: e.target.value}))} />
              <datalist id="beRamOpts">{['2GB','4GB','6GB','8GB','12GB','16GB'].map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div>
              <label style={{fontSize:'.65rem',fontWeight:800,letterSpacing:'.7px',textTransform:'uppercase',color:'#0369a1',display:'block',marginBottom:5}}>Storage (ROM)</label>
              <input type="text" list="beStorOpts" placeholder="e.g. 128GB"
                style={{border:'1.5px solid #bae6fd',borderRadius:9,padding:'9px 12px',width:'100%',fontSize:'.85rem',fontWeight:700,background:'#fff',outline:'none',color:'#1e293b'}}
                value={bulkEditFields.storage}
                onChange={e => setBulkEditFields(p => ({...p, storage: e.target.value}))} />
              <datalist id="beStorOpts">{['32GB','64GB','128GB','256GB','512GB'].map(v => <option key={v} value={v} />)}</datalist>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{background:'#fff',borderTop:'1px solid #e2e8f0',padding:'14px 24px'}}>
          <Button variant="outline-secondary" className="fw-bold px-4" onClick={() => setShowBulkEditModal(false)}>Cancel</Button>
          <Button className="fw-bold px-5" onClick={handleBulkEditApply}
            style={{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',border:'none',letterSpacing:.4}}>
            ✅ Apply to All {items.length} Items
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
