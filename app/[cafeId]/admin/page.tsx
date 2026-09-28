'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OrderItem {
  id: string;
  quantity: number;
  price?: number;
  menu_items: {
    name: string;
  };
}

interface Order {
  id: string;
  table_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  status: string;
  created_at: string;
  notes: string | null;
  payment_mode?: string;
  payment_status?: string;
  order_items: OrderItem[];
}

interface ServiceRequest {
  id: string;
  table_number: number;
  request_type: string;
  status: string;
  created_at: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
}

interface Cafe {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  admin_pin?: string;
  kitchen_pin?: string;
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.error('Audio chime play error:', e);
  }
}

export default function MultiTenantAdminDashboard() {
  const params = useParams();
  const cafeSlug = params?.cafeId as string;

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [activeTab, setActiveTab] = useState<'admin' | 'kitchen' | 'qrcodes'>('admin');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | '7days' | 'all'>('today');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Authentication Lock States
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [isKitchenUnlocked, setIsKitchenUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Dish Form State
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [dishImg, setDishImg] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [addingDish, setAddingDish] = useState(false);

  // Dish Edit Modal State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // QR Code Generator State
  const [selectedTable, setSelectedTable] = useState<string>('1');
  const [customTableCount, setCustomTableCount] = useState<number>(10);
  const printRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (!cafeSlug) return;
    try {
      const { data: cafeData, error: cafeErr } = await supabase
        .from('cafes')
        .select('*')
        .eq('slug', cafeSlug)
        .maybeSingle();

      if (cafeErr || !cafeData) {
        setLoading(false);
        return;
      }
      setCafe(cafeData);

      const storedAdminSession = localStorage.getItem(`qs_admin_session_${cafeData.id}`);
      const storedKitchenSession = localStorage.getItem(`qs_kitchen_session_${cafeData.id}`);
      
      if (storedAdminSession === 'unlocked') setIsAdminUnlocked(true);
      if (storedKitchenSession === 'unlocked') setIsKitchenUnlocked(true);

      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id, table_number, customer_name, customer_phone, total_amount, status, created_at, notes, payment_mode, payment_status,
          order_items (
            id, quantity, price,
            menu_items ( name )
          )
        `)
        .eq('cafe_id', cafeData.id)
        .order('created_at', { ascending: false });

      if (ordersErr) console.error('Orders Error:', ordersErr);
      else setOrders((ordersData as any) || []);

      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('cafe_id', cafeData.id)
        .order('created_at', { ascending: false });

      if (menuData) setMenuItems(menuData);

      const { data: reqData } = await supabase
        .from('service_requests')
        .select('*')
        .eq('cafe_id', cafeData.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (reqData) setServiceRequests(reqData);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!cafeSlug) return;

    let ordersChannel: ReturnType<typeof supabase.channel> | null = null;
    let serviceChannel: ReturnType<typeof supabase.channel> | null = null;

    const initRealtime = async () => {
      const { data: cafeData } = await supabase
        .from('cafes')
        .select('id')
        .eq('slug', cafeSlug)
        .maybeSingle();

      if (cafeData?.id) {
        ordersChannel = supabase.channel(`realtime_orders_${cafeData.id}_${Date.now()}`);

        ordersChannel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'orders',
              filter: `cafe_id=eq.${cafeData.id}`
            },
            () => {
              playNotificationSound();
              loadData();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'orders',
              filter: `cafe_id=eq.${cafeData.id}`
            },
            () => {
              loadData();
            }
          )
          .subscribe();

        serviceChannel = supabase.channel(`realtime_service_${cafeData.id}_${Date.now()}`);

        serviceChannel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'service_requests',
              filter: `cafe_id=eq.${cafeData.id}`
            },
            () => {
              playNotificationSound();
              loadData();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_requests',
              filter: `cafe_id=eq.${cafeData.id}`
            },
            () => {
              loadData();
            }
          )
          .subscribe();
      }
    };

    initRealtime();

    return () => {
      if (ordersChannel) supabase.removeChannel(ordersChannel);
      if (serviceChannel) supabase.removeChannel(serviceChannel);
    };
  }, [cafeSlug]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (!cafe) return;

    const expectedAdminPin = cafe.admin_pin || '1234';
    const expectedKitchenPin = cafe.kitchen_pin || '5678';

    if (activeTab === 'admin' || activeTab === 'qrcodes') {
      if (pinInput === expectedAdminPin) {
        setIsAdminUnlocked(true);
        localStorage.setItem(`qs_admin_session_${cafe.id}`, 'unlocked');
        setPinInput('');
      } else {
        setPinError('Invalid Admin Passcode! Please enter the correct PIN.');
      }
    } else if (activeTab === 'kitchen') {
      if (pinInput === expectedKitchenPin || pinInput === expectedAdminPin) {
        setIsKitchenUnlocked(true);
        localStorage.setItem(`qs_kitchen_session_${cafe.id}`, 'unlocked');
        setPinInput('');
      } else {
        setPinError('Invalid Kitchen Passcode! Please enter the correct PIN.');
      }
    }
  };

  const handleLockSession = () => {
    if (!cafe) return;
    if (activeTab === 'kitchen') {
      setIsKitchenUnlocked(false);
      localStorage.removeItem(`qs_kitchen_session_${cafe.id}`);
    } else {
      setIsAdminUnlocked(false);
      localStorage.removeItem(`qs_admin_session_${cafe.id}`);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    loadData();
  };

  const resolveServiceRequest = async (reqId: string) => {
    await supabase.from('service_requests').update({ status: 'resolved' }).eq('id', reqId);
    loadData();
  };

  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafe || !dishName || !dishPrice) return;

    setAddingDish(true);
    try {
      const { error } = await supabase.from('menu_items').insert({
        cafe_id: cafe.id,
        name: dishName,
        price: parseFloat(dishPrice),
        description: dishDesc || null,
        image_url: dishImg || null,
        is_veg: isVeg,
        is_available: true,
      });

      if (error) throw error;
      alert('New dish added successfully!');
      setDishName('');
      setDishPrice('');
      setDishDesc('');
      setDishImg('');
      loadData();
    } catch (err: any) {
      alert('Failed to add dish: ' + err.message);
    } finally {
      setAddingDish(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);
    loadData();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu dish?')) return;
    await supabase.from('menu_items').delete().eq('id', itemId);
    loadData();
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({
          name: editingItem.name,
          price: editingItem.price,
          description: editingItem.description,
          image_url: editingItem.image_url,
          is_veg: editingItem.is_veg,
          is_available: editingItem.is_available,
        })
        .eq('id', editingItem.id);

      if (error) throw error;
      alert('Dish updated successfully!');
      setEditingItem(null);
      loadData();
    } catch (err: any) {
      alert('Failed to update dish: ' + err.message);
    }
  };

  const exportAuditCSV = () => {
    if (orders.length === 0) {
      alert('No order history available to export.');
      return;
    }

    const headers = ['Order ID', 'Table Number', 'Customer Name', 'Phone Number', 'Total Amount (INR)', 'Payment Mode', 'Status', 'Date & Time'];
    const rows = orders.map((o) => [
      o.id.slice(0, 8),
      o.table_number || 'N/A',
      `"${o.customer_name || 'Guest'}"`,
      `"${o.customer_phone || 'N/A'}"`,
      o.total_amount,
      o.payment_mode?.toUpperCase() || 'CASH',
      o.status,
      new Date(o.created_at).toLocaleString('en-IN')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${cafeSlug}_order_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintQR = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'width=800,height=900');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Print Table QR - ${cafe?.name}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #ffffff; color: #111; }
            .card { border: 3px solid #f97316; border-radius: 24px; padding: 32px; text-align: center; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            h1 { font-size: 24px; color: #f97316; margin: 0 0 4px 0; font-weight: 800; }
            p { font-size: 14px; color: #666; margin: 0 0 20px 0; }
            .qr-box { background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px dashed #cbd5e1; display: inline-block; margin-bottom: 20px; }
            .table-badge { background: #f97316; color: white; font-size: 20px; font-weight: 800; padding: 8px 20px; border-radius: 50px; display: inline-block; }
            .footer-text { font-size: 11px; color: #94a3b8; margin-top: 16px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${cafe?.name}</h1>
            <p>Scan to View Menu & Order</p>
            <div class="qr-box">
              ${printContent.innerHTML}
            </div>
            <div>
              <span class="table-badge">TABLE #${selectedTable}</span>
            </div>
            <p class="footer-text">Powered by QuickServe SaaS</p>
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-gray-400">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!cafe) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white flex items-center justify-center">
        <p className="text-red-500 font-bold">Cafe record not found!</p>
      </div>
    );
  }

  if (cafe.is_active === false) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-extrabold text-red-500 mb-2">{cafe.name} - Subscription Expired 🚫</h1>
        <p className="text-gray-400 text-sm max-w-md mb-6">
          The QuickServe SaaS active subscription for this café is currently paused or expired. For continuous services, please contact QuickServe Support.
        </p>
      </div>
    );
  }

  const isCurrentTabLocked =
    (activeTab === 'kitchen' && !isKitchenUnlocked) ||
    ((activeTab === 'admin' || activeTab === 'qrcodes') && !isAdminUnlocked);

  const filteredOrders = orders.filter((o) => {
    const orderDate = new Date(o.created_at);
    const now = new Date();
    if (timeFilter === 'today') return orderDate.toDateString() === now.toDateString();
    if (timeFilter === 'yesterday') {
      const yest = new Date();
      yest.setDate(now.getDate() - 1);
      return orderDate.toDateString() === yest.toDateString();
    }
    if (timeFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return orderDate >= sevenDaysAgo;
    }
    return true;
  });

  const grossRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const cookingOrders = orders.filter((o) => o.status === 'preparing');

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://quickserve-saas-v2.vercel.app';
  };

  const qrUrl = `${getBaseUrl()}/${cafe.slug}?table=${selectedTable}`;

  return (
    <div className="min-h-screen bg-[#0A0D14] text-gray-100 font-sans pb-12">
      <header className="bg-[#121824] border-b border-gray-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-orange-500">{cafe.name}</h1>
          <p className="text-xs text-gray-400">Master Owner Dashboard & Live KDS</p>
        </div>

        <div className="flex items-center gap-2 bg-[#161F2E] p-1.5 rounded-xl border border-gray-800">
          <button
            onClick={playNotificationSound}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-orange-400 text-xs font-bold rounded-lg border border-gray-700 transition"
            title="Test Kitchen Sound Chime"
          >
            🔔 Test Chime
          </button>

          <button
            onClick={() => { setActiveTab('admin'); setPinError(''); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            📊 Analytics {!isAdminUnlocked && '🔒'}
          </button>
          <button
            onClick={() => { setActiveTab('kitchen'); setPinError(''); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'kitchen' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            🍳 Kitchen ({pendingOrders.length + cookingOrders.length}) {!isKitchenUnlocked && '🔒'}
          </button>
          <button
            onClick={() => { setActiveTab('qrcodes'); setPinError(''); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'qrcodes' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            📱 Table QR Codes {!isAdminUnlocked && '🔒'}
          </button>

          {((activeTab === 'kitchen' && isKitchenUnlocked) ||
            ((activeTab === 'admin' || activeTab === 'qrcodes') && isAdminUnlocked)) && (
            <button
              onClick={handleLockSession}
              title="Lock Session"
              className="ml-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
            >
              🔒 Lock
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6">
        {/* Passcode Lock Screen Overlay */}
        {isCurrentTabLocked ? (
          <div className="max-w-md mx-auto my-12 bg-[#121824] border border-gray-800 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-14 h-14 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl mb-4 font-black">
              🔒
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1">
              {activeTab === 'kitchen' ? 'Kitchen Passcode Required' : 'Owner Admin Passcode Required'}
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              {activeTab === 'kitchen'
                ? 'Enter Kitchen PIN to manage live display orders.'
                : 'Enter Owner Admin PIN to view revenue analytics & QR generator.'}
            </p>

            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                placeholder="Enter PIN Passcode"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                required
                className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-3 text-center text-lg font-bold tracking-widest text-white focus:outline-none focus:border-orange-500"
              />

              {pinError && (
                <p className="text-xs text-red-400 font-semibold bg-red-500/10 p-2 rounded-lg">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg"
              >
                🔓 Unlock Access
              </button>
            </form>

            <p className="text-[10px] text-gray-500 mt-6">
              Default Admin PIN: <span className="font-mono text-gray-400">1234</span> | Kitchen PIN: <span className="font-mono text-gray-400">5678</span>
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'admin' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <h2 className="text-lg font-bold text-white">Owner Dashboard & Metrics</h2>
                  <div className="flex gap-2 bg-[#121824] p-1 rounded-xl border border-gray-800">
                    {(['today', 'yesterday', '7days', 'all'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTimeFilter(t)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                          timeFilter === t ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {t === '7days' ? 'Last 7 Days' : t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5">
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Gross Revenue</p>
                    <h3 className="text-3xl font-extrabold text-emerald-400">₹{grossRevenue}</h3>
                    <p className="text-xs text-gray-500 mt-2">{filteredOrders.length} orders in range</p>
                  </div>

                  <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5">
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Active Kitchen Orders</p>
                    <h3 className="text-3xl font-extrabold text-amber-400">{pendingOrders.length + cookingOrders.length}</h3>
                    <p className="text-xs text-gray-500 mt-2">{pendingOrders.length} Pending | {cookingOrders.length} Cooking</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* AUDIT LOG TABLE */}
                  <div className="lg:col-span-2 bg-[#121824] border border-gray-800 rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-bold text-white">Orders Audit Log ({filteredOrders.length})</h3>
                      <button
                        onClick={exportAuditCSV}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow flex items-center gap-1"
                      >
                        📥 Export Audit CSV
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-[#161F2E] text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="p-3">Time</th>
                            <th className="p-3">Table</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-gray-500">No orders found.</td>
                            </tr>
                          ) : (
                            filteredOrders.map((o) => (
                              <tr key={o.id} className="hover:bg-[#161F2E]/50">
                                <td className="p-3 font-mono">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="p-3 font-bold text-orange-400">#{o.table_number}</td>
                                <td className="p-3">{o.customer_name || 'Guest'}</td>
                                <td className="p-3 font-mono text-gray-400">{o.customer_phone || 'N/A'}</td>
                                <td className="p-3 font-bold text-white">₹{o.total_amount}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    o.status === 'completed' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                      : o.status === 'preparing'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                  }`}>
                                    {o.status === 'completed' ? 'Ready 🍽️' : o.status === 'preparing' ? 'Cooking 🍳' : 'Accepted 🕒'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ADD & MANAGE MENU DISHES */}
                  <div className="space-y-6">
                    {/* ADD NEW DISH FORM */}
                    <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5">
                      <h3 className="text-base font-bold text-white mb-4">+ Add New Menu Dish</h3>
                      <form onSubmit={handleAddDish} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Dish Name *"
                          required
                          value={dishName}
                          onChange={(e) => setDishName(e.target.value)}
                          className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                        />
                        <input
                          type="number"
                          placeholder="Price (₹) *"
                          required
                          value={dishPrice}
                          onChange={(e) => setDishPrice(e.target.value)}
                          className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Description (Optional)"
                          value={dishDesc}
                          onChange={(e) => setDishDesc(e.target.value)}
                          className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Image URL (Optional)"
                          value={dishImg}
                          onChange={(e) => setDishImg(e.target.value)}
                          className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="isVegCheck"
                            checked={isVeg}
                            onChange={(e) => setIsVeg(e.target.checked)}
                            className="rounded accent-orange-500"
                          />
                          <label htmlFor="isVegCheck" className="text-xs text-gray-300">Is Vegetarian Dish?</label>
                        </div>
                        <button
                          type="submit"
                          disabled={addingDish}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50 mt-2"
                        >
                          {addingDish ? 'Adding Dish...' : '+ Add Dish To Menu'}
                        </button>
                      </form>
                    </div>

                    {/* MANAGE EXISTING DISHES LIST */}
                    <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5 space-y-3">
                      <h3 className="text-base font-bold text-white">Menu Items Manager ({menuItems.length})</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {menuItems.length === 0 ? (
                          <p className="text-xs text-gray-500">No menu items added yet.</p>
                        ) : (
                          menuItems.map((item) => (
                            <div key={item.id} className="bg-[#161F2E] border border-gray-800 p-3 rounded-xl flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  <span className="text-xs font-bold text-white truncate">{item.name}</span>
                                </div>
                                <span className="text-xs text-orange-400 font-bold">₹{item.price}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => toggleAvailability(item)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                    item.is_available 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                                  }`}
                                  title="Toggle Stock Availability"
                                >
                                  {item.is_available ? 'In Stock ✓' : 'Out Stock ✕'}
                                </button>

                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-[10px] font-bold transition"
                                >
                                  ✏️ Edit
                                </button>

                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] transition"
                                  title="Delete Dish"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kitchen' && (
              <div className="space-y-6">
                {/* ACTIVE WAITER ASSISTANCE REQUESTS */}
                {serviceRequests.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      🔔 Active Table Assistance Requests ({serviceRequests.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {serviceRequests.map((req) => (
                        <div key={req.id} className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="font-extrabold text-amber-400 text-sm">Table #{req.table_number}</span>
                            <p className="text-xs font-bold text-white">{req.request_type}</p>
                          </div>
                          <button
                            onClick={() => resolveServiceRequest(req.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition"
                          >
                            ✓ Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h2 className="text-lg font-bold text-white">Live Kitchen Display System (KDS)</h2>

                {/* 2-COLUMN PROGRESSIVE KITCHEN WORKFLOW */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* COLUMN 1: STEP 1 - INCOMING ACCEPTED ORDERS */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-[#121824] p-3 rounded-xl border border-gray-800">
                      <h3 className="text-xs font-extrabold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                        🕒 Step 1: Accepted Orders ({pendingOrders.length})
                      </h3>
                      <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20 font-bold">
                        Needs Cooking
                      </span>
                    </div>
                    
                    {pendingOrders.length === 0 ? (
                      <div className="bg-[#121824] border border-gray-800 rounded-2xl p-6 text-center text-xs text-gray-500">
                        No new orders waiting for kitchen ☕
                      </div>
                    ) : (
                      pendingOrders.map((order) => (
                        <div key={order.id} className="bg-[#121824] border border-orange-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-black text-orange-400">Table #{order.table_number}</span>
                            <span className="text-xs text-gray-400 font-medium">{order.customer_name || 'Guest'}</span>
                          </div>

                          <div className="space-y-1 border-t border-b border-gray-800 py-2">
                            {order.order_items?.map((item) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span className="text-gray-200">{item.menu_items?.name}</span>
                                <span className="font-bold text-orange-400">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {order.notes && (
                            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg">
                              Note: {order.notes}
                            </p>
                          )}

                          <button
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                          >
                            🍳 Start Cooking →
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* COLUMN 2: STEP 2 - CURRENTLY COOKING */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-[#121824] p-3 rounded-xl border border-gray-800">
                      <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        🍳 Step 2: Currently Cooking ({cookingOrders.length})
                      </h3>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold animate-pulse">
                        In Progress
                      </span>
                    </div>

                    {cookingOrders.length === 0 ? (
                      <div className="bg-[#121824] border border-gray-800 rounded-2xl p-6 text-center text-xs text-gray-500">
                        No dishes currently cooking
                      </div>
                    ) : (
                      cookingOrders.map((order) => (
                        <div key={order.id} className="bg-[#121824] border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-black text-amber-400">Table #{order.table_number}</span>
                            <span className="text-xs text-gray-400 font-medium">{order.customer_name || 'Guest'}</span>
                          </div>

                          <div className="space-y-1 border-t border-b border-gray-800 py-2">
                            {order.order_items?.map((item) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span className="text-gray-200">{item.menu_items?.name}</span>
                                <span className="font-bold text-amber-400">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {order.notes && (
                            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg">
                              Note: {order.notes}
                            </p>
                          )}

                          <button
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                          >
                            🍽️ Mark Order Ready & Served ✓
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'qrcodes' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Table QR Code Generator & Printer</h2>
                    <p className="text-xs text-gray-400">Generate, test, and print branded QR cards for every table in your cafe.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">Select or Enter Table Number</h3>
                    
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Table Number</label>
                      <input
                        type="text"
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        placeholder="e.g. 1, 2, 5, T-12"
                        className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-3 text-sm text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Quick Pick Table</label>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: customTableCount }, (_, i) => (i + 1).toString()).map((tbl) => (
                          <button
                            key={tbl}
                            onClick={() => setSelectedTable(tbl)}
                            className={`py-2 rounded-lg text-xs font-bold transition ${
                              selectedTable === tbl
                                ? 'bg-orange-500 text-white'
                                : 'bg-[#161F2E] text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            #{tbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-800">
                      <label className="text-xs text-gray-400 mb-1 block">Total Tables in Cafe</label>
                      <input
                        type="number"
                        value={customTableCount}
                        onChange={(e) => setCustomTableCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-[#121824] border border-gray-800 rounded-2xl p-6 flex flex-col items-center text-center justify-center">
                    <div className="bg-white text-gray-900 p-8 rounded-3xl shadow-2xl border-4 border-orange-500 max-w-sm w-full">
                      <h3 className="text-xl font-black text-orange-500 uppercase tracking-wide mb-1">{cafe.name}</h3>
                      <p className="text-xs text-gray-500 font-medium mb-6">Scan to View Menu & Place Order</p>

                      <div ref={printRef} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 inline-block mb-6 shadow-inner">
                        <QRCodeSVG
                          value={qrUrl}
                          size={180}
                          bgColor="#f8fafc"
                          fgColor="#0f172a"
                          level="H"
                          includeMargin={false}
                        />
                      </div>

                      <div>
                        <span className="bg-orange-500 text-white text-sm font-extrabold px-5 py-2 rounded-full uppercase tracking-wider inline-block shadow-md">
                          TABLE #{selectedTable}
                        </span>
                      </div>

                      <p className="text-[10px] text-gray-400 font-semibold mt-6 tracking-wider uppercase">
                        Powered by QuickServe SaaS
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3 justify-center w-full max-w-sm">
                      <button
                        onClick={handlePrintQR}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2"
                      >
                        🖨️ Print / Download Table #{selectedTable} QR
                      </button>
                      <a
                        href={qrUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#161F2E] hover:bg-gray-800 text-gray-300 font-bold px-4 py-3 rounded-xl text-xs transition border border-gray-800"
                      >
                        🔗 Test Customer Link
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* EDIT DISH MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-gray-800 w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-sm text-white">Edit Menu Item</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Price (₹)</label>
                <input
                  type="number"
                  required
                  value={editingItem.price}
                  onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Description</label>
                <input
                  type="text"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Image URL</label>
                <input
                  type="text"
                  value={editingItem.image_url || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={editingItem.is_veg}
                    onChange={(e) => setEditingItem({ ...editingItem, is_veg: e.target.checked })}
                    className="rounded accent-orange-500"
                  />
                  Vegetarian
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={editingItem.is_available}
                    onChange={(e) => setEditingItem({ ...editingItem, is_available: e.target.checked })}
                    className="rounded accent-orange-500"
                  />
                  In Stock
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}