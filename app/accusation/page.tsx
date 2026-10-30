
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Suspect = {
  id: string;
  name: string;
  role: string;
};

type Room = {
  room_id: string;
  code: string;
};

export default function AccusationPage() {
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [suspect, setSuspect] = useState("");
  const [motive, setMotive] = useState("");
  const [method, setMethod] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function initialise() {
      try {
        const saved = sessionStorage.getItem("nexora_room");
        if (!saved) throw new Error("Please rejoin your room.");

        const parsed = JSON.parse(saved);
        if (!parsed.room_id) throw new Error("Invalid room information.");

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;
        if (!userData.user) throw new Error("Please rejoin your room.");

        const { data: suspectData, error: suspectError } = await supabase
          .from("suspects")
          .select("id, name, role")
          .eq("room_id", parsed.room_id)
          .order("created_at");

        if (suspectError) throw suspectError;

        setRoom({ room_id: parsed.room_id, code: parsed.code || "" });
        setSuspects(suspectData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the page.");
      } finally {
        setLoading(false);
      }
    }

    initialise();
  }, []);

  async function submitAccusation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || saving) return;

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const { error } = await supabase.rpc("submit_accusation", {
        p_room_id: room.room_id,
        p_suspect: suspect,
        p_motive: motive.trim(),
        p_method: method.trim(),
        p_explanation: explanation.trim(),
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit accusation.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center">Loading accusation room...</main>;
  }

  return (
    <main className="min-h-screen bg-[#111018] text-[#f4eee7] px-5 py-10 md:px-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push("/game")} className="text-xs tracking-widest text-[#c7a9bd]">
          ← RETURN TO INVESTIGATION
        </button>

        <p className="text-xs tracking-[0.3em] text-[#c7a9bd] mt-10">FINAL INVESTIGATION · {room?.code}</p>
        <h1 className="text-4xl md:text-5xl font-serif mt-3">Make Your Accusation</h1>
        <p className="text-white/50 leading-7 mt-4">
          You've examined the clues. You've heard the witnesses. Now decide who is responsible for the missing guest.
        </p>

        {error && <p className="mt-6 p-4 rounded-xl bg-red-400/10 text-red-300">{error}</p>}

        {success && (
          <div className="mt-6 p-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10">
            <p className="text-emerald-200 font-semibold">Your accusation has been recorded.</p>
            <p className="text-sm text-white/60 mt-2">You can update it by submitting again before the host reveals the case.</p>
            <button onClick={() => router.push("/game")} className="mt-4 text-sm text-[#c7a9bd] underline">Return to investigation</button>
          </div>
        )}

        <form onSubmit={submitAccusation} className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-xs tracking-widest text-white/50 mb-2">WHO IS RESPONSIBLE?</label>
            <select required value={suspect} onChange={e => setSuspect(e.target.value)} className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-white">
              <option value="">Select your suspect</option>
              {suspects.map(item => <option key={item.id} value={item.name}>{item.name} · {item.role}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs tracking-widest text-white/50 mb-2">MOTIVE</label>
            <textarea required minLength={5} maxLength={500} rows={3} value={motive} onChange={e => setMotive(e.target.value)} placeholder="Why would this person make the guest disappear?" className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-white placeholder:text-white/30" />
            <p className="text-right text-xs text-white/30">{motive.length}/500</p>
          </div>

          <div>
            <label className="block text-xs tracking-widest text-white/50 mb-2">METHOD</label>
            <textarea required minLength={5} maxLength={500} rows={3} value={method} onChange={e => setMethod(e.target.value)} placeholder="How do you think the disappearance happened?" className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-white placeholder:text-white/30" />
            <p className="text-right text-xs text-white/30">{method.length}/500</p>
          </div>

          <div>
            <label className="block text-xs tracking-widest text-white/50 mb-2">YOUR EVIDENCE</label>
            <textarea required minLength={5} maxLength={1000} rows={5} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Connect the clues that support your accusation..." className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-white placeholder:text-white/30" />
            <p className="text-right text-xs text-white/30">{explanation.length}/1000</p>
          </div>

          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold py-4 disabled:opacity-50">
            {saving ? "Recording accusation..." : "Submit final accusation"}
          </button>
        </form>

        <p className="text-xs text-white/30 text-center mt-6">Your accusation is saved privately until the case is revealed.</p>
      </div>
    </main>
  );
}
