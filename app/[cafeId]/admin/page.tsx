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
  total_amount: number;
  status: string;
  created_at: string;
  notes: string | null;
  order_items: OrderItem[];
}

interface Cafe {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  admin_pin?: string;
  kitchen_pin?: string;
}

export default function MultiTenantAdminDashboard() {
  const params = useParams();
  const cafeSlug = params?.cafeId as string;

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [activeTab, setActiveTab] = useState<'admin' | 'kitchen' | 'qrcodes'>('admin');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | '7days' | 'all'>('today');
  
  const [orders, setOrders] = useState<Order[]>([]);
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

      // Check existing session locks in localStorage
      const storedAdminSession = localStorage.getItem(`qs_admin_session_${cafeData.id}`);
      const storedKitchenSession = localStorage.getItem(`qs_kitchen_session_${cafeData.id}`);
      
      if (storedAdminSession === 'unlocked') setIsAdminUnlocked(true);
      if (storedKitchenSession === 'unlocked') setIsKitchenUnlocked(true);

      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id, table_number, customer_name, total_amount, status, created_at, notes,
          order_items (
            id, quantity, price,
            menu_items ( name )
          )
        `)
        .eq('cafe_id', cafeData.id)
        .order('created_at', { ascending: false });

      if (ordersErr) console.error('Orders Error:', ordersErr);
      else setOrders((ordersData as any) || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!cafeSlug) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const initRealtime = async () => {
      const { data: cafeData } = await supabase
        .from('cafes')
        .select('id')
        .eq('slug', cafeSlug)
        .maybeSingle();

      if (cafeData?.id) {
        const channelName = `realtime_orders_${cafeData.id}_${Date.now()}`;
        channel = supabase.channel(channelName);

        channel
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
      }
    };

    initRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
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
        setPinError('Galat Admin PIN! Kripya sahi passcode daalein.');
      }
    } else if (activeTab === 'kitchen') {
      if (pinInput === expectedKitchenPin || pinInput === expectedAdminPin) {
        setIsKitchenUnlocked(true);
        localStorage.setItem(`qs_kitchen_session_${cafe.id}`, 'unlocked');
        setPinInput('');
      } else {
        setPinError('Galat Kitchen PIN! Kripya sahi passcode daalein.');
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
      alert('Dish Added Successfully!');
      setDishName('');
      setDishPrice('');
      setDishDesc('');
      setDishImg('');
    } catch (err: any) {
      alert('Failed to add dish: ' + err.message);
    } finally {
      setAddingDish(false);
    }
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
        <p className="text-red-500 font-bold">Cafe records not found!</p>
      </div>
    );
  }

  if (cafe.is_active === false) {
    return (
      <div className="min-h-screen bg-[#0A0D14] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-extrabold text-red-500 mb-2">{cafe.name} - Subscription Expired 🚫</h1>
        <p className="text-gray-400 text-sm max-w-md mb-6">
          Is cafe ka QuickServe SaaS plan filhal paused ya expired hai. Continuous services ke liye kripya QuickServe Support se sampark karein.
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
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://quickserve-saas.vercel.app';
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
            🍳 Kitchen ({pendingOrders}) {!isKitchenUnlocked && '🔒'}
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
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Pending Kitchen Orders</p>
                    <h3 className="text-3xl font-extrabold text-amber-400">{pendingOrders}</h3>
                    <p className="text-xs text-gray-500 mt-2">Active live requests</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-[#121824] border border-gray-800 rounded-2xl p-5">
                    <h3 className="text-base font-bold text-white mb-4">Orders Audit Log ({filteredOrders.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-[#161F2E] text-gray-400 border-b border-gray-800">
                          <tr>
                            <th className="p-3">Time</th>
                            <th className="p-3">Table</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-gray-500">No orders found.</td>
                            </tr>
                          ) : (
                            filteredOrders.map((o) => (
                              <tr key={o.id} className="hover:bg-[#161F2E]/50">
                                <td className="p-3 font-mono">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="p-3 font-bold text-orange-400">#{o.table_number}</td>
                                <td className="p-3">{o.customer_name}</td>
                                <td className="p-3 font-bold text-white">₹{o.total_amount}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    o.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                    {o.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5">
                    <h3 className="text-base font-bold text-white mb-4">Add New Menu Dish</h3>
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
                </div>
              </div>
            )}

            {activeTab === 'kitchen' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">Live Kitchen Display System (KDS)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {orders.filter(o => o.status !== 'completed').length === 0 ? (
                    <div className="col-span-full bg-[#121824] border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
                      No active pending kitchen orders! ☕
                    </div>
                  ) : (
                    orders.filter(o => o.status !== 'completed').map((order) => (
                      <div key={order.id} className="bg-[#121824] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-lg font-black text-orange-400">Table #{order.table_number}</span>
                            <span className="text-xs text-gray-400">{order.customer_name}</span>
                          </div>
                          <div className="space-y-1 mb-4 border-t border-b border-gray-800 py-2">
                            {order.order_items?.map((item) => (
                              <div key={item.id} className="flex justify-between text-xs">
                                <span className="text-gray-200">{item.menu_items?.name}</span>
                                <span className="font-bold text-orange-400">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                          {order.notes && (
                            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg mb-4">
                              Note: {order.notes}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
                        >
                          ✅ Complete Order
                        </button>
                      </div>
                    ))
                  )}
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
    </div>
  );
}