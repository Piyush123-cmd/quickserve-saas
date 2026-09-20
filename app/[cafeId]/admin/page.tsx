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
  price_per_unit: number;
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
}

export default function MultiTenantAdminDashboard() {
  const params = useParams();
  const cafeSlug = params?.cafeId as string;

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [activeTab, setActiveTab] = useState<'admin' | 'kitchen'>('admin');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | '7days' | 'all'>('today');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Dish addition form state
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [dishImg, setDishImg] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [addingDish, setAddingDish] = useState(false);

  // 1. Fetch Cafe Details & Orders
  const loadData = async () => {
    if (!cafeSlug) return;
    try {
      // Cafe ID
      const { data: cafeData } = await supabase
        .from('cafes')
        .select('*')
        .eq('slug', cafeSlug)
        .maybeSingle();

      if (!cafeData) return;
      setCafe(cafeData);

      // Orders for this cafe
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id, table_number, customer_name, total_amount, status, created_at, notes,
          order_items (
            id, quantity, price_per_unit,
            menu_items ( name )
          )
        `)
        .eq('cafe_id', cafeData.id)
        .order('created_at', { ascending: false });

      if (error) console.error('Orders Fetch Error:', error);
      else setOrders((ordersData as any) || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Realtime Subscriptions for Kitchen/Admin Updates
    const channel = supabase
      .channel('realtime_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeSlug]);

  // Update Order Status (KDS)
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    loadData();
  };

  // Add Dish Handler
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

  // Filter Orders by Date
  const filteredOrders = orders.filter((o) => {
    const orderDate = new Date(o.created_at);
    const now = new Date();

    if (timeFilter === 'today') {
      return orderDate.toDateString() === now.toDateString();
    }
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

  // Analytics Metrics
  const grossRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;

  // Export CSV Audit Log
  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Order ID,Time,Table,Customer,Amount,Status\n";
    filteredOrders.forEach((o) => {
      csvContent += `${o.id},${new Date(o.created_at).toLocaleTimeString()},#${o.table_number},${o.customer_name},₹${o.total_amount},${o.status}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${cafe?.slug}_orders_audit.csv`);
    document.body.appendChild(link);
    link.click();
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

  return (
    <div className="min-h-screen bg-[#0A0D14] text-gray-100 font-sans pb-12">
      {/* Top Header */}
      <header className="bg-[#121824] border-b border-gray-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-orange-500">{cafe.name}</h1>
          <p className="text-xs text-gray-400">Master Owner Dashboard & Live KDS</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#161F2E] p-1.5 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'admin'
                ? 'bg-orange-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📊 Owner Analytics
          </button>
          <button
            onClick={() => setActiveTab('kitchen')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'kitchen'
                ? 'bg-orange-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🍳 Kitchen Display ({pendingOrders})
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6">
        {/* VIEW 1: OWNER ANALYTICS DASHBOARD */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {/* Filter Timeframe Buttons */}
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h2 className="text-lg font-bold text-white">Owner Dashboard & Metrics</h2>
              <div className="flex gap-2 bg-[#121824] p-1 rounded-xl border border-gray-800">
                {(['today', 'yesterday', '7days', 'all'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeFilter(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                      timeFilter === t
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t === '7days' ? 'Last 7 Days' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#121824] border border-gray-800/80 rounded-2xl p-5">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Gross Revenue</p>
                <h3 className="text-3xl font-extrabold text-emerald-400">₹{grossRevenue}</h3>
                <p className="text-xs text-gray-500 mt-2">{filteredOrders.length} orders in range</p>
              </div>

              <div className="bg-[#121824] border border-gray-800/80 rounded-2xl p-5">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Pending Kitchen Orders</p>
                <h3 className="text-3xl font-extrabold text-amber-400">{pendingOrders}</h3>
                <p className="text-xs text-gray-500 mt-2">Active live requests</p>
              </div>

              <div className="bg-[#121824] border border-gray-800/80 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Quick Actions</p>
                  <p className="text-xs text-gray-500">Export order records for accounting</p>
                </div>
                <button
                  onClick={exportCSV}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  📥 Export Excel (CSV)
                </button>
              </div>
            </div>

            {/* Audit Log Table & Add Dish Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Audit Log Table */}
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
                          <td colSpan={5} className="p-4 text-center text-gray-500">No orders found in this timeframe.</td>
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
                                o.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                o.status === 'preparing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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

              {/* Add New Dish Panel */}
              <div className="bg-[#121824] border border-gray-800 rounded-2xl p-5">
                <h3 className="text-base font-bold text-white mb-4">Add New Menu Dish</h3>
                <form onSubmit={handleAddDish} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Dish Name *"
                    required
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (₹) *"
                    required
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="Image URL (Unsplash / Cloud)"
                    value={dishImg}
                    onChange={(e) => setDishImg(e.target.value)}
                    className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                  <textarea
                    placeholder="Dish Description"
                    rows={2}
                    value={dishDesc}
                    onChange={(e) => setDishDesc(e.target.value)}
                    className="w-full bg-[#161F2E] border border-gray-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                      <input
                        type="radio"
                        name="vegType"
                        checked={isVeg}
                        onChange={() => setIsVeg(true)}
                        className="accent-emerald-500"
                      />
                      Veg
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                      <input
                        type="radio"
                        name="vegType"
                        checked={!isVeg}
                        onChange={() => setIsVeg(false)}
                        className="accent-rose-500"
                      />
                      Non-Veg
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={addingDish}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg disabled:opacity-50"
                  >
                    {addingDish ? 'Adding Dish...' : '+ Add Dish To Menu'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: KITCHEN DISPLAY SYSTEM (KDS) */}
        {activeTab === 'kitchen' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Live Kitchen Orders ({orders.filter(o => o.status !== 'completed').length})</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.filter(o => o.status !== 'completed').length === 0 ? (
                <div className="col-span-full text-center py-16 text-gray-500 text-sm">
                  🎉 All orders are served! No pending items in kitchen.
                </div>
              ) : (
                orders.filter(o => o.status !== 'completed').map((order) => (
                  <div key={order.id} className="bg-[#121824] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
                    <div>
                      <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-3">
                        <div>
                          <span className="text-lg font-black text-orange-400">Table #{order.table_number}</span>
                          <p className="text-xs text-gray-400">{order.customer_name}</p>
                        </div>
                        <span className="text-xs font-mono text-gray-500">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {order.notes && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-2 rounded-lg mb-3">
                          ⚠️ Note: {order.notes}
                        </div>
                      )}

                      <div className="space-y-2 mb-4">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-xs">
                            <span className="text-gray-200 font-medium">
                              <strong className="text-orange-400 font-bold">{item.quantity}x</strong> {item.menu_items?.name || 'Item'}
                            </span>
                            <span className="text-gray-500">₹{item.price_per_unit * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KDS Action Buttons */}
                    <div className="pt-3 border-t border-gray-800 grid grid-cols-2 gap-2">
                      {order.status === 'pending' ? (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          className="col-span-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 rounded-xl text-xs transition"
                        >
                          👨‍🍳 Start Preparing
                        </button>
                      ) : (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition"
                        >
                          ✅ Mark Completed / Served
                        </button>
                      )}
                    </div>
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