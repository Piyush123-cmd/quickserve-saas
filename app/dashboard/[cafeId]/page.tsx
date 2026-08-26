'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChefHat, CheckCircle2, Clock, Volume2, AlertCircle, RefreshCw } from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  table_number: number;
  total_amount: number;
  status: 'NEW' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  payment_status: 'PENDING' | 'PAID';
  created_at: string;
  order_items?: OrderItem[];
}

export default function KitchenDashboard() {
  const params = useParams();
  const cafeId = params.cafeId as string;

  const [orders, setOrders] = useState<Order[]>([]);
  const [cafeName, setCafeName] = useState('Cafe Dashboard');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Beep sound generator using Web Audio API (no external mp3 needed)
  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio playback waiting for user interaction');
    }
  };

  const fetchOrders = async () => {
    const { data: cafe } = await supabase.from('cafes').select('name').eq('id', cafeId).single();
    if (cafe) setCafeName(cafe.name);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('cafe_id', cafeId)
      .neq('status', 'COMPLETED')
      .order('created_at', { ascending: false });

    if (ordersData) setOrders(ordersData);
  };

  useEffect(() => {
    if (!cafeId) return;
    fetchOrders();

    // Supabase Real-time listener for incoming orders
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          playNotificationSound();
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafeId}` },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId]);

  const updateOrderStatus = async (orderId: string, nextStatus: string) => {
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    setOrders((prev) =>
      nextStatus === 'COMPLETED'
        ? prev.filter((o) => o.id !== orderId)
        : prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus as any } : o))
    );
  };

  const updatePaymentStatus = async (orderId: string, currentStatus: string) => {
    const nextPay = currentStatus === 'PENDING' ? 'PAID' : 'PENDING';
    await supabase.from('orders').update({ payment_status: nextPay }).eq('id', orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_status: nextPay as any } : o))
    );
  };

  const enableAudio = () => {
    playNotificationSound();
    setSoundEnabled(true);
  };

  const newOrders = orders.filter((o) => o.status === 'NEW');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="w-7 h-7 text-emerald-500" />
          <div>
            <h1 className="text-xl font-bold">{cafeName}</h1>
            <p className="text-xs text-neutral-400">Live Kitchen & Counter Display</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!soundEnabled ? (
            <button
              onClick={enableAudio}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition"
            >
              <Volume2 className="w-4 h-4 animate-pulse" /> Enable Alert Sound
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-medium">
              <Volume2 className="w-4 h-4" /> Sound Active
            </span>
          )}

          <button
            onClick={fetchOrders}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 text-neutral-300 transition"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Kanban Board Columns */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-x-auto">
        {/* Column 1: NEW ORDERS */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <h2 className="font-bold text-sm tracking-wide text-amber-400 flex items-center gap-2 uppercase">
              <AlertCircle className="w-4 h-4" /> New Orders ({newOrders.length})
            </h2>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {newOrders.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-10">No new orders</p>
            ) : (
              newOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-neutral-900 border-2 border-amber-500/40 rounded-xl p-4 shadow-lg flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-amber-500 text-black font-black text-sm rounded-lg">
                      Table #{order.table_number}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-800 text-sm">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="py-1.5 flex justify-between">
                        <span className="font-medium text-neutral-200">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-neutral-400 font-mono text-xs">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-400">Total: <strong className="text-white">₹{order.total_amount}</strong></p>
                      <button
                        onClick={() => updatePaymentStatus(order.id, order.payment_status)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded mt-1 border ${
                          order.payment_status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        {order.payment_status === 'PAID' ? 'PAID' : 'PAYMENT PENDING'}
                      </button>
                    </div>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition"
                    >
                      Accept & Cook
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Column 2: PREPARING */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <h2 className="font-bold text-sm tracking-wide text-blue-400 flex items-center gap-2 uppercase">
              <Clock className="w-4 h-4" /> Preparing ({preparingOrders.length})
            </h2>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {preparingOrders.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-10">Kitchen idle</p>
            ) : (
              preparingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-neutral-900 border border-blue-500/30 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 font-bold text-sm rounded-lg border border-blue-500/30">
                      Table #{order.table_number}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-800 text-sm">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="py-1.5 flex justify-between">
                        <span className="font-medium text-neutral-200">
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-neutral-800 flex justify-end">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'READY')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition"
                    >
                      Mark as Ready
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Column 3: READY TO SERVE / COMPLETE */}
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <h2 className="font-bold text-sm tracking-wide text-emerald-400 flex items-center gap-2 uppercase">
              <CheckCircle2 className="w-4 h-4" /> Ready to Serve ({readyOrders.length})
            </h2>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {readyOrders.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-10">No orders waiting</p>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-neutral-900 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-sm rounded-lg border border-emerald-500/30">
                      Table #{order.table_number}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      ₹{order.total_amount}
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-800 text-sm">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="py-1 flex justify-between text-neutral-300">
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-neutral-800 flex justify-end">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg transition"
                    >
                      Complete & Archive
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}