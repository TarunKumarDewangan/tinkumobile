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

const MOBILE_CATEGORIES = ['mobile-new', 'mobile-old', 'laptop', 'tablet'];

export default function MasterPurchaseForm() {
  const category_group = 'master';
  const defaultCategoryId = 1; // Default to MOBILE-NEW
  const [suppliers, setSuppliers] = useState([]);
  const [entitySuppliers, setEntitySuppliers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands]         = useState([]);
  const [shops, setShops]           = useState([]);
  const [items, setItems]         = useState([]);
  const [form, setForm] = useState({
    shop_id: 1, 
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
  const enableBulkAdd = true; 

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
    api.get('/products').then(r  => {
      setProducts(r.data.data || r.data);
    });
    api.get('/categories').then(r => setCategories(r.data));
    api.get('/subcategories').then(r => setSubcategories(r.data));
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
        setItems(p.items.map(i => {
          const unit_price = parseFloat(i.unit_price) || 0;
          const gst = parseFloat(i.calc_gst_rate ?? 18) || 0;

          const slug = i.product?.category?.slug?.toLowerCase() || '';
          let derivedItemType = 'mobile';
          if (slug) {
            if (!MOBILE_CATEGORIES.includes(slug)) {
              derivedItemType = 'other';
            }
          } else {
            if (!i.imei) {
              derivedItemType = 'other';
            }
          }

          const defaultTradeDisc = derivedItemType === 'other' ? 0 : 3.85;
          const defaultCashDisc = derivedItemType === 'other' ? 0 : 2;
          const tDisc = parseFloat(i.trade_disc_pct ?? defaultTradeDisc) || 0;
          const cDisc = parseFloat(i.cash_disc_pct ?? defaultCashDisc) || 0;
          
          const factor = (1 - tDisc/100) * (1 - cDisc/100);
          const rate_ex_gst = factor > 0 ? parseFloat((unit_price / factor).toFixed(2)) : unit_price;
          const dp_inc_gst = parseFloat((rate_ex_gst * (1 + gst/100)).toFixed(2));

          const pAttrs = i.product?.attributes || {};
          return {
            item_type: derivedItemType,
            product_id: i.product_id,
            brand_id: i.product?.brand_id || '',
            is_new: false,
            new_product_name: '',
            category_id: i.product?.category_id || '',
            imei_list: i.imei ? i.imei.split(/[\s,]+/).filter(Boolean) : [],
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
            selling_price: i.selling_price || '',
            wholeseller_price: i.wholeseller_price || '',
            min_selling_price: i.min_selling_price || '',
            max_selling_price: i.max_selling_price || '',
            incentive_amount: i.incentive_amount || '',
            subcategory: i.product?.subcategory || '',
            location: i.product?.location || '',
            brand_name: pAttrs.brand || '',
            has_brand: !!pAttrs.brand,
            apply_gst: !!pAttrs.gst_rate,
            gst_rate: pAttrs.gst_rate || '',
            warranty: pAttrs.warranty || 'No Warranty',
            description: pAttrs.description || ''
          };
        }));
      }).finally(() => setLoading(false));
    }
  }, [isOwner, id]);

  const loadSuppliers = async () => {
    const [suppRes, entRes] = await Promise.all([
      api.get('/suppliers'),
      api.get('/entities').catch(() => ({ data: [] }))
    ]);
    setSuppliers(suppRes.data);
    const entityList = (entRes.data || []).filter(e =>
      ['SUPPLIER', 'DISTRIBUTOR', 'SHOP_CUSTOMER'].includes((e.type || '').toUpperCase())
    );
    setEntitySuppliers(entityList);

    const types = (entRes.data || []).map(e => e.type).filter(Boolean);
    const uniqueCustomTypes = Array.from(new Set(types)).filter(
      t => !['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'OTHER'].includes(t)
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

  const handleTypeChange = (i, type) => {
    const a = [...items];
    a[i].item_type = type;

    if (type === 'mobile') {
      a[i].category_id = defaultCategoryId;
      a[i].imei_list = [''];
      a[i].trade_disc_pct = 3.85;
      a[i].cash_disc_pct = 2;
    } else {
      const otherCat = categories.find(c => !MOBILE_CATEGORIES.includes(c.slug?.toLowerCase()));
      a[i].category_id = otherCat ? otherCat.id : '';
      a[i].imei_list = [];
      a[i].ram = '';
      a[i].storage = '';
      a[i].trade_disc_pct = 0;
      a[i].cash_disc_pct = 0;
    }
    a[i].product_id = '';
    a[i].new_product_name = '';
    a[i].brand_id = null;

    // Recalculate price/unit_price using correct discounts
    const gst = parseFloat(a[i].calc_gst_rate ?? 18) || 0;
    const tDisc = parseFloat(a[i].trade_disc_pct) || 0;
    const cDisc = parseFloat(a[i].cash_disc_pct) || 0;
    const baseExGst = parseFloat(a[i].rate_ex_gst) || 0;
    const dp = parseFloat(a[i].dp_inc_gst) || 0;
    const sp = parseFloat(a[i].selling_price) || 0;

    if (!a[i].apply_gst && sp > 0) {
      a[i].dp_inc_gst = sp;
      a[i].rate_ex_gst = sp;
      const afterTDisc = sp - (sp * tDisc / 100);
      const afterCDisc = afterTDisc - (afterTDisc * cDisc / 100);
      a[i].unit_price = parseFloat(afterCDisc.toFixed(2));
    } else if (baseExGst > 0) {
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

    setItems(a);

    if (type === 'other') {
      setTimeout(() => {
        const catSelect = document.getElementById(`purchase-item-category-${i}`);
        if (catSelect) {
          catSelect.focus();
        }
      }, 50);
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
    const item = { ...items[i], imei_list: [] };
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

    if (['dp_inc_gst', 'rate_ex_gst', 'calc_gst_rate', 'trade_disc_pct', 'cash_disc_pct', 'unit_price', 'selling_price'].includes(field)) {
      const gst = parseFloat(a[i].calc_gst_rate ?? 18) || 0;
      const tDisc = parseFloat(a[i].trade_disc_pct ?? 3.85) || 0;
      const cDisc = parseFloat(a[i].cash_disc_pct ?? 2) || 0;

      if (field === 'selling_price') {
        const sp = parseFloat(val) || 0;
        if (!a[i].apply_gst) {
          a[i].dp_inc_gst = sp;
          a[i].rate_ex_gst = sp;
          const afterTDisc = sp - (sp * tDisc / 100);
          const afterCDisc = afterTDisc - (afterTDisc * cDisc / 100);
          a[i].unit_price = parseFloat(afterCDisc.toFixed(2));
        }
      } else if (field === 'dp_inc_gst') {
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
    
    if (field === 'product_id') {
      const p = products.find(x => x.id == val);
      if (p) {
        a[i].category_id = p.category_id || '';
        const cat = categories.find(c => c.id === p.category_id);
        const slug = cat?.slug?.toLowerCase() || '';
        const needsImei = ['mobile-new', 'mobile-old', 'laptop', 'tablet'].includes(slug);
        
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
        
        a[i].selling_price = (p.selling_price && parseFloat(p.selling_price) > 0) ? p.selling_price : (a[i].dp_inc_gst || '');
        a[i].wholeseller_price = p.wholeseller_price || '';
        a[i].min_selling_price = p.min_selling_price || '';
        a[i].max_selling_price = p.max_selling_price || '';
        a[i].incentive_amount = p.incentive_amount || '';
        
        if (p.attributes) {
          a[i].ram = p.attributes.ram || '';
          a[i].storage = p.attributes.storage || '';
          a[i].color = p.attributes.color || '';
        }
        
        a[i].imei_list = needsImei ? [''] : [];
        a[i].quantity = 1;
      }
    }
    setItems(a);
  };

  const isImeiCategory = (catId) => {
    const cat = categories.find(c => c.id === catId);
    const slug = cat?.slug?.toLowerCase() || '';
    return ['mobile-new', 'mobile-old', 'laptop', 'tablet'].includes(slug);
  };
  
  const updateImei = (itemIndex, imeiIndex, value) => {
    const a = [...items];
    const imeis = [...(a[itemIndex].imei_list || [])];
    imeis[imeiIndex] = value;
    a[itemIndex].imei_list = imeis;
    if (isImeiCategory(a[itemIndex].category_id)) {
      a[itemIndex].quantity = imeis.length;
    }
    setItems(a);
  };
  
  const handleQtyChange = (itemIndex, newQty) => {
    const a = [...items];
    if (newQty === '' || newQty === null || newQty === undefined) {
      a[itemIndex].quantity = '';
      setItems(a);
      return;
    }
    const qty = Math.max(1, parseInt(newQty) || 1);
    a[itemIndex].quantity = qty;
    
    if (isImeiCategory(a[itemIndex].category_id)) {
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

  const normalizeBulkItem = (ni) => {
    const imeiArr = ni.imei ? [ni.imei] : [];
    const { imei, ...rest } = ni;
    return { ...rest, imei_list: imeiArr, quantity: Math.max(1, imeiArr.length || ni.quantity || 1) };
  };

  const handleOpenBulkEdit = (index) => {
    setEditingItemIndex(index);
    setShowBulkScan(true);
  };

  const total      = items.reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.unit_price || 0)), 0);
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
    if (submitting) return;
    setSubmitting(true);
    
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
        const sub = it.subcategory === 'OTHER' ? it.custom_subcategory : it.subcategory;
        const categoryId = it.category_id === 'OTHER' ? null : it.category_id;
        const categoryName = it.category_id === 'OTHER' ? (it.custom_category || 'OTHER') : null;
        if (!isImeiCategory(it.category_id)) {
          flatItems.push({ ...rest, category_id: categoryId, category_name: categoryName, subcategory: sub, imei: imei_list?.[0] || '', quantity: rest.quantity || 1 });
        } else {
          const imeiArr = Array.isArray(imei_list) ? imei_list.filter(Boolean) : [];
          if (imeiArr.length > 0) {
            imeiArr.forEach(imei => {
              flatItems.push({ ...rest, category_id: categoryId, category_name: categoryName, subcategory: sub, imei: imei, quantity: 1 });
            });
          } else {
            flatItems.push({ ...rest, category_id: categoryId, category_name: categoryName, subcategory: sub, imei: '', quantity: rest.quantity || 1 });
          }
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
      navigate('/purchases?category_group=master');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving purchase');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const renderOtherRow = (item, i) => {
    const baseTabIndex = i * 30;
    const pPrice = parseFloat(item.unit_price) || 0;
    const sPrice = parseFloat(item.selling_price) || 0;
    const calcProfit = sPrice - pPrice;
    const calcMargin = sPrice ? ((calcProfit / sPrice) * 100) : 0;
    
    return (
      <div style={{
        background: '#f8fafc',
        border: '1.5px solid #cbd5e1',
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Category *</span>
            <select
              id={`purchase-item-category-${i}`}
              className="pf-inp"
              style={{ padding: '4px 6px', fontSize: '0.75rem', height: '32px' }}
              value={item.category_id || ''}
              disabled={!item.is_new && item.product_id}
              tabIndex={baseTabIndex + 1}
              onChange={e => {
                const val = e.target.value;
                if (val === 'OTHER') {
                  updateItem(i, 'category_id', 'OTHER');
                  updateItem(i, 'custom_category', '');
                } else {
                  updateItem(i, 'category_id', parseInt(val) || '');
                }
                updateItem(i, 'product_id', '');
                updateItem(i, 'new_product_name', '');
                updateItem(i, 'is_new', false);
              }}
            >
              <option value="">Select category</option>
              {categories
                .filter(c => !['mobile-new', 'mobile-old'].includes(c.slug?.toLowerCase()))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                ))
              }
              <option value="OTHER">+ OTHER (ADD CUSTOM CATEGORY)...</option>
            </select>
          </div>
          {(() => {
            const selCat = categories.find(c => c.id === item.category_id);
            const selSlug = selCat?.slug?.toLowerCase() || '';
            const isAccessory = selSlug === 'accessory' || selSlug === 'accessories';
            return isAccessory ? (
              <div>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Subcategory *</span>
                <select
                  className="pf-inp"
                  style={{ padding: '4px 6px', fontSize: '0.75rem', height: '32px' }}
                  value={item.subcategory || ''}
                  tabIndex={baseTabIndex + 2}
                  onChange={e => updateItem(i, 'subcategory', e.target.value)}
                >
                  <option value="">Select subcategory</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.name}>{sub.name.toUpperCase()}</option>
                  ))}
                  <option value="OTHER">+ OTHER SUB...</option>
                </select>
              </div>
            ) : <div />;
          })()}
        </div>

        {item.category_id === 'OTHER' && (
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#e85d04', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Custom Category Name *</span>
            <input
              type="text"
              className="pf-inp"
              style={{ padding: '4px 6px', fontSize: '0.75rem', borderColor: '#f97316' }}
              placeholder="e.g. EARPHONES / CHARGER / CABLE"
              tabIndex={baseTabIndex + 3}
              value={item.custom_category || ''}
              onChange={e => updateItem(i, 'custom_category', e.target.value.toUpperCase())}
            />
          </div>
        )}

        {item.subcategory === 'OTHER' && (
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Custom Subcategory *</span>
            <input
              type="text"
              className="pf-inp"
              style={{ padding: '4px 6px', fontSize: '0.75rem' }}
              placeholder="Enter subcategory name"
              tabIndex={baseTabIndex + 4}
              value={item.custom_subcategory || ''}
              onChange={e => updateItem(i, 'custom_subcategory', e.target.value.toUpperCase())}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: '13px', height: '13px', cursor: 'pointer' }}
              tabIndex={baseTabIndex + 5}
              checked={!!item.has_brand}
              onChange={e => {
                updateItem(i, 'has_brand', e.target.checked);
                if (!e.target.checked) updateItem(i, 'brand_name', '');
              }}
            />
            Product has Brand
          </label>
        </div>

        {item.has_brand && (
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Brand Name *</span>
            <input
              type="text"
              className="pf-inp"
              style={{ padding: '4px 6px', fontSize: '0.75rem' }}
              placeholder="e.g. Boat / Samsung"
              tabIndex={baseTabIndex + 6}
              value={item.brand_name || ''}
              onChange={e => updateItem(i, 'brand_name', e.target.value.toUpperCase())}
            />
          </div>
        )}

        <div>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Product Name *</span>
          <CreatableSelect
            tabIndex={baseTabIndex + 7}
            options={products
              .filter(p => {
                const cat = categories.find(c => c.id === p.category_id);
                const slug = cat?.slug?.toLowerCase() || '';
                return !MOBILE_CATEGORIES.includes(slug);
              })
              .map(p => {
                const brandStr = p.brand?.name || p.attributes?.brand || '';
                const fullName = `${brandStr ? brandStr + ' ' : ''}${p.name}`;
                return {
                  value: p.id,
                  label: `[${(categories.find(c => c.id === p.category_id)?.name || 'OTHER').toUpperCase()}] ${fullName}`.trim().toUpperCase()
                };
              })
            }
            value={item.product_id ? {
              value: item.product_id,
              label: (() => {
                const p = products.find(p => p.id === item.product_id);
                if (!p) return '';
                const brandStr = p.brand?.name || p.attributes?.brand || '';
                const fullName = `${brandStr ? brandStr + ' ' : ''}${p.name}`;
                return `[${(categories.find(c => c.id === p.category_id)?.name || 'OTHER').toUpperCase()}] ${fullName}`.trim().toUpperCase();
              })()
            } : (item.new_product_name ? { value: 'new', label: item.new_product_name.toUpperCase() } : null)}
            onChange={(opt) => {
              if (opt) {
                if (opt.value !== 'new') {
                  const p = products.find(p => p.id === opt.value);
                  updateItem(i, 'product_id', opt.value);
                  updateItem(i, 'new_product_name', '');
                  updateItem(i, 'is_new', false);
                  if (p) {
                    updateItem(i, 'category_id', p.category_id || '');
                    updateItem(i, 'subcategory', p.subcategory || '');
                    updateItem(i, 'location', p.location || '');
                    
                    const pAttrs = p.attributes || {};
                    updateItem(i, 'brand_name', pAttrs.brand || '');
                    updateItem(i, 'has_brand', !!pAttrs.brand);
                    updateItem(i, 'gst_rate', pAttrs.gst_rate || '');
                    updateItem(i, 'apply_gst', !!pAttrs.gst_rate);
                    updateItem(i, 'warranty', pAttrs.warranty || 'No Warranty');
                    updateItem(i, 'description', pAttrs.description || '');
                    
                    if (p.purchase_price) updateItem(i, 'unit_price', p.purchase_price);
                    if (p.selling_price) updateItem(i, 'selling_price', p.selling_price);
                    if (p.wholeseller_price) updateItem(i, 'wholeseller_price', p.wholeseller_price);
                    if (p.min_selling_price) updateItem(i, 'min_selling_price', p.min_selling_price);
                    if (p.incentive_amount) updateItem(i, 'incentive_amount', p.incentive_amount);
                  }
                }
              } else {
                updateItem(i, 'product_id', '');
                updateItem(i, 'new_product_name', '');
                updateItem(i, 'is_new', false);
              }
            }}
            onCreateOption={async (val) => {
              updateItem(i, 'new_product_name', val.toUpperCase());
              updateItem(i, 'product_id', '');
              updateItem(i, 'is_new', true);
            }}
            placeholder="Search / Type Product Name"
            isClearable
            styles={{
              control: (b) => ({ ...b, minHeight: '32px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fff', borderColor: '#cbd5e1', borderRadius: '6px', boxShadow: 'none' }),
              menu: (b) => ({ ...b, fontSize: '.75rem', zIndex: 9999 }),
              input: (b) => ({ ...b, fontSize: '0.75rem', fontWeight: 600 }),
              singleValue: (b) => ({ ...b, fontSize: '0.75rem', fontWeight: 600 }),
              placeholder: (b) => ({ ...b, fontSize: '0.75rem', fontWeight: 600 })
            }}
          />
        </div>

        <div style={{ display: 'flex', gridTemplateColumns: '1fr 1fr', gap: '6px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: '13px', height: '13px', cursor: 'pointer' }}
              tabIndex={baseTabIndex + 8}
              checked={!!item.apply_gst}
              onChange={e => {
                updateItem(i, 'apply_gst', e.target.checked);
                if (e.target.checked) {
                  updateItem(i, 'gst_rate', '18%');
                  updateItem(i, 'calc_gst_rate', 18);
                } else {
                  updateItem(i, 'gst_rate', '');
                  updateItem(i, 'calc_gst_rate', 0);
                  const mop = parseFloat(item.selling_price) || 0;
                  updateItem(i, 'dp_inc_gst', mop);
                  updateItem(i, 'rate_ex_gst', mop);
                  updateItem(i, 'unit_price', mop);
                }
              }}
            />
            Apply GST
          </label>
          {item.apply_gst && (
            <select
              className="pf-inp"
              style={{ padding: '4px 6px', fontSize: '0.75rem', height: '32px' }}
              tabIndex={baseTabIndex + 9}
              value={item.gst_rate || '18%'}
              onChange={e => {
                updateItem(i, 'gst_rate', e.target.value);
                updateItem(i, 'calc_gst_rate', parseInt(e.target.value) || 0);
              }}
            >
              <option value="0%">0%</option>
              <option value="5%">5%</option>
              <option value="12%">12%</option>
              <option value="18%">18%</option>
              <option value="28%">28%</option>
            </select>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Rack Location</span>
            <input
              type="text"
              className="pf-inp"
              style={{ padding: '4px 6px', fontSize: '0.75rem' }}
              placeholder="e.g. RACK A-01"
              tabIndex={baseTabIndex + 10}
              value={item.location || ''}
              onChange={e => updateItem(i, 'location', e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Profit</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1d4ed8' }}>₹{calcProfit.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Margin</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1d4ed8' }}>{calcMargin.toFixed(1)}%</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Description</span>
          <textarea
            className="pf-inp"
            rows="2"
            style={{ resize: 'none', padding: '4px 6px', fontSize: '0.75rem' }}
            placeholder="Product description..."
            tabIndex={baseTabIndex + 11}
            value={item.description || ''}
            onChange={e => updateItem(i, 'description', e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', background: '#f0fdf4', padding: '6px', borderRadius: '8px', border: '1px solid #b7e4c7' }}>
          <div>
            <span style={{ fontSize: '0.58rem', color: '#16a34a', display: 'block', fontWeight: 800, textAlign: 'center' }}>MOP</span>
            <input type="number" className="pf-inp" style={{ padding: '3px 2px', fontSize: '0.72rem', borderRadius: '4px', textAlign: 'right', fontWeight: 700, borderColor: '#86efac', background: '#fff' }} tabIndex={baseTabIndex + 15} value={item.selling_price} onChange={e=>updateItem(i,'selling_price',parseFloat(e.target.value))} />
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', color: '#4f46e5', display: 'block', fontWeight: 800, textAlign: 'center' }}>WHOLE.</span>
            <input type="number" className="pf-inp" style={{ padding: '3px 2px', fontSize: '0.72rem', borderRadius: '4px', textAlign: 'right', borderColor: '#cbd5e1', background: '#fff' }} tabIndex={baseTabIndex + 16} value={item.wholeseller_price} onChange={e=>updateItem(i,'wholeseller_price',parseFloat(e.target.value))} />
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', color: '#dc2626', display: 'block', fontWeight: 800, textAlign: 'center' }}>MIN</span>
            <input type="number" className="pf-inp" style={{ padding: '3px 2px', fontSize: '0.72rem', borderRadius: '4px', textAlign: 'right', borderColor: '#cbd5e1', background: '#fff' }} tabIndex={baseTabIndex + 17} value={item.min_selling_price} onChange={e=>updateItem(i,'min_selling_price',parseFloat(e.target.value))} />
          </div>
          <div>
            <span style={{ fontSize: '0.58rem', color: '#7c3aed', display: 'block', fontWeight: 800, textAlign: 'center' }}>COMM.</span>
            <input type="number" className="pf-inp" style={{ padding: '3px 2px', fontSize: '0.72rem', borderRadius: '4px', textAlign: 'right', borderColor: '#cbd5e1', background: '#fff' }} tabIndex={baseTabIndex + 18} value={item.incentive_amount} onChange={e=>updateItem(i,'incentive_amount',parseFloat(e.target.value))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
          <button type="button" onClick={() => setItems([...items, { product_id: '', brand_id: null, is_new: false, new_product_name: '', category_id: defaultCategoryId, imei_list: [''], ram: '', storage: '', color: '', quantity: 1, unit_price: 0, selling_price: 0, wholeseller_price: 0, min_selling_price: 0, max_selling_price: 0, incentive_amount: 0, show_calc: true, dp_inc_gst: '', calc_gst_rate: 18, trade_disc_pct: 0, cash_disc_pct: 0, rate_ex_gst: '', item_type: 'other', apply_gst: true }])} style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', color: '#4338ca', borderRadius: 6, padding: '3px 8px', fontSize: '.65rem', cursor: 'pointer', fontWeight: 700 }} tabIndex={baseTabIndex + 19}>➕ NEW ROW</button>
          <button type="button" onClick={() => removeItem(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, padding: '3px 8px', fontSize: '.65rem', cursor: 'pointer', fontWeight: 700 }} tabIndex={baseTabIndex + 20}>🗑 REMOVE</button>
        </div>
      </div>
    );
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

  const isDefaultType = ['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR'].includes(newSupplier.type);
  const isCustomType = customTypes.includes(newSupplier.type);
  const showCustomInput = newSupplier.type === 'OTHER' || (!isDefaultType && !isCustomType && newSupplier.type !== '');

  return (
    <div className="pf-wrap">
      <style>{S}</style>
      
      <div className="pf-hero">
        <div>
          <h2>{id ? '✍️ Edit Master Purchase' : '🗂️ New Master Purchase'}</h2>
          <p>Create purchases for any category group dynamically</p>
        </div>
        <button type="button" className="pf-back" onClick={() => navigate('/purchases?category_group=master')}>← Back</button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
      ) : (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
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
                          onClick={()=>setItems([...items,{product_id:'',brand_id:null,is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0,show_calc:true,dp_inc_gst:'',calc_gst_rate:18,trade_disc_pct:3.85,cash_disc_pct:2,rate_ex_gst:'',apply_gst:true}])}>
                          ➕ Add Row
                        </button>
                        <button type="button" style={{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',border:'none',color:'#fff',fontWeight:700,fontSize:'.72rem',padding:'7px 14px',borderRadius:9,cursor:'pointer'}}
                          onClick={() => { setBulkEditFields({ selling_price:'',wholeseller_price:'',min_selling_price:'',color:'',ram:'',storage:'' }); setShowBulkEditModal(true); }}>
                          ✏️ Bulk Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {items.length===0 ? (
                  <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8'}}>
                    <div style={{fontSize:'2.5rem',opacity:.3,marginBottom:8}}>🛒</div>
                    <div style={{fontWeight:700,fontSize:'.82rem',marginBottom:4}}>No items added yet</div>
                    <button type="button" style={{background:'#f1f5f9',border:'1.5px solid #e2e8f0',borderRadius:8,padding:'6px 16px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',color:'#6366f1'}}
                      onClick={()=>setItems([{product_id:'',is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0, show_calc: true, dp_inc_gst: '', calc_gst_rate: 18, trade_disc_pct: 3.85, cash_disc_pct: 2, rate_ex_gst: '', apply_gst: true}])}>
                      + Add Item
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{overflowX: 'auto'}}>
                      <table className="pf-invoice-table" style={{minWidth: '1150px'}}>
                        <thead>
                          <tr style={{background: '#f8fafc', fontWeight: 800}}>
                            <th style={{border: '1.5px solid #0f172a', padding: '8px', fontSize: '0.75rem', textTransform: 'uppercase', width: '90px', textAlign: 'center'}}>Product Type</th>
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
                            const needsImei = isImeiCategory(item.category_id);
                            const rowType = item.item_type || 'mobile';
                            return (
                              <tr key={i}>
                                {/* Type Selector Column */}
                                <td style={{ border: '1.5px solid #0f172a', padding: '8px', verticalAlign: 'top', width: '80px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginTop: 4 }}>
                                    <button
                                      type="button"
                                      onClick={() => handleTypeChange(i, 'mobile')}
                                      style={{
                                        background: rowType === 'mobile' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f1f5f9',
                                        color: rowType === 'mobile' ? '#fff' : '#64748b',
                                        border: rowType === 'mobile' ? 'none' : '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        padding: '6px 4px', fontSize: '.6rem', fontWeight: 800, cursor: 'pointer', width: '100%'
                                      }}
                                    >
                                      📱 MOBILE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTypeChange(i, 'other')}
                                      style={{
                                        background: rowType === 'other' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#f1f5f9',
                                        color: rowType === 'other' ? '#fff' : '#64748b',
                                        border: rowType === 'other' ? 'none' : '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        padding: '6px 4px', fontSize: '.6rem', fontWeight: 800, cursor: 'pointer', width: '100%'
                                      }}
                                    >
                                      📦 OTHER
                                    </button>
                                  </div>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '8px', verticalAlign: 'top', width: '380px'}}>
                                  {rowType === 'other' ? (
                                    renderOtherRow(item, i)
                                  ) : (
                                    <>
                                      <div style={{display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6}}>
                                        <div className="pf-item-num" style={{width: 24, height: 24, fontSize: '0.65rem', flexShrink: 0}}>{i + 1}</div>
                                        <div style={{flex: 1}}>
                                          <CreatableSelect
                                            tabIndex={baseTabIndex + 1}
                                            options={products
                                              .filter(p => {
                                                const cat = categories.find(c => c.id === p.category_id);
                                                const slug = cat?.slug?.toLowerCase() || '';
                                                const isMobile = MOBILE_CATEGORIES.includes(slug);
                                                return isMobile;
                                              })
                                              .map(p=>({value:p.id,label:`[${(categories.find(c=>c.id===p.category_id)?.name||'OTHER').toUpperCase()}] ${p.brand?p.brand.name+' ':''}${p.name} ${p.attributes?.ram||p.attributes?.storage?`(${p.attributes.ram||''}/${p.attributes.storage||''})`:''} ${p.attributes?.color?`- ${p.attributes.color}`:''}`.trim().toUpperCase()}))
                                            }
                                            value={item.product_id?{value:item.product_id,label:(()=>{const p=products.find(p=>p.id===item.product_id);return p?`[${(categories.find(c=>c.id===p.category_id)?.name||'OTHER').toUpperCase()}] ${p.brand?p.brand.name+' ':''}${p.name} ${p.attributes?.ram||p.attributes?.storage?`(${p.attributes.ram||''}/${p.attributes.storage||''})`:''} ${p.attributes?.color?`- ${p.attributes.color}`:''}`.trim().toUpperCase():'';})()}:(item.new_product_name?{value:'new',label:`${brands.find(b=>b.id===item.brand_id)?.name||''} ${item.new_product_name}`.trim().toUpperCase()}:null)}
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
                                      
                                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>Category *</span>
                                        <select
                                          className="form-select form-select-sm fw-bold text-uppercase"
                                          style={{ fontSize: '0.75rem', padding: '3px 8px', width: 'auto', borderRadius: '6px', borderColor: '#cbd5e1' }}
                                          value={item.category_id || ''}
                                          disabled={!item.is_new && item.product_id}
                                          onChange={e => {
                                            const catId = parseInt(e.target.value);
                                            updateItem(i, 'category_id', catId);
                                            const needsImei = isImeiCategory(catId);
                                            updateItem(i, 'imei_list', needsImei ? [''] : []);
                                            updateItem(i, 'quantity', 1);
                                          }}
                                        >
                                          <option value="">— Select Category —</option>
                                          {categories
                                            .filter(c => {
                                              const slug = c.slug?.toLowerCase() || '';
                                              const isMobile = MOBILE_CATEGORIES.includes(slug);
                                              return isMobile;
                                            })
                                            .map(c => (
                                              <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                                            ))
                                          }
                                        </select>
                                      </div>
                                      
                                      <div style={{display: 'flex', gap: 4, marginBottom: 6}}>
                                        <input ref={el=>ramRefs.current[i]=el} type="text" list="ramOptions" className="pf-inp" style={{padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px'}} placeholder="RAM" value={item.ram} onChange={e=>updateItem(i,'ram',e.target.value)} tabIndex={baseTabIndex + 2}/>
                                        <input type="text" list="storageOptions" className="pf-inp" style={{padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px'}} placeholder="Storage" value={item.storage} onChange={e=>updateItem(i,'storage',e.target.value)} tabIndex={baseTabIndex + 3}/>
                                        <input type="text" list="colorOptions" className="pf-inp" style={{padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px'}} placeholder="Color" value={item.color} onChange={e=>updateItem(i,'color',e.target.value)} tabIndex={baseTabIndex + 4}/>
                                      </div>

                                      <div style={{background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 8px', marginBottom: 6}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                                          <span style={{fontSize: '0.65rem', fontWeight: 800, color: '#3730a3'}}>📱 IMEI / SERIAL</span>
                                          {needsImei && (
                                            <button type="button" onClick={()=>setScanner({show:true,itemIndex:i})} style={{background:'#6366f1', border:'none', color:'#fff', borderRadius:4, padding:'2px 8px', cursor:'pointer', fontSize:'.65rem', fontWeight:700}}>📷 SCAN</button>
                                          )}
                                        </div>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: 4}}>
                                          {!needsImei ? (
                                            <input
                                              type="text"
                                              className="pf-inp"
                                              style={{padding: '3px 6px', fontSize: '0.75rem', borderRadius: '4px', borderColor: '#cbd5e1', color: '#3730a3', fontWeight: 600}}
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
                                        <button type="button" onClick={()=>setItems([...items,{product_id:'',brand_id:null,is_new:false,new_product_name:'',category_id:defaultCategoryId,imei_list:[''],ram:'',storage:'',color:'',quantity:1,unit_price:0,selling_price:0,wholeseller_price:0,min_selling_price:0,max_selling_price:0,incentive_amount:0,show_calc:true,dp_inc_gst:'',calc_gst_rate:18,trade_disc_pct:3.85,cash_disc_pct:2,rate_ex_gst:'',apply_gst:true}])} style={{background:'#e0e7ff', border:'1px solid #c7d2fe', color:'#4338ca', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 9}>➕ NEW ROW</button>
                                        <button type="button" onClick={()=>duplicateRow(i,'color')} style={{background:'#f0fdf4', border:'1px solid #86efac', color:'#16a34a', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 10}>➕ COLOR</button>
                                        <button type="button" onClick={()=>duplicateRow(i,'specs')} style={{background:'#fefce8', border:'1px solid #fde047', color:'#ca8a04', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 11}>➕ SPECS</button>
                                        <button type="button" onClick={()=>removeItem(i)} style={{background:'#fef2f2', border:'1px solid #fecaca', color:'#ef4444', borderRadius:6, padding:'3px 8px', fontSize:'.65rem', cursor:'pointer', fontWeight:700}} tabIndex={baseTabIndex + 6 + item.imei_list.length + 12}>🗑 REMOVE</button>
                                      </div>
                                    </>
                                  )}
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'center', verticalAlign: 'top'}}>
                                  <span style={{fontSize: '0.75rem', fontWeight: 700, color: '#475569'}}>85171300</span>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'center', verticalAlign: 'top', width: '80px'}}>
                                  <input type="number" className="pf-inp" min="1" {...(needsImei ? { max: 25 } : {})} value={item.quantity} onChange={e=>handleQtyChange(i, e.target.value)} onBlur={e=>{if(e.target.value===''||parseInt(e.target.value)<1)handleQtyChange(i,1);}} style={{textAlign:'center', fontWeight:800, padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={item.item_type === 'other' ? baseTabIndex + 12 : baseTabIndex + 5} ref={el=>qtyRefs.current[i]=el}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '110px'}}>
                                  <input type="number" className="pf-inp" placeholder="0.00" value={item.dp_inc_gst||''} onChange={e=>updateItem(i,'dp_inc_gst',e.target.value)} style={{textAlign:'right', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={item.item_type === 'other' ? baseTabIndex + 14 : baseTabIndex + 6 + item.imei_list.length + 2}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '110px'}}>
                                  <input type="number" className="pf-inp" step=".01" value={item.rate_ex_gst||''} onChange={e=>updateItem(i,'rate_ex_gst',parseFloat(e.target.value))} style={{textAlign:'right', fontWeight:800, color:'#4f46e5', background:'#eef2ff', borderColor:'#c7d2fe', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={item.item_type === 'other' ? baseTabIndex + 13 : baseTabIndex + 6 + item.imei_list.length}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'center', verticalAlign: 'top'}}>
                                  <span style={{fontSize: '0.75rem', fontWeight: 700, color: '#475569'}}>Pcs</span>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '85px'}}>
                                  <input type="number" className="pf-inp" value={item.trade_disc_pct??(item.item_type === 'other' ? 0 : 3.85)} onChange={e=>updateItem(i,'trade_disc_pct',e.target.value)} style={{textAlign:'right', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={item.item_type === 'other' ? baseTabIndex + 21 : baseTabIndex + 6 + item.imei_list.length + 3}/>
                                </td>

                                <td style={{border: '1.5px solid #0f172a', padding: '6px', textAlign: 'right', verticalAlign: 'top', width: '85px'}}>
                                  <input type="number" className="pf-inp" value={item.cash_disc_pct??(item.item_type === 'other' ? 0 : 2)} onChange={e=>updateItem(i,'cash_disc_pct',e.target.value)} style={{textAlign:'right', padding: '4px 6px', fontSize: '0.8rem'}} tabIndex={item.item_type === 'other' ? baseTabIndex + 22 : baseTabIndex + 6 + item.imei_list.length + 4}/>
                                </td>
                                <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', verticalAlign: 'top', width: '120px', fontWeight: 800, fontSize: '0.85rem'}}>
                                  ₹{lineTotal.toLocaleString('en-IN',{minimumFractionDigits:2, maximumFractionDigits: 2})}
                                </td>
                              </tr>
                            );
                          })}

                          <tr style={{borderTop: '2px solid #0f172a'}}>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800}} colSpan={2}>Subtotal</td>
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

                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800}} colSpan={2}>Trade Discount (₹)</td>
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

                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 800}} colSpan={2}>
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

                          {form.calculate_gst && (
                            <tr>
                              <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 700}} colSpan={2}>Cgst Output</td>
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

                          {form.calculate_gst && (
                            <tr>
                              <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 700}} colSpan={2}>Sgst Output</td>
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

                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'left', fontWeight: 800}} colSpan={2}>
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
                            <td style={{border: '1.5px solid #0f172a', padding: '6px 10px', textAlign: 'right'}}>
                              <input type="number" value={form.cash_discount===0?'':form.cash_discount} onFocus={e=>e.target.select()} onChange={e=>setForm({...form,cash_discount:parseFloat(e.target.value)||0})}
                                style={{width:'90px',border:'1px solid #cbd5e1',borderRadius:4,textAlign:'right',fontWeight:700,padding:'2px 6px',fontSize:'.8rem',color:'#0f172a',background:'#fff'}} placeholder="0"/>
                            </td>
                          </tr>

                          {/* ROUND-OFF ROW */}
                          <tr>
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800}} colSpan={2}>Round Off</td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'center'}}>
                              <div style={{display:'flex',gap:2,justifyContent:'center'}}>
                                {['auto','up','down'].map(m=>(
                                  <button key={m} type="button" onClick={()=>{setForm({...form,rounding_mode:m}); setIsManualRound(false);}}
                                    style={{background:form.rounding_mode===m?'#0f172a':'#f1f5f9',border:'1px solid #cbd5e1',color:form.rounding_mode===m?'#fff':'#0f172a',borderRadius:4,padding:'1px 5px',fontSize:'.65rem',cursor:'pointer',fontWeight:700}}>
                                    {m?.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem'}}>
                              {isManualRound ? (
                                <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                                  <input type="number" step="0.001" value={form.round_off} onChange={e=>setForm({...form,round_off:parseFloat(e.target.value)||0})}
                                    style={{width:75,border:'1px solid #0f172a',borderRadius:4,color:'#0f172a',textAlign:'right',fontSize:'.78rem',padding:'2px 6px',background:'#fff',fontWeight:700}}/>
                                  <button type="button" onClick={resetRoundOff} style={{background:'none',border:'none',color:'#ef4444',fontSize:'.65rem',cursor:'pointer',padding:0}}>↺</button>
                                </div>
                              ) : (
                                <span onClick={()=>{setIsManualRound(true); setForm(f=>({...f,rounding_mode:'manual'}))}} style={{cursor:'pointer',borderBottom:'1px dashed #0f172a'}} title="Click to override manually">₹{parseFloat(roundOff).toFixed(2)} ✏️</span>
                              )}
                            </td>
                          </tr>

                          <tr className="total-row">
                            <td className="lbl" style={{border: '1.5px solid #0f172a', padding: '10px', textAlign: 'right', fontWeight: 900, fontSize: '1rem'}} colSpan={2}>Total</td>
                            <td style={{border: '1.5px solid #0f172a', padding: '10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '10px'}}></td>
                            <td style={{border: '1.5px solid #0f172a', padding: '10px'}}></td>
                            <td className="val" style={{border: '1.5px solid #0f172a', padding: '10px', fontWeight: 900, fontSize: '1.15rem'}}>
                              ₹{grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2, maximumFractionDigits: 2})}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-12 col-md-8">
              <div className="pf-card" style={{height:'100%'}}>
                <div className="pf-sec">💳 Payments & Notes</div>
                <div className="row g-2">
                  <div className="col-6">
                    <span className="pf-lbl">Payment Mode</span>
                    <select className="pf-inp" value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
                      <option value="CASH">💵 CASH</option>
                      <option value="BANK">🏛️ BANK TRANSFER / IMPS / NEFT</option>
                      <option value="UPI">📱 UPI / GPAY / PHONEPE</option>
                      <option value="CREDIT">🤝 CREDIT (PARTIAL / OUTSTANDING)</option>
                      <option value="OTHER">⚙️ OTHER PAYMENT MODE</option>
                    </select>
                  </div>
                  {form.payment_method === 'OTHER' && (
                    <div className="col-6">
                      <span className="pf-lbl">Specify Payment Mode *</span>
                      <input type="text" required className="pf-inp" style={{borderColor:'#818cf8'}} placeholder="e.g. CHEQUE, DEBIT CARD" value={form.other_payment_mode} onChange={e=>setForm({...form,other_payment_mode:e.target.value})}/>
                    </div>
                  )}
                  <div className="col-6">
                    <span className="pf-lbl">Amount Paid (₹)</span>
                    <input type="number" min="0" max={grandTotal} className="pf-inp" value={form.total_paid===0?'':form.total_paid} onChange={e=>setForm({...form,total_paid:parseFloat(e.target.value)||0})} style={{fontWeight:700,color:'#16a34a'}}/>
                  </div>
                  <div className="col-12">
                    <span className="pf-lbl">Internal Notes / Reminders</span>
                    <textarea className="pf-inp" rows="3" style={{resize:'none'}} placeholder="e.g. Bill no, payment due date..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="pf-sum">
                <h4 style={{fontSize:'.82rem',fontWeight:800,letterSpacing:1,textTransform:'uppercase',color:'#64748b',marginBottom:14}}>Billing Summary</h4>
                <div className="pf-sum-row"><span>Subtotal:</span><span className="fw-bold">₹{total.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
                {form.calculate_gst && (
                  <>
                    <div className="pf-sum-row"><span>CGST ({form.cgst_rate}%):</span><span className="fw-bold">₹{cgstAmount.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
                    <div className="pf-sum-row"><span>SGST ({form.sgst_rate}%):</span><span className="fw-bold">₹{sgstAmount.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
                  </>
                )}
                {form.discount > 0 && <div className="pf-sum-row" style={{color:'#b91c1c'}}><span>Trade Discount:</span><span className="fw-bold">-₹{form.discount.toLocaleString('en-IN')}</span></div>}
                {form.cash_discount > 0 && form.is_cash_discount_on_bill && <div className="pf-sum-row" style={{color:'#0284c7'}}><span>Cash Discount:</span><span className="fw-bold">-₹{form.cash_discount.toLocaleString('en-IN')}</span></div>}
                <div className="pf-sum-row">
                  <span>Round Off:</span>
                  <div className="d-flex align-items-center gap-1">
                    <button type="button" onClick={()=>adjustRoundOff(-0.1)} className="btn btn-xs btn-outline-secondary py-0" style={{lineHeight:1,fontSize:'0.6rem'}}>-</button>
                    <span className="fw-bold font-monospace" style={{fontSize:'0.75rem'}}>{parseFloat(roundOff) > 0 ? '+' : ''}{parseFloat(roundOff).toFixed(3)}</span>
                    <button type="button" onClick={()=>adjustRoundOff(0.1)} className="btn btn-xs btn-outline-secondary py-0" style={{lineHeight:1,fontSize:'0.6rem'}}>+</button>
                  </div>
                </div>
                <div className="pf-sum-row" style={{borderTop:'2.5px double #0f172a',paddingTop:12,marginTop:6}}>
                  <span style={{fontWeight:800,fontSize:'.85rem'}}>Grand Total:</span>
                  <span className="pf-grand">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="pf-sum-row" style={{color:'#16a34a'}}><span>Amount Paid:</span><span className="fw-bold">₹{(form.total_paid || 0).toLocaleString('en-IN')}</span></div>
                <div className="pf-sum-row" style={{color:(grandTotal - (form.total_paid || 0)) > 0 ? '#b91c1c' : '#475569'}}>
                  <span>Outstanding Balance:</span>
                  <span className="fw-bold">₹{(grandTotal - (form.total_paid || 0)).toLocaleString('en-IN')}</span>
                </div>
                <button type="submit" disabled={submitting} className={`pf-submit w-100 mt-3 ${form.status==='received'?'green':''}`}>
                  {submitting ? 'Saving...' : (form.status === 'received' ? 'Save & Add Stock' : 'Create Purchase Order')}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Bulk Scan Modal */}
      <BulkScanModal
        isOpen={showBulkScan}
        onClose={() => { setShowBulkScan(false); setEditingItemIndex(null); }}
        onAdd={handleAddBulkItems}
        products={products}
        categories={categories}
        brands={brands}
        defaultCategoryId={defaultCategoryId}
        isEditMode={editingItemIndex !== null}
        editItemData={editingItemIndex !== null ? items[editingItemIndex] : null}
      />

      {/* Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scanner.show}
        onClose={() => setScanner({ show: false, itemIndex: null })}
        onDetected={(code) => {
          if (scanner.itemIndex !== null) {
            updateImei(scanner.itemIndex, 0, code);
            setScanner({ show: false, itemIndex: null });
            toast.success(`📷 IMEI Scanned: ${code}`);
          }
        }}
      />

      {/* Quick Add Supplier Modal */}
      <Modal show={showSupplierModal} onHide={()=>setShowSupplierModal(false)} centered>
        <Modal.Header closeButton style={{background:'linear-gradient(135deg,#1a1a2e,#16213e)',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontWeight:700,fontSize:'1rem'}}>➕ Quick Add Distributor / Supplier Entity</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleQuickSupplierAdd}>
          <Modal.Body style={{padding:'20px 24px'}}>
            <div className="row g-2">
              <div className="col-12">
                <span className="pf-lbl">Entity Name *</span>
                <input type="text" required className="pf-inp" placeholder="e.g. VIJAY MARKETING" value={newSupplier.name} onChange={e=>setNewSupplier({...newSupplier,name:e.target.value.toUpperCase()})}/>
              </div>
              <div className="col-6">
                <span className="pf-lbl">Entity Type *</span>
                <select className="pf-inp" required value={newSupplier.type} onChange={e=>setNewSupplier({...newSupplier,type:e.target.value})}>
                  <option value="">— Select Type —</option>
                  <option value="SUPPLIER">DISTRIBUTOR / SUPPLIER</option>
                  <option value="DISTRIBUTOR">MARKETING DISTRIBUTOR</option>
                  <option value="SHOP_CUSTOMER">SHOP CUSTOMER / SUNDRY CREDITOR</option>
                  {customTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="OTHER">+ ADD OTHER / CUSTOM TYPE...</option>
                </select>
              </div>
              {showCustomInput && (
                <div className="col-6">
                  <span className="pf-lbl">Enter Custom Type *</span>
                  <input type="text" required className="pf-inp" placeholder="e.g. FINANCE COMPANY" value={newSupplier.type === 'OTHER' ? '' : newSupplier.type} onChange={e=>setNewSupplier({...newSupplier,type:e.target.value.toUpperCase()})}/>
                </div>
              )}
              <div className="col-6">
                <span className="pf-lbl">Phone Number</span>
                <input type="text" className="pf-inp" placeholder="10-digit phone" value={newSupplier.phone} onChange={e=>setNewSupplier({...newSupplier,phone:e.target.value})}/>
              </div>
              <div className="col-6">
                <span className="pf-lbl">GSTIN / Tax ID</span>
                <input type="text" className="pf-inp" placeholder="15-digit GSTIN" value={newSupplier.gst_number} onChange={e=>setNewSupplier({...newSupplier,gst_number:e.target.value.toUpperCase()})}/>
              </div>
              <div className="col-12">
                <span className="pf-lbl">Distributor Address / Description</span>
                <textarea className="pf-inp" rows="2" style={{resize:'none'}} placeholder="Physical address, terms, email..." value={newSupplier.description} onChange={e=>setNewSupplier({...newSupplier,description:e.target.value.toUpperCase()})}/>
              </div>
              <div className="col-6">
                <span className="pf-lbl">Opening Balance (₹)</span>
                <input type="number" min="0" className="pf-inp" placeholder="0.00" value={newSupplier.opening_balance===0?'':newSupplier.opening_balance} onChange={e=>setNewSupplier({...newSupplier,opening_balance:parseFloat(e.target.value)||0})}/>
              </div>
              <div className="col-6">
                <span className="pf-lbl">Balance Type</span>
                <select className="pf-inp" value={newSupplier.balance_type} onChange={e=>setNewSupplier({...newSupplier,balance_type:e.target.value})}>
                  <option value="RECEIVABLE">DEBIT (DR - WE RECEIVE)</option>
                  <option value="PAYABLE">CREDIT (CR - WE PAY)</option>
                </select>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={{borderTop:'none',padding:'0 24px 20px'}}>
            <Button variant="light" className="fw-bold" onClick={()=>setShowSupplierModal(false)}>Cancel</Button>
            <Button type="submit" disabled={supplierSubmitting} className="pf-submit" style={{padding:'8px 24px'}}>{supplierSubmitting ? 'Saving...' : 'Save Supplier'}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Bulk Edit Modal */}
      <Modal show={showBulkEditModal} onHide={() => setShowBulkEditModal(false)} centered>
        <Modal.Header closeButton style={{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontWeight:700,fontSize:'1rem'}}>✏️ Bulk Edit All {items.length} Items</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'20px 24px'}}>
          <p style={{fontSize:'.75rem',color:'#64748b',marginBottom:12}}>Leave fields empty if you do not want to overwrite them.</p>
          <div className="row g-2">
            <div className="col-6">
              <span className="pf-lbl">MOP / Retail Price (₹)</span>
              <input type="number" className="pf-inp" placeholder="No change" value={bulkEditFields.selling_price} onChange={e=>setBulkEditFields({...bulkEditFields,selling_price:parseFloat(e.target.value)||''})}/>
            </div>
            <div className="col-6">
              <span className="pf-lbl">Wholeseller Price (₹)</span>
              <input type="number" className="pf-inp" placeholder="No change" value={bulkEditFields.wholeseller_price} onChange={e=>setBulkEditFields({...bulkEditFields,wholeseller_price:parseFloat(e.target.value)||''})}/>
            </div>
            <div className="col-6">
              <span className="pf-lbl">Min Selling Price (₹)</span>
              <input type="number" className="pf-inp" placeholder="No change" value={bulkEditFields.min_selling_price} onChange={e=>setBulkEditFields({...bulkEditFields,min_selling_price:parseFloat(e.target.value)||''})}/>
            </div>
            <div className="col-6">
              <span className="pf-lbl">Color Name</span>
              <input type="text" className="pf-inp" placeholder="No change" value={bulkEditFields.color} onChange={e=>setBulkEditFields({...bulkEditFields,color:e.target.value.toUpperCase()})}/>
            </div>
            <div className="col-6">
              <span className="pf-lbl">RAM Config</span>
              <input type="text" className="pf-inp" placeholder="No change" value={bulkEditFields.ram} onChange={e=>setBulkEditFields({...bulkEditFields,ram:e.target.value.toUpperCase()})}/>
            </div>
            <div className="col-6">
              <span className="pf-lbl">Storage Config</span>
              <input type="text" className="pf-inp" placeholder="No change" value={bulkEditFields.storage} onChange={e=>setBulkEditFields({...bulkEditFields,storage:e.target.value.toUpperCase()})}/>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{borderTop:'none',padding:'0 24px 20px'}}>
          <Button variant="light" className="fw-bold" onClick={() => setShowBulkEditModal(false)}>Cancel</Button>
          <Button type="button" className="pf-submit" style={{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',padding:'8px 24px'}} onClick={handleBulkEditApply}>Apply Overwrite</Button>
        </Modal.Footer>
      </Modal>

      {/* Datalists for Autocomplete */}
      <datalist id="ramOptions">
        {['2GB','3GB','4GB','6GB','8GB','12GB','16GB'].map(x => <option key={x} value={x}/>)}
      </datalist>
      <datalist id="storageOptions">
        {['16GB','32GB','64GB','128GB','256GB','512GB','1TB'].map(x => <option key={x} value={x}/>)}
      </datalist>
      <datalist id="colorOptions">
        {['BLACK','WHITE','GOLD','BLUE','GREEN','RED','SILVER','GRAY'].map(x => <option key={x} value={x}/>)}
      </datalist>
    </div>
  );
}
