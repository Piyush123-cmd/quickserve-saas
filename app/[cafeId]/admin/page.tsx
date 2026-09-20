'use client';

import React, { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, QrCode, UtensilsCrossed, Printer } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  category_id: string;
}

interface CafeDetails {
  id: string;
  name: string;
  slug: string;
}

export default function AdminPage({
  params,
}: {
  params: Promise<{ cafeId: string }>;
}) {
  const resolvedParams = use(params);
  const cafeSlug = resolvedParams?.cafeId;

  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [selectedTable, setSelectedTable] = useState('1');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  // Fetch Cafe by Slug & then fetch categories + items
  useEffect(() => {
    async function initAdminData() {
      if (!cafeSlug) return;
      try {
        setLoading(true);
        // 1. Fetch cafe UUID
        const { data: cafeData, error: cafeErr } = await supabase
          .from('cafes')
          .select('id, name, slug')
          .eq('slug', cafeSlug)
          .single();

        if (cafeErr || !cafeData) {
          console.error('Cafe not found:', cafeErr);
          setLoading(false);
          return;
        }

        setCafe(cafeData);

        // 2. Fetch categories and items using cafe UUID
        const [catRes, itemRes] = await Promise.all([
          supabase.from('categories').select('*').eq('cafe_id', cafeData.id),
          supabase.from('menu_items').select('*').eq('cafe_id', cafeData.id),
        ]);

        if (catRes.data) {
          setCategories(catRes.data);
          if (catRes.data.length > 0) setCategoryId(catRes.data[0].id);
        }
        if (itemRes.data) setMenuItems(itemRes.data);
      } catch (e) {
        console.error('Data fetch error:', e);
      } finally {
        setLoading(false);
      }
    }

    initAdminData();
  }, [cafeSlug]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !cafe?.id) return;

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        cafe_id: cafe.id,
        name,
        price: parseFloat(price),
        description,
        is_veg: isVeg,
        category_id: categoryId || null,
        is_available: true,
      })
      .select()
      .single();

    if (!error && data) {
      setMenuItems((prev) => [...prev, data]);
      setName('');
      setPrice('');
      setDescription('');
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

  const qrValue = `${baseUrl}/menu/${cafeSlug}?table=${selectedTable}`;

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
    <div className="min-h-screen bg-slate-950 text-white p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="text-orange-500" /> Admin & QR Control
          </h1>
          <p className="text-sm text-slate-400">Cafe: {cafe.name} ({cafe.slug})</p>
        </div>
        <a
          href={`/${cafe.slug}/kds`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-orange-400 font-medium rounded-xl border border-slate-700 text-sm transition"
        >
          Open Kitchen Dashboard →
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Add Item & Menu List */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleAddItem} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h2 className="font-semibold text-base">Add New Menu Item</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Item Name (e.g. Cold Coffee)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                required
              />
              <input
                type="number"
                placeholder="Price (₹)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            {categories.length > 0 && (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    Category: {cat.name}
                  </option>
                ))}
              </select>
            )}

            <textarea
              placeholder="Short Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white h-20 focus:outline-none focus:border-orange-500"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isVeg}
                  onChange={(e) => setIsVeg(e.target.checked)}
                  className="rounded border-slate-700 text-orange-500 focus:ring-0"
                />
                Vegetarian
              </label>
              <button
                type="submit"
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 font-semibold rounded-xl text-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
          </form>

          {/* Items List */}
          <div className="space-y-3">
            <h2 className="font-semibold text-base">Current Menu ({menuItems.length})</h2>
            {menuItems.length === 0 ? (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-sm">
                No items added yet.
              </div>
            ) : (
              menuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-emerald-400' : 'bg-red-500'}`} />
                      <span className="font-semibold text-sm">{item.name}</span>
                      <span className="text-orange-400 text-xs font-bold">₹{item.price}</span>
                    </div>
                    {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAvailability(item)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                        item.is_available
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-slate-700 text-slate-500 bg-slate-800'
                      }`}
                    >
                      {item.is_available ? 'Available' : 'Sold Out'}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Live QR Generator */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center space-y-4 h-fit">
          <div className="flex items-center gap-2 font-bold text-base">
            <QrCode className="text-orange-500" /> Table QR Generator
          </div>
          <div className="w-full">
            <label className="text-xs text-slate-400 block mb-1">Select Table Number</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  Table #{n}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow-xl">
            <QRCodeSVG value={qrValue} size={180} level="H" />
          </div>

          <p className="text-xs text-slate-400 break-all">{qrValue}</p>

          <button
            onClick={() => window.print()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Printer className="w-4 h-4" /> Print Standee QR
          </button>
        </div>
      </div>
    </div>
  );
}