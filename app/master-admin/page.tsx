"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase Client Config
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MasterAdminPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCafe, setCreatedCafe] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState("");

  // Safely get base URL on client side (Prevents Next.js SSR Build Error)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleCreateCafe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const { data, error } = await supabase
      .from("cafes")
      .insert([
        {
          name,
          slug: cleanSlug,
          upi_id: upiId,
          is_active: true,
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert("Error creating cafe: " + error.message);
    } else {
      setCreatedCafe(data);
      setName("");
      setSlug("");
      setUpiId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6 text-amber-400">
        🚀 SaaS Master Admin - Add New Client
      </h1>

      <form
        onSubmit={handleCreateCafe}
        className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 shadow-xl"
      >
        <div>
          <label className="block text-sm mb-1 font-medium">Cafe Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Chai Point"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
            className="w-full bg-slate-700 border border-slate-600 rounded p-2.5 text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 font-medium">
            URL Slug (Unique ID)
          </label>
          <input
            type="text"
            required
            placeholder="e.g. chai-point"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded p-2.5 text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 font-medium">
            Cafe UPI ID (Payments)
          </label>
          <input
            type="text"
            placeholder="e.g. chaipoint@upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded p-2.5 text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 font-bold py-3 rounded-xl transition shadow-lg disabled:opacity-50 text-slate-950"
        >
          {loading ? "Creating Cafe..." : "Create & Activate Cafe"}
        </button>
      </form>

      {createdCafe && (
        <div className="mt-8 bg-green-900/40 border border-green-500/60 p-6 rounded-xl space-y-3 shadow-2xl">
          <h2 className="text-xl font-bold text-green-400 flex items-center gap-2">
            ✅ Cafe Onboarded Successfully!
          </h2>
          {/* FIXED ROUTES: Directly mapped to app/[cafeId] without extra /cafe/ */}
          <p className="text-sm">
            <strong className="text-gray-300">Customer Menu / QR URL:</strong>{" "}
            <a
              href={`${baseUrl}/${createdCafe.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-300 underline font-mono hover:text-amber-200"
            >
              {baseUrl}/{createdCafe.slug}
            </a>
          </p>
          <p className="text-sm">
            <strong className="text-gray-300">Kitchen KDS URL:</strong>{" "}
            <a
              href={`${baseUrl}/${createdCafe.slug}/kds`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-300 underline font-mono hover:text-amber-200"
            >
              {baseUrl}/{createdCafe.slug}/kds
            </a>
          </p>
          <p className="text-sm">
            <strong className="text-gray-300">Owner Dashboard:</strong>{" "}
            <a
              href={`${baseUrl}/${createdCafe.slug}/admin`}
              target="_blank"
              rel="noreferrer"
              className="text-amber-300 underline font-mono hover:text-amber-200"
            >
              {baseUrl}/{createdCafe.slug}/admin
            </a>
          </p>
        </div>
      )}
    </div>
  );
}