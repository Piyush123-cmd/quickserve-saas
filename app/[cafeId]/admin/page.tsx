'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OrderItem {
  id: string;
  quantity: number;
  price?: number;
  price_per_unit?: number;
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
}

export default function MultiTenantAdminDashboard() {
  const params = useParams();
  const cafeSlug = params?.cafeId as string;

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [activeTab, setActiveTab] = useState<'admin' | 'kitchen'>('admin');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | '7days' | 'all'>('today');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Dish Form State
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [dishImg, setDishImg] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [addingDish, setAddingDish] = useState(false);

  const loadData = async () => {
    if (!cafeSlug) return;
    try {
      // 1. Fetch exact cafe via route slug
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

      // 2. Fetch orders only for this specific cafe
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
        // Unique channel name with timestamp to prevent re-use error in React Strict Mode
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

  return (
    <div className="min-h-screen bg-[#0A0D14] text-gray-100 font-sans pb-12">
      <header className="bg-[#121824] border-b border-gray-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-orange-500">{cafe.name}</h1>
          <p className="text-xs text-gray-400">Master Owner Dashboard & Live KDS</p>
        </div>

        <div className="flex items-center gap-2 bg-[#161F2E] p-1.5 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            📊 Owner Analytics
          </button>
          <button
            onClick={() => setActiveTab('kitchen')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'kitchen' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            🍳 Kitchen Display ({pendingOrders})
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6">
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
      </main>
    </div>
  );
}