'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, CheckCircle2, Volume2, ChefHat } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  menu_items: { name: string } | null;
}

interface Order {
  id: string;
  table_no: string;
  customer_name: string;
  total_amount: number;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  created_at: string;
  order_items: OrderItem[];
}

interface CafeDetails {
  id: string;
  name: string;
  slug: string;
}

export default function KitchenDashboard({
  params,
}: {
  params: Promise<{ cafeId: string }>;
}) {
  const resolvedParams = use(params);
  const cafeSlug = resolvedParams?.cafeId;

  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log('Audio notification error:', e);
    }
  };

  // 1. Fetch Cafe UUID from Slug
  useEffect(() => {
    async function fetchCafe() {
      if (!cafeSlug) return;
      try {
        const { data, error } = await supabase
          .from('cafes')
          .select('id, name, slug')
          .eq('slug', cafeSlug)
          .single();

        if (!error && data) {
          setCafe(data);
        }
      } catch (err) {
        console.error('Cafe fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCafe();
  }, [cafeSlug]);

  // 2. Fetch Orders & Subscribe Realtime using Cafe UUID
  useEffect(() => {
    if (!cafe?.id) return;

    const cafeUuid = cafe.id;

    async function fetchOrders() {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, menu_items(name))')
        .eq('cafe_id', cafeUuid)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (data) setOrders(data as unknown as Order[]);
    }

    fetchOrders();

    const channel = supabase
      .channel(`kitchen-orders-${cafeUuid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `cafe_id=eq.${cafeUuid}`,
        },
        () => {
          fetchOrders();
          playBeep();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafe?.id]);

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    if (cafe?.id) {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, menu_items(name))')
        .eq('cafe_id', cafe.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (data) setOrders(data as unknown as Order[]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  if (!cafe) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-red-400 font-medium">Cafe not found or invalid URL.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ChefHat className="text-orange-500" /> Kitchen Live Orders
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Cafe: {cafe.name}</p>
        </div>
        <button
          onClick={() => {
            playBeep();
            setAudioEnabled(true);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
            audioEnabled
              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
              : 'border-slate-700 bg-slate-800 text-slate-300'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          {audioEnabled ? 'Sound Enabled' : 'Enable Alert Sound'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-500">
            No active orders in queue for {cafe.name}.
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`border rounded-2xl p-5 space-y-4 ${
                order.status === 'pending'
                  ? 'bg-orange-500/5 border-orange-500/30'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-lg font-bold text-orange-400">
                    Table #{order.table_no}
                  </span>
                  <p className="text-xs text-slate-400">{order.customer_name}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-semibold uppercase">
                  {order.status}
                </span>
              </div>

              <div className="divide-y divide-slate-800/60 text-sm">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="py-1.5 flex justify-between">
                    <span>{item.menu_items?.name || 'Item'}</span>
                    <span className="font-bold text-slate-300">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
                <span className="font-bold text-sm">₹{order.total_amount}</span>
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(order.id, 'preparing')}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
                    >
                      Accept
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateStatus(order.id, 'completed')}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}