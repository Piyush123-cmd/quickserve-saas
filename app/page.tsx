'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { 
  UtensilsCrossed, 
  ChefHat, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  Volume2, 
  QrCode, 
  Printer, 
  Lock, 
  LogOut, 
  Store,
  CreditCard,
  Banknote,
  X,
  TrendingUp,
  DollarSign,
  Bell,
  Droplets,
  Receipt,
  UserCheck,
  Search,
  Clock,
  Flame,
  History,
  Sun,
  Moon,
  MessageSquareQuote,
  Image as ImageIcon,
  AlertTriangle,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

const CAFE_ID = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

interface CafeData {
  id: string;
  name: string;
  upi_id?: string;
  staff_pin: string;
  admin_pin: string;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  image_url?: string;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

interface OrderItem {
  id: string;
  name?: string;
  quantity: number;
  price?: number;
  price_at_order?: number;
  menu_items: { name: string } | null;
}

interface Order {
  id: string;
  table_number?: number;
  table_no?: string;
  customer_name: string;
  total_amount: number;
  payment_mode?: string;
  payment_status?: string;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  special_instructions?: string;
  created_at: string;
  order_items: OrderItem[];
}

interface ServiceRequest {
  id: string;
  table_number: number;
  request_type: string;
  status: string;
  created_at: string;
}

function getFallbackImage(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('tea') || n.includes('chai')) return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&auto=format&fit=crop&q=60';
  if (n.includes('coffee')) return 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=300&auto=format&fit=crop&q=60';
  if (n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=60';
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&auto=format&fit=crop&q=60';
  if (n.includes('fry') || n.includes('fries')) return 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=300&auto=format&fit=crop&q=60';
  if (n.includes('sandwich')) return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=60';
  if (n.includes('rice') || n.includes('biryani')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=60';
  if (n.includes('shake') || n.includes('smoothie')) return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&auto=format&fit=crop&q=60';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60';
}

function getTimeAgo(dateString: string): { label: string; isDelayed: boolean } {
  const diffInMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diffInMinutes <= 0) return { label: 'Just now', isDelayed: false };
  if (diffInMinutes < 60) return { label: `${diffInMinutes}m ago`, isDelayed: diffInMinutes >= 15 };
  const diffInHours = Math.floor(diffInMinutes / 60);
  return { label: `${diffInHours}h ago`, isDelayed: true };
}

export default function QuickServeFullApp() {
  const [cafe, setCafe] = useState<CafeData | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'kitchen' | 'admin'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('today');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'veg' | 'non-veg'>('all');

  const [customerOrderIds, setCustomerOrderIds] = useState<string[]>([]);
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);

  const [isStaffAuthed, setIsStaffAuthed] = useState(false);
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [selectedTable, setSelectedTable] = useState('1');
  const [isCustomerViewOnly, setIsCustomerViewOnly] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [assistanceSent, setAssistanceSent] = useState(false);

  // Admin item input
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isVeg, setIsVeg] = useState(true);

  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get('table');
      if (tableParam) {
        setSelectedTable(tableParam);
        setIsCustomerViewOnly(true);
        setActiveTab('menu');
      }

      if (localStorage.getItem(`staff_auth_${CAFE_ID}`) === 'true') {
        setIsStaffAuthed(true);
      }
      if (localStorage.getItem(`admin_auth_${CAFE_ID}`) === 'true') {
        setIsAdminAuthed(true);
      }

      const savedTheme = localStorage.getItem('quickserve_theme');
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      }

      try {
        const saved = localStorage.getItem(`quickserve_orders_${CAFE_ID}`);
        if (saved) {
          setCustomerOrderIds(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    }

    fetchInitialData();

    const ordersChannel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `cafe_id=eq.${CAFE_ID}` },
        () => {
          setTimeout(() => {
            fetchOrders();
          }, 500);
          playBeep(880);
        }
      )
      .subscribe();

    const serviceChannel = supabase
      .channel('realtime-services')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `cafe_id=eq.${CAFE_ID}` },
        () => {
          fetchServiceRequests();
          playBeep(1200);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(serviceChannel);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem('quickserve_theme', nextTheme ? 'dark' : 'light');
  };

  async function fetchInitialData() {
    setLoading(true);
    await Promise.all([fetchCafeDetails(), fetchMenu(), fetchOrders(), fetchServiceRequests()]);
    setLoading(false);
  }

  async function fetchCafeDetails() {
    try {
      const { data } = await supabase.from('cafes').select('*').eq('id', CAFE_ID).single();
      if (data) setCafe(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchMenu() {
    try {
      const { data } = await supabase.from('menu_items').select('*').eq('cafe_id', CAFE_ID);
      if (data) setMenuItems(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_number,
          customer_name,
          total_amount,
          payment_mode,
          payment_status,
          status,
          special_instructions,
          created_at,
          order_items (
            id,
            name,
            quantity,
            price,
            price_at_order,
            menu_items (
              name
            )
          )
        `)
        .eq('cafe_id', CAFE_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setOrders(data as unknown as Order[]);
    } catch (e) {
      console.error('Fetch orders error:', e);
    }
  }

  async function fetchServiceRequests() {
    try {
      const { data } = await supabase
        .from('service_requests')
        .select('*')
        .eq('cafe_id', CAFE_ID)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (data) setServiceRequests(data as ServiceRequest[]);
    } catch (e) {
      console.error(e);
    }
  }

  const playBeep = (freq = 880) => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const handleVerifyPin = () => {
    if (activeTab === 'kitchen') {
      const validStaffPin = cafe?.staff_pin || '1234';
      if (pinInput === validStaffPin || pinInput === (cafe?.admin_pin || '9999')) {
        setIsStaffAuthed(true);
        localStorage.setItem(`staff_auth_${CAFE_ID}`, 'true');
        setPinInput('');
        setPinError(false);
      } else {
        setPinError(true);
      }
    } else if (activeTab === 'admin') {
      const validAdminPin = cafe?.admin_pin || '9999';
      if (pinInput === validAdminPin) {
        setIsAdminAuthed(true);
        localStorage.setItem(`admin_auth_${CAFE_ID}`, 'true');
        setPinInput('');
        setPinError(false);
      } else {
        setPinError(true);
      }
    }
  };

  const handleLogout = (role: 'staff' | 'admin') => {
    if (role === 'staff') {
      setIsStaffAuthed(false);
      localStorage.removeItem(`staff_auth_${CAFE_ID}`);
    } else {
      setIsAdminAuthed(false);
      localStorage.removeItem(`admin_auth_${CAFE_ID}`);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        cafe_id: CAFE_ID,
        name,
        price: parseFloat(price),
        description,
        image_url: imageUrl.trim() || null,
        is_veg: isVeg,
        is_available: true,
      })
      .select()
      .single();

    if (!error && data) {
      setMenuItems((prev) => [...prev, data]);
      setName('');
      setPrice('');
      setDescription('');
      setImageUrl('');
    }
  };

  const handleDeleteItem = async (id: string) => {
    await supabase.from('menu_items').delete().eq('id', id);
    setMenuItems((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleAvailability = async (item: MenuItem) => {
    const updated = !item.is_available;
    await supabase.from('menu_items').update({ is_available: updated }).eq('id', item.id);
    setMenuItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: updated } : i))
    );
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce((s, i) => s + i.item.price * i.quantity, 0);
  const cafeUPI = cafe?.upi_id || 'demo@upi';
  const upiPaymentUrl = `upi://pay?pa=${cafeUPI}&pn=${encodeURIComponent(cafe?.name || 'Cafe')}&am=${totalAmount}&cu=INR&tn=Table${selectedTable}_Order`;

  const handleConfirmOrder = async () => {
    if (cart.length === 0 || submittingOrder) return;
    setSubmittingOrder(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          cafe_id: CAFE_ID,
          table_number: parseInt(selectedTable, 10) || 1,
          customer_name: customerName || 'Guest',
          total_amount: totalAmount,
          payment_mode: selectedPaymentMode,
          payment_status: selectedPaymentMode === 'upi' ? 'paid' : 'pending',
          status: 'pending',
          special_instructions: specialInstructions.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((c) => ({
        order_id: orderData.id,
        menu_item_id: c.item.id,
        name: c.item.name,
        quantity: c.quantity,
        price: c.item.price,
        price_at_order: c.item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) console.error('Order items error:', itemsError);

      const updatedIds = [orderData.id, ...customerOrderIds];
      setCustomerOrderIds(updatedIds);
      localStorage.setItem(`quickserve_orders_${CAFE_ID}`, JSON.stringify(updatedIds));

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setShowCheckoutModal(false);
      setOrderSuccess(true);
      setCart([]);
      setSpecialInstructions('');

      setTimeout(() => {
        fetchOrders();
      }, 500);

    } catch (err: unknown) {
      const errorObj = err as { message?: string; details?: string };
      console.error(err);
      alert(`Order Error: ${errorObj?.message || errorObj?.details || JSON.stringify(err)}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSendAssistance = async (type: string) => {
    try {
      await supabase.from('service_requests').insert({
        cafe_id: CAFE_ID,
        table_number: parseInt(selectedTable, 10) || 1,
        request_type: type,
        status: 'pending',
      });
      setAssistanceSent(true);
      setTimeout(() => {
        setAssistanceSent(false);
        setShowAssistanceModal(false);
      }, 2000);
      fetchServiceRequests();
    } catch (e) {
      console.error(e);
    }
  };

  const resolveServiceRequest = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'resolved' }).eq('id', requestId);
    fetchServiceRequests();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    fetchOrders();
  };

  const togglePaymentStatus = async (orderId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    await supabase.from('orders').update({ payment_status: nextStatus }).eq('id', orderId);
    fetchOrders();
  };

  const filteredOrdersByDate = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfLast7Days = startOfToday - 6 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      const orderTime = new Date(o.created_at).getTime();
      if (dateFilter === 'today') return orderTime >= startOfToday;
      if (dateFilter === 'yesterday') return orderTime >= startOfYesterday && orderTime < startOfToday;
      if (dateFilter === 'week') return orderTime >= startOfLast7Days;
      return true;
    });
  }, [orders, dateFilter]);

  const totalSales = filteredOrdersByDate.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const upiSales = filteredOrdersByDate.filter(o => o.payment_mode === 'upi').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const cashSales = filteredOrdersByDate.filter(o => o.payment_mode === 'cash').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const activeOrdersCount = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;

  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://qr-order-system-tawny.vercel.app';
  const qrCodeUrl = `${appBaseUrl}?table=${selectedTable}`;

  // EXPORT ORDERS TO CSV/EXCEL
  const handleExportCSV = () => {
    if (filteredOrdersByDate.length === 0) {
      alert('Is time range mein koi orders nahi hain export karne ke liye.');
      return;
    }

    const headers = [
      'Order ID',
      'Date',
      'Time',
      'Table No',
      'Customer',
      'Items Ordered',
      'Payment Mode',
      'Payment Status',
      'Chef Instructions',
      'Total Amount (INR)'
    ];

    const rows = filteredOrdersByDate.map((o) => {
      const orderDate = new Date(o.created_at);
      const formattedDate = orderDate.toLocaleDateString();
      const formattedTime = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const itemsString = o.order_items
        ?.map((it) => `${it.name || it.menu_items?.name || 'Item'} (x${it.quantity})`)
        .join(' | ') || 'N/A';

      return [
        `"${o.id.slice(0, 8)}"`,
        `"${formattedDate}"`,
        `"${formattedTime}"`,
        `"Table ${o.table_number || o.table_no || 1}"`,
        `"${o.customer_name || 'Guest'}"`,
        `"${itemsString.replace(/"/g, '""')}"`,
        `"${o.payment_mode?.toUpperCase() || 'CASH'}"`,
        `"${o.payment_status?.toUpperCase() || 'PENDING'}"`,
        `"${(o.special_instructions || '').replace(/"/g, '""')}"`,
        o.total_amount
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `QuickServe_Orders_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintStandee = () => {
    const printContent = document.getElementById('printable-qr-standee');
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=600,height=750');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Table ${selectedTable} QR Standee</title>
          <style>
            @page { size: portrait; margin: 0; }
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff; }
            .standee { width: 320px; padding: 30px 20px; border: 2px solid #000; border-radius: 28px; text-align: center; }
            .title { font-size: 20px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
            .subtitle { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
            .badge { margin-top: 24px; background: #000; color: #fff; border-radius: 14px; padding: 10px 0; font-size: 15px; font-weight: 900; letter-spacing: 2px; }
            .footer { margin-top: 10px; font-size: 10px; color: #888; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="standee">
            <div class="title">${cafe?.name || 'QuickServe Cafe'}</div>
            <div class="subtitle">Scan to Order & Pay</div>
            <div style="display:inline-block; padding:12px; border:1px solid #ddd; border-radius:20px;">
              ${printContent.innerHTML}
            </div>
            <div class="badge">TABLE #${selectedTable}</div>
            <div class="footer">No App Required • Instant Service</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredMenuItems = menuItems
    .filter(i => i.is_available)
    .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(i => {
      if (filterType === 'veg') return i.is_veg;
      if (filterType === 'non-veg') return !i.is_veg;
      return true;
    });

  const myOrders = orders.filter(o => customerOrderIds.includes(o.id));
  const latestMyOrder = myOrders[0];

  const themeClasses = {
    appBg: isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900',
    headerBg: isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200',
    cardBg: isDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    panelBg: isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    modalBg: isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200',
    inputBg: isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400',
    subText: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    borderLight: isDarkMode ? 'border-slate-800' : 'border-slate-200'
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themeClasses.appBg}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${themeClasses.appBg}`}>
      <header className={`border-b sticky top-0 z-50 px-3 py-2.5 sm:px-4 sm:py-3 transition-colors ${themeClasses.headerBg}`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" />
            <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              {cafe?.name || 'QuickServe Cafe'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isCustomerViewOnly && (
              <div className={`flex items-center p-1 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'menu' ? 'bg-orange-500 text-white' : `${themeClasses.subText} hover:text-orange-500`
                  }`}
                >
                  Menu
                </button>
                <button
                  onClick={() => { setActiveTab('kitchen'); setPinError(false); setPinInput(''); }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'kitchen' ? 'bg-orange-500 text-white' : `${themeClasses.subText} hover:text-orange-500`
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" /> Kitchen ({activeOrdersCount + serviceRequests.length})
                </button>
                <button
                  onClick={() => { setActiveTab('admin'); setPinError(false); setPinInput(''); }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'admin' ? 'bg-orange-500 text-white' : `${themeClasses.subText} hover:text-orange-500`
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" /> Admin
                </button>
              </div>
            )}

            {isCustomerViewOnly && (
              <div className="flex items-center gap-1.5">
                {myOrders.length > 0 && (
                  <button
                    onClick={() => setShowMyOrdersModal(true)}
                    className="text-[11px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 transition"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Orders ({myOrders.length})</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAssistanceModal(true)}
                  className={`text-[11px] border px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
                    isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <Bell className="w-3 h-3 text-orange-500 animate-bounce" /> Call
                </button>
                <span className="text-[11px] bg-orange-500/10 text-orange-500 border border-orange-500/20 px-2.5 py-1 rounded-full font-bold">
                  #{selectedTable}
                </span>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-xl border transition shrink-0 ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
              }`}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'menu' && (
          <div className="max-w-md mx-auto space-y-4 pb-28">
            {latestMyOrder && latestMyOrder.status !== 'completed' && latestMyOrder.status !== 'cancelled' && (
              <div 
                onClick={() => setShowMyOrdersModal(true)}
                className={`border p-4 rounded-2xl cursor-pointer transition shadow-lg ${
                  isDarkMode 
                    ? 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50' 
                    : 'bg-orange-50 border-orange-200 hover:border-orange-300'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 animate-pulse text-orange-500" />
                    Live Order Tracker
                  </span>
                  <span className={`text-[10px] underline ${themeClasses.subText}`}>View Details</span>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                  <div className={`p-1.5 rounded-lg text-[10px] font-semibold border ${
                    latestMyOrder.status === 'pending'
                      ? 'bg-orange-500 text-white border-orange-400'
                      : isDarkMode ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    1. Received 🕒
                  </div>
                  <div className={`p-1.5 rounded-lg text-[10px] font-semibold border ${
                    latestMyOrder.status === 'preparing'
                      ? 'bg-orange-500 text-white border-orange-400 animate-pulse'
                      : latestMyOrder.status === 'pending'
                      ? isDarkMode ? 'bg-slate-900 text-slate-500 border-slate-800' : 'bg-slate-100 text-slate-400 border-slate-200'
                      : isDarkMode ? 'bg-slate-800/80 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    2. Cooking 🍳
                  </div>
                  <div className={`p-1.5 rounded-lg text-[10px] font-semibold border ${
                    isDarkMode ? 'bg-slate-900 text-slate-500 border-slate-800' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    3. Ready 🍽️
                  </div>
                </div>
              </div>
            )}

            {orderSuccess ? (
              <div className={`border rounded-2xl p-8 text-center space-y-4 ${themeClasses.panelBg}`}>
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                <h2 className="text-xl font-bold">Order Placed!</h2>
                <p className={`text-xs ${themeClasses.subText}`}>
                  Kitchen mein order receive ho chuka hai for Table <span className="text-orange-500 font-bold">#{selectedTable}</span>.
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={() => { setOrderSuccess(false); setShowMyOrdersModal(true); }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" /> Track Live Order
                  </button>
                  <button
                    onClick={() => setOrderSuccess(false)}
                    className={`px-4 py-2 border rounded-xl text-xs font-semibold ${
                      isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    View Menu
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={`border p-4 rounded-2xl space-y-3 ${themeClasses.panelBg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-sm">Digital Menu</h2>
                      <p className={`text-xs ${themeClasses.subText}`}>Ordering for Table #{selectedTable}</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/20">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items</span>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${themeClasses.subText}`} />
                    <input
                      type="text"
                      placeholder="Search dish (e.g. Burger, Chai)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${themeClasses.inputBg}`}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        filterType === 'all' 
                          ? 'bg-orange-500 text-white' 
                          : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      All ({menuItems.filter(i => i.is_available).length})
                    </button>
                    <button
                      onClick={() => setFilterType('veg')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        filterType === 'veg' 
                          ? 'bg-emerald-500 text-white' 
                          : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Veg
                    </button>
                    <button
                      onClick={() => setFilterType('non-veg')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        filterType === 'non-veg' 
                          ? 'bg-red-500 text-white' 
                          : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Non-Veg
                    </button>
                  </div>
                </div>

                {/* FOOD ITEMS LIST (ZOMATO STYLE WITH IMAGES) */}
                <div className="space-y-3">
                  {filteredMenuItems.length === 0 ? (
                    <div className={`text-center py-12 text-xs ${themeClasses.subText}`}>
                      No matching dishes found.
                    </div>
                  ) : (
                    filteredMenuItems.map((item) => {
                      const inCart = cart.find((c) => c.item.id === item.id);
                      const displayImage = item.image_url || getFallbackImage(item.name);

                      return (
                        <div
                          key={item.id}
                          className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition ${themeClasses.cardBg}`}
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <h3 className="font-bold text-sm truncate">{item.name}</h3>
                            </div>
                            <div className="text-sm font-black text-orange-500">₹{item.price}</div>
                            {item.description && (
                              <p className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${themeClasses.subText}`}>
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="relative shrink-0 flex flex-col items-center">
                            <img
                              src={displayImage}
                              alt={item.name}
                              className="w-24 h-24 sm:w-28 sm:h-24 object-cover rounded-2xl shadow-sm border border-slate-700/20"
                              loading="lazy"
                            />

                            <div className="absolute -bottom-2">
                              {inCart ? (
                                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-white rounded-xl px-2 py-1 shadow-lg">
                                  <button onClick={() => removeFromCart(item.id)} className="p-0.5 hover:text-orange-400">
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs font-bold w-4 text-center">{inCart.quantity}</span>
                                  <button onClick={() => addToCart(item)} className="p-0.5 text-orange-500">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addToCart(item)}
                                  className="px-4 py-1 bg-white hover:bg-orange-500 text-slate-900 hover:text-white border border-slate-200 shadow-md font-black text-xs rounded-xl uppercase tracking-wider transition"
                                >
                                  ADD +
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {cart.length > 0 && (
                  <div className={`fixed bottom-0 left-0 right-0 p-4 backdrop-blur border-t z-40 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xl'}`}>
                    <div className="max-w-md mx-auto">
                      <button
                        onClick={() => setShowCheckoutModal(true)}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-between px-5 text-sm"
                      >
                        <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items | ₹{totalAmount}</span>
                        <span>Proceed to Pay →</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {showMyOrdersModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className={`border w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto ${themeClasses.modalBg}`}>
                  <div className={`flex justify-between items-center border-b pb-3 ${themeClasses.borderLight}`}>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <History className="w-4 h-4 text-orange-500" />
                      Your Orders (Table #{selectedTable})
                    </h3>
                    <button onClick={() => setShowMyOrdersModal(false)} className={themeClasses.subText}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {myOrders.length === 0 ? (
                    <div className={`text-center py-12 text-xs ${themeClasses.subText}`}>
                      No orders placed in this session yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myOrders.map((order, idx) => (
                        <div key={order.id} className={`border rounded-xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-bold">
                                Order #{myOrders.length - idx}
                              </span>
                              <span className={`text-[10px] block ${themeClasses.subText}`}>
                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                              order.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                : order.status === 'preparing'
                                ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 animate-pulse'
                                : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}>
                              {order.status === 'completed' ? 'Served / Done' : order.status === 'preparing' ? 'Cooking in Kitchen' : 'Order Received'}
                            </span>
                          </div>

                          <div className={`divide-y text-xs ${isDarkMode ? 'divide-slate-800/70 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                            {order.order_items?.map((item) => (
                              <div key={item.id} className="py-1.5 flex justify-between">
                                <span>{item.name || item.menu_items?.name || 'Dish'}</span>
                                <span className={`font-semibold ${themeClasses.subText}`}>x{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {order.special_instructions && (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-500 flex items-start gap-1.5">
                              <MessageSquareQuote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>Note: {order.special_instructions}</span>
                            </div>
                          )}

                          <div className={`flex justify-between items-center pt-2 border-t text-xs ${themeClasses.borderLight}`}>
                            <span className="font-bold">Total: ₹{order.total_amount}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              order.payment_status === 'paid'
                                ? 'text-emerald-500 bg-emerald-500/10'
                                : 'text-amber-500 bg-amber-500/10'
                            }`}>
                              {order.payment_status === 'paid' ? 'PAID (UPI)' : 'PAY AT COUNTER'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showAssistanceModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className={`border w-full max-w-xs rounded-2xl p-5 space-y-4 text-center ${themeClasses.modalBg}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm">Table #{selectedTable} Assistance</h3>
                    <button onClick={() => setShowAssistanceModal(false)} className={themeClasses.subText}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {assistanceSent ? (
                    <div className="py-6 space-y-2">
                      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                      <p className="text-sm font-bold">Staff Alerted!</p>
                      <p className={`text-xs ${themeClasses.subText}`}>Someone is coming to Table #{selectedTable}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      <button
                        onClick={() => handleSendAssistance('Call Waiter')}
                        className={`p-3 border rounded-xl flex items-center gap-3 text-xs font-semibold transition ${
                          isDarkMode ? 'bg-slate-800 hover:bg-orange-500/20 border-slate-700' : 'bg-slate-100 hover:bg-orange-50 border-slate-300'
                        }`}
                      >
                        <UserCheck className="w-4 h-4 text-orange-500" />
                        <span>Call Waiter to Table</span>
                      </button>
                      <button
                        onClick={() => handleSendAssistance('Bring Drinking Water')}
                        className={`p-3 border rounded-xl flex items-center gap-3 text-xs font-semibold transition ${
                          isDarkMode ? 'bg-slate-800 hover:bg-blue-500/20 border-slate-700' : 'bg-slate-100 hover:bg-blue-50 border-slate-300'
                        }`}
                      >
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span>Need Drinking Water</span>
                      </button>
                      <button
                        onClick={() => handleSendAssistance('Bring Table Bill')}
                        className={`p-3 border rounded-xl flex items-center gap-3 text-xs font-semibold transition ${
                          isDarkMode ? 'bg-slate-800 hover:bg-emerald-500/20 border-slate-700' : 'bg-slate-100 hover:bg-emerald-50 border-slate-300'
                        }`}
                      >
                        <Receipt className="w-4 h-4 text-emerald-500" />
                        <span>Request Final Bill</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {showCheckoutModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className={`border w-full max-w-sm rounded-2xl p-5 space-y-4 ${themeClasses.modalBg}`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm">Choose Payment Mode</h3>
                    <button onClick={() => setShowCheckoutModal(false)} className={themeClasses.subText}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Your Name (Optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs ${themeClasses.inputBg}`}
                  />

                  <div className="space-y-1">
                    <label className={`text-[11px] font-semibold flex items-center gap-1 ${themeClasses.subText}`}>
                      <MessageSquareQuote className="w-3.5 h-3.5 text-orange-500" /> Special Cooking Instructions
                    </label>
                    <textarea
                      placeholder="e.g. Less spicy, extra cheese, no sugar, make it quick..."
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs h-16 resize-none ${themeClasses.inputBg}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMode('cash')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition ${
                        selectedPaymentMode === 'cash'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                          : isDarkMode ? 'border-slate-800 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                      <span>Pay at Counter</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMode('upi')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition ${
                        selectedPaymentMode === 'upi'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                          : isDarkMode ? 'border-slate-800 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span>Pay via UPI</span>
                    </button>
                  </div>

                  {selectedPaymentMode === 'upi' && (
                    <div className={`p-4 rounded-xl border text-center space-y-3 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={`text-xs ${themeClasses.subText}`}>Scan & Pay ₹{totalAmount}</p>
                      <div className="p-3 bg-white rounded-xl inline-block shadow">
                        <QRCodeSVG value={upiPaymentUrl} size={130} />
                      </div>
                      <p className="text-[11px] font-mono text-orange-500">{cafeUPI}</p>
                    </div>
                  )}

                  <button
                    onClick={handleConfirmOrder}
                    disabled={submittingOrder}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition"
                  >
                    {submittingOrder ? 'Placing Order...' : `Confirm Order (₹${totalAmount})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODERN KITCHEN DISPLAY SYSTEM (KDS) */}
        {activeTab === 'kitchen' && (
          <div>
            {!isStaffAuthed ? (
              <div className={`max-w-xs mx-auto mt-12 border rounded-2xl p-6 text-center space-y-4 ${themeClasses.panelBg}`}>
                <ChefHat className="w-12 h-12 text-orange-500 mx-auto" />
                <h2 className="text-base font-bold">Kitchen Staff Access</h2>
                <p className={`text-xs ${themeClasses.subText}`}>Enter 4-digit staff PIN (1234)</p>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN"
                  className={`w-full text-center text-xl tracking-widest py-2 border rounded-xl ${themeClasses.inputBg}`}
                />
                {pinError && <p className="text-xs text-red-500 font-semibold">Incorrect PIN</p>}
                <button
                  onClick={handleVerifyPin}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold"
                >
                  Unlock Display
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`flex flex-wrap justify-between items-center gap-3 border-b pb-4 ${themeClasses.borderLight}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <ChefHat className="text-orange-500 w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-black text-lg tracking-tight">KITCHEN KDS BOARD</h2>
                      <span className="text-xs text-orange-500 font-semibold uppercase tracking-wider">
                        {activeOrdersCount} Active Order Tickets
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { playBeep(880); setAudioEnabled(true); }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition ${
                        audioEnabled
                          ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10 shadow-sm'
                          : isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      {audioEnabled ? 'SOUND LIVE' : 'ENABLE SOUND'}
                    </button>
                    <button
                      onClick={() => handleLogout('staff')}
                      className={`p-2 rounded-xl border transition ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {serviceRequests.length > 0 && (
                  <div className="bg-gradient-to-r from-orange-500/15 via-red-500/10 to-orange-500/15 border border-orange-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                    <div className="flex items-center gap-2 text-orange-500 font-black text-xs uppercase tracking-wider">
                      <Bell className="w-4 h-4 animate-bounce" /> Service Assistance ({serviceRequests.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {serviceRequests.map((req) => (
                        <div key={req.id} className={`border p-3.5 rounded-xl flex items-center justify-between ${themeClasses.cardBg}`}>
                          <div>
                            <span className="text-base font-black text-white block">TABLE #{req.table_number}</span>
                            <span className="text-xs text-orange-400 font-semibold">{req.request_type}</span>
                          </div>
                          <button
                            onClick={() => resolveServiceRequest(req.id)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-black text-white shadow"
                          >
                            SERVED ✓
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {orders.filter(o => o.status !== 'completed').length === 0 ? (
                    <div className={`col-span-full text-center py-20 rounded-3xl border border-dashed ${themeClasses.borderLight}`}>
                      <ChefHat className={`w-12 h-12 mx-auto mb-3 opacity-30 ${themeClasses.subText}`} />
                      <p className="text-base font-bold">Kitchen is all clear!</p>
                      <p className={`text-xs ${themeClasses.subText}`}>New orders will flash here with sound chime automatically.</p>
                    </div>
                  ) : (
                    orders
                      .filter(o => o.status !== 'completed')
                      .map((order) => {
                        const timeInfo = getTimeAgo(order.created_at);

                        return (
                          <div
                            key={order.id}
                            className={`border-2 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-md transition-all ${
                              order.status === 'pending'
                                ? timeInfo.isDelayed
                                  ? 'bg-red-500/10 border-red-500 animate-pulse'
                                  : 'bg-orange-500/10 border-orange-500/50'
                                : isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start border-b border-slate-700/30 pb-3">
                                <div>
                                  <span className="text-2xl font-black tracking-tight text-orange-500">
                                    TABLE #{order.table_number || order.table_no || 1}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-xs font-semibold ${themeClasses.subText}`}>
                                      {order.customer_name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      #{order.id.slice(0, 5)}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right flex flex-col items-end gap-1">
                                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono ${
                                    timeInfo.isDelayed
                                      ? 'bg-red-500 text-white'
                                      : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                    {timeInfo.isDelayed && <AlertTriangle className="w-3 h-3" />}
                                    {timeInfo.label}
                                  </span>

                                  <button
                                    onClick={() => togglePaymentStatus(order.id, order.payment_status)}
                                    className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                      order.payment_status === 'paid'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {order.payment_status === 'paid' ? 'PAID' : 'CASH COUNTER'}
                                  </button>
                                </div>
                              </div>

                              <div className="py-3 space-y-2 divide-y divide-slate-800/40">
                                {order.order_items?.map((item) => (
                                  <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between">
                                    <span className="text-sm font-bold tracking-tight">
                                      {item.name || item.menu_items?.name || 'Dish Item'}
                                    </span>
                                    <span className="text-base font-black px-2.5 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {order.special_instructions && (
                                <div className="mt-2 p-3 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl text-xs font-semibold text-amber-400 flex items-start gap-2">
                                  <MessageSquareQuote className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                                  <div>
                                    <span className="font-black block uppercase text-[10px] tracking-wider">CHEF NOTE:</span>
                                    <span className="text-white">{order.special_instructions}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-3 border-t border-slate-700/40">
                              {order.status === 'pending' ? (
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'preparing')}
                                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-xl text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98"
                                >
                                  <Flame className="w-4 h-4" /> START COOKING
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'completed')}
                                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98"
                                >
                                  <CheckCircle className="w-4 h-4" /> READY / SERVED
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div>
            {!isAdminAuthed ? (
              <div className={`max-w-xs mx-auto mt-12 border rounded-2xl p-6 text-center space-y-4 ${themeClasses.panelBg}`}>
                <Lock className="w-12 h-12 text-orange-500 mx-auto" />
                <h2 className="text-base font-bold">Owner Admin Panel</h2>
                <p className={`text-xs ${themeClasses.subText}`}>Enter Admin PIN (9999)</p>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN"
                  className={`w-full text-center text-xl tracking-widest py-2 border rounded-xl ${themeClasses.inputBg}`}
                />
                {pinError && <p className="text-xs text-red-500 font-semibold">Incorrect PIN</p>}
                <button
                  onClick={handleVerifyPin}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold"
                >
                  Enter Admin
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`flex flex-wrap justify-between items-center gap-3 border-b pb-3 ${themeClasses.borderLight}`}>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="font-bold text-sm">Owner Dashboard & Metrics</h2>

                    <div className={`flex items-center p-0.5 rounded-xl border text-xs font-semibold ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                      <button
                        onClick={() => setDateFilter('today')}
                        className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'today' ? 'bg-orange-500 text-white' : themeClasses.subText}`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setDateFilter('yesterday')}
                        className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'yesterday' ? 'bg-orange-500 text-white' : themeClasses.subText}`}
                      >
                        Yesterday
                      </button>
                      <button
                        onClick={() => setDateFilter('week')}
                        className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'week' ? 'bg-orange-500 text-white' : themeClasses.subText}`}
                      >
                        Last 7 Days
                      </button>
                      <button
                        onClick={() => setDateFilter('all')}
                        className={`px-2.5 py-1 rounded-lg transition ${dateFilter === 'all' ? 'bg-orange-500 text-white' : themeClasses.subText}`}
                      >
                        All Time
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLogout('admin')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                      isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Lock Admin
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={`border p-4 rounded-2xl ${themeClasses.panelBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${themeClasses.subText}`}>Gross Revenue</span>
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-2xl font-black mt-1 block">₹{totalSales}</span>
                    <span className="text-[10px] text-emerald-500 font-mono mt-0.5 block">{filteredOrdersByDate.length} orders in range</span>
                  </div>

                  <div className={`border p-4 rounded-2xl ${themeClasses.panelBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${themeClasses.subText}`}>UPI / Online</span>
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-2xl font-black text-blue-500 mt-1 block">₹{upiSales}</span>
                    <span className={`text-[10px] font-mono mt-0.5 block ${themeClasses.subText}`}>Direct bank QR</span>
                  </div>

                  <div className={`border p-4 rounded-2xl ${themeClasses.panelBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${themeClasses.subText}`}>Counter Cash</span>
                      <Banknote className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-2xl font-black text-amber-500 mt-1 block">₹{cashSales}</span>
                    <span className={`text-[10px] font-mono mt-0.5 block ${themeClasses.subText}`}>Offline collection</span>
                  </div>

                  <div className={`border p-4 rounded-2xl ${themeClasses.panelBg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${themeClasses.subText}`}>Live Requests</span>
                      <Bell className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="text-2xl font-black text-orange-500 mt-1 block">{serviceRequests.length}</span>
                    <span className={`text-[10px] font-mono mt-0.5 block ${themeClasses.subText}`}>Pending assistance</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Top Selling Items */}
                  <div className={`border p-5 rounded-2xl space-y-3 ${themeClasses.panelBg}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" /> Top Selling Dishes
                      </h3>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${themeClasses.subText}`}>
                        {dateFilter.toUpperCase()}
                      </span>
                    </div>

                    <div className={`divide-y text-xs ${isDarkMode ? 'divide-slate-800/40' : 'divide-slate-200'}`}>
                      {(() => {
                        const itemCounts: { [name: string]: { qty: number; revenue: number } } = {};
                        filteredOrdersByDate.forEach((o) => {
                          o.order_items?.forEach((it) => {
                            const itemName = it.name || it.menu_items?.name || 'Unknown Item';
                            if (!itemCounts[itemName]) itemCounts[itemName] = { qty: 0, revenue: 0 };
                            itemCounts[itemName].qty += it.quantity;
                            itemCounts[itemName].revenue += (it.price || it.price_at_order || 0) * it.quantity;
                          });
                        });

                        const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1].qty - a[1].qty);

                        if (sortedItems.length === 0) {
                          return (
                            <div className={`py-6 text-center text-xs ${themeClasses.subText}`}>
                              No dish sales in this range.
                            </div>
                          );
                        }

                        return sortedItems.slice(0, 5).map(([name, data], idx) => (
                          <div key={name} className="py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-[10px]">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold">{name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold block">{data.qty} sold</span>
                              <span className={`text-[10px] ${themeClasses.subText}`}>₹{data.revenue}</span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Orders Audit Log + Export CSV Button */}
                  <div className={`lg:col-span-2 border p-5 rounded-2xl space-y-3 ${themeClasses.panelBg}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-orange-500" /> Orders Audit Log ({filteredOrdersByDate.length})
                        </h3>
                        <span className={`text-[10px] ${themeClasses.subText}`}>
                          Avg Value: ₹{filteredOrdersByDate.length > 0 ? Math.round(totalSales / filteredOrdersByDate.length) : 0} / order
                        </span>
                      </div>

                      <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" /> Export Excel (CSV)
                      </button>
                    </div>

                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className={`border-b ${themeClasses.borderLight} ${themeClasses.subText}`}>
                            <th className="pb-2 font-semibold">Time</th>
                            <th className="pb-2 font-semibold">Table</th>
                            <th className="pb-2 font-semibold">Customer</th>
                            <th className="pb-2 font-semibold">Payment</th>
                            <th className="pb-2 font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/40' : 'divide-slate-200'}`}>
                          {filteredOrdersByDate.length === 0 ? (
                            <tr>
                              <td colSpan={5} className={`py-6 text-center text-xs ${themeClasses.subText}`}>
                                No orders recorded for this time range.
                              </td>
                            </tr>
                          ) : (
                            filteredOrdersByDate.map((ord) => (
                              <tr key={ord.id} className="hover:bg-orange-500/5 transition">
                                <td className="py-2 text-[11px] font-mono">
                                  {new Date(ord.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                  {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2 font-bold text-orange-500">#{ord.table_number || 1}</td>
                                <td className="py-2">{ord.customer_name || 'Guest'}</td>
                                <td className="py-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                                    ord.payment_mode === 'upi' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                                  }`}>
                                    {ord.payment_mode?.toUpperCase() || 'CASH'}
                                  </span>
                                </td>
                                <td className="py-2 font-bold text-right">₹{ord.total_amount}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleAddItem} className={`border p-5 rounded-2xl space-y-4 ${themeClasses.panelBg}`}>
                      <h2 className="font-bold text-sm">Add New Dish</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Dish Name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`border rounded-xl px-3 py-2 text-sm ${themeClasses.inputBg}`}
                          required
                        />
                        <input
                          type="number"
                          placeholder="Price (₹)"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className={`border rounded-xl px-3 py-2 text-sm ${themeClasses.inputBg}`}
                          required
                        />
                      </div>

                      <div className="relative">
                        <ImageIcon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${themeClasses.subText}`} />
                        <input
                          type="url"
                          placeholder="Dish Photo Link / URL (Optional - auto photo if empty)"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs ${themeClasses.inputBg}`}
                        />
                      </div>

                      <textarea
                        placeholder="Short Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm h-16 ${themeClasses.inputBg}`}
                      />

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isVeg}
                            onChange={(e) => setIsVeg(e.target.checked)}
                            className="rounded text-orange-500"
                          />
                          Vegetarian
                        </label>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Add Item
                        </button>
                      </div>
                    </form>

                    <div className="space-y-3">
                      <h2 className="font-bold text-sm">Menu Items ({menuItems.length})</h2>
                      {menuItems.map((item) => (
                        <div
                          key={item.id}
                          className={`border p-3.5 rounded-xl flex items-center justify-between gap-4 ${themeClasses.cardBg}`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={item.image_url || getFallbackImage(item.name)}
                              alt={item.name}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-700/20"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="font-semibold text-sm">{item.name}</span>
                                <span className="text-orange-500 text-xs font-bold">₹{item.price}</span>
                              </div>
                              {item.description && <p className={`text-xs mt-0.5 line-clamp-1 ${themeClasses.subText}`}>{item.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleAvailability(item)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                                item.is_available
                                  ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                                  : isDarkMode ? 'border-slate-700 text-slate-500 bg-slate-800' : 'border-slate-300 text-slate-400 bg-slate-100'
                              }`}
                            >
                              {item.is_available ? 'Available' : 'Sold Out'}
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className={`p-1.5 rounded-lg transition ${
                                isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-slate-500 hover:text-red-500 hover:bg-slate-200'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`border p-6 rounded-2xl flex flex-col items-center text-center space-y-4 h-fit ${themeClasses.panelBg}`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <QrCode className="text-orange-500 w-4 h-4" /> Table QR Standee
                    </div>
                    
                    <div className="w-full">
                      <label className={`text-xs block mb-1 ${themeClasses.subText}`}>Select Table Number</label>
                      <select
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-sm ${themeClasses.inputBg}`}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <option key={n} value={n}>Table #{n}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full flex flex-col items-center justify-center p-5 bg-white rounded-2xl text-black border border-slate-200 shadow-xl">
                      <span className="text-base font-black tracking-tight text-slate-900 uppercase block mb-0.5">
                        {cafe?.name || 'QuickServe Cafe'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase block mb-3">
                        Scan to Order & Pay
                      </span>

                      <div id="printable-qr-standee" className="p-2 bg-white rounded-xl shadow-sm inline-block">
                        <QRCodeSVG value={qrCodeUrl} size={160} level="H" />
                      </div>

                      <div className="mt-4 w-full bg-slate-950 text-white rounded-xl py-1.5 px-3">
                        <span className="text-xs font-black tracking-widest uppercase block">
                          TABLE #{selectedTable}
                        </span>
                      </div>
                    </div>

                    <p className={`text-[11px] font-mono break-all ${themeClasses.subText}`}>{qrCodeUrl}</p>

                    <button
                      onClick={handlePrintStandee}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg"
                    >
                      <Printer className="w-4 h-4" /> Print Acrylic Standee QR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}