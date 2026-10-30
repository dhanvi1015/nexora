
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Suspect = {
  id: string;
  name: string;
  role: string;
  statement: string;
  alibi: string;
  detail: string;
};

export default function SuspectsPage() {
  const router = useRouter();
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSuspects = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("suspects")
      .select("id, name, role, statement, alibi, detail")
      .eq("room_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    setSuspects(data || []);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialise() {
      try {
        const saved = sessionStorage.getItem("nexora_room");

        if (!saved) {
          throw new Error("Room information not found. Please rejoin your room.");
        }

        const room = JSON.parse(saved);

        if (!room.room_id) {
          throw new Error("Invalid room information.");
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;
        if (!userData.user) throw new Error("Please rejoin the room.");

        if (!active) return;

        setRoomId(room.room_id);
        setRoomCode(room.code || "");

        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("host_id, status")
          .eq("id", room.room_id)
          .single();

        if (roomError) throw roomError;

        if (roomData.status !== "playing") {
          throw new Error("The investigation has not started yet.");
        }

        if (roomData.host_id === userData.user.id) {
          const { error: setupError } = await supabase.rpc("setup_suspects", {
            p_room_id: room.room_id,
          });

          if (setupError) throw setupError;
        }

        await loadSuspects(room.room_id);

        if (!active) return;

        channel = supabase
          .channel(`suspects-${room.room_id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "suspects",
              filter: `room_id=eq.${room.room_id}`,
            },
            () => {
              loadSuspects(room.room_id).catch(console.error);
            }
          )
          .subscribe();
      } catch (err) {
        console.error("SUSPECTS PAGE ERROR:", err);
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load suspect profiles."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialise();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadSuspects]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center">
        Preparing suspect files...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111018] text-[#f4eee7] px-5 py-8 md:px-10">
      <div className="max-w-6xl mx-auto">
        <header className="border-b border-white/10 pb-7">
          <button
            onClick={() => router.push("/game")}
            className="text-xs tracking-widest text-[#c7a9bd]"
          >
            ← RETURN TO INVESTIGATION
          </button>

          <p className="text-xs tracking-[0.3em] text-[#c7a9bd] mt-8">
            CONFIDENTIAL CASE DOSSIER · {roomCode}
          </p>

          <h1 className="text-4xl md:text-5xl font-serif mt-3">
            The Suspects
          </h1>

          <p className="text-white/45 mt-3 max-w-2xl leading-7">
            Four people had access, opportunity, or a reason to hide something.
            Read their statements carefully. Not every alibi is as solid as it sounds.
          </p>
        </header>

        {error && (
          <div className="mt-7 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!error && suspects.length === 0 && (
          <div className="mt-8 rounded-xl border border-white/10 p-6 text-white/50">
            Suspect profiles are being prepared. Refresh this page in a moment.
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
          {suspects.map((suspect, index) => (
            <article
              key={suspect.id}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 md:p-7"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.3em] text-[#c7a9bd]">
                    PERSON OF INTEREST {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="text-2xl md:text-3xl font-serif mt-3">
                    {suspect.name}
                  </h2>
                  <p className="text-sm text-white/40 mt-1">{suspect.role}</p>
                </div>
                <span className="text-3xl text-[#c7a9bd]/60">✦</span>
              </div>

              <div className="mt-7 border-t border-white/10 pt-5">
                <p className="text-[10px] tracking-[0.25em] text-white/40">
                  THEIR STATEMENT
                </p>
                <p className="mt-3 text-sm leading-7 text-white/75 italic">
                  “{suspect.statement}”
                </p>
              </div>

              <div className="mt-6">
                <p className="text-[10px] tracking-[0.25em] text-white/40">
                  CLAIMED ALIBI
                </p>
                <p className="mt-3 text-sm leading-7 text-white/65">
                  {suspect.alibi}
                </p>
              </div>

              <div className="mt-6 rounded-xl bg-[#c7a9bd]/[0.07] border border-[#c7a9bd]/15 p-4">
                <p className="text-[10px] tracking-[0.25em] text-[#c7a9bd]">
                  INVESTIGATOR'S NOTE
                </p>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  {suspect.detail}
                </p>
              </div>
            </article>
          ))}
        </section>

        <footer className="border-t border-white/10 mt-10 pt-6 flex flex-wrap justify-between gap-4">
          <p className="text-xs text-white/35">
            NEXORA · THE MISSING GUEST · ROOM {roomCode}
          </p>
          <button
            onClick={() => router.push("/game")}
            className="text-sm text-[#c7a9bd] hover:text-white"
          >
            Back to the evidence board →
          </button>
        </footer>
      </div>
    </main>
  );
}
