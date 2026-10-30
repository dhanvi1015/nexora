
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Reveal = {
  culprit: string;
  motive: string;
  method: string;
  timeline: string;
};

type Room = {
  room_id: string;
  code: string;
};

type Accusation = {
  user_id: string;
  suspect: string;
  motive: string;
  method: string;
  explanation: string;
  author?: string;
};

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const value = err as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    return [
      value.message || "Unknown database error",
      value.code ? `Code: ${value.code}` : "",
      value.details ? `Details: ${value.details}` : "",
      value.hint ? `Hint: ${value.hint}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return err instanceof Error ? err.message : String(err);
}

export default function RevealPage() {
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [accusations, setAccusations] = useState<Accusation[]>([]);
  const [userId, setUserId] = useState("");
  const [hostId, setHostId] = useState("");
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState("");

  const loadResults = useCallback(async (roomId: string) => {
    const { data, error } = await supabase.rpc("get_case_reveal", {
      p_room_id: roomId,
    });

    if (error) throw error;

    if (!data) {
      throw new Error("The database returned no case solution.");
    }

    setReveal(data as Reveal);

    const { data: accusationData, error: accusationError } =
      await supabase
        .from("accusations")
        .select("user_id, suspect, motive, method, explanation")
        .eq("room_id", roomId);

    if (accusationError) throw accusationError;

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("user_id, display_name")
      .eq("room_id", roomId);

    if (playerError) throw playerError;

    const playerMap = new Map(
      (playerData || []).map((p) => [p.user_id, p.display_name])
    );

    setAccusations(
      (accusationData || []).map((item) => ({
        ...item,
        author: playerMap.get(item.user_id) || "Detective",
      }))
    );
  }, []);

  useEffect(() => {
    let active = true;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialise() {
      try {
        const saved = sessionStorage.getItem("nexora_room");

        if (!saved) throw new Error("Please rejoin your room.");

        const parsed = JSON.parse(saved);

        if (!parsed.room_id) {
          throw new Error("Invalid room information.");
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;
        if (!userData.user) throw new Error("Please rejoin your room.");

        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("host_id, status")
          .eq("id", parsed.room_id)
          .single();

        if (roomError) throw roomError;

        if (!active) return;

        setRoom({
          room_id: parsed.room_id,
          code: parsed.code || "",
        });

        setUserId(userData.user.id);
        setHostId(roomData.host_id);

        // Listen for the host changing the room status to finished.
        channel = supabase
          .channel(`reveal-room-${parsed.room_id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "rooms",
              filter: `id=eq.${parsed.room_id}`,
            },
            async (payload) => {
              if (!active) return;

              if (payload.new.status === "finished") {
                try {
                  setError("");
                  await loadResults(parsed.room_id);
                } catch (err) {
                  console.error("AUTOMATIC REVEAL ERROR:", err);

                  if (active) {
                    setError(getErrorMessage(err));
                  }
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR") {
              console.error("Reveal realtime subscription failed.");
            }
          });

        // Also handle a reveal that happened just before subscription.
        if (roomData.status === "finished") {
          await loadResults(parsed.room_id);
        } else {
          const { data: latestRoom, error: latestError } =
            await supabase
              .from("rooms")
              .select("status")
              .eq("id", parsed.room_id)
              .single();

          if (latestError) throw latestError;

          if (latestRoom.status === "finished") {
            await loadResults(parsed.room_id);
          }
        }
      } catch (err) {
        console.error("REVEAL PAGE LOAD ERROR:", err);

        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    initialise();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadResults]);

  async function revealCase() {
    if (!room || revealing) return;

    setRevealing(true);
    setError("");

    try {
      const { error: setupError } = await supabase.rpc(
        "setup_case_solution",
        {
          p_room_id: room.room_id,
        }
      );

      if (setupError) throw setupError;

      const { error: revealError } = await supabase.rpc(
        "reveal_case",
        {
          p_room_id: room.room_id,
        }
      );

      if (revealError) throw revealError;

      // The host also loads the result immediately.
      await loadResults(room.room_id);
    } catch (err) {
      console.error("REVEAL CASE ERROR:", err);
      setError(getErrorMessage(err));
    } finally {
      setRevealing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center">
        Preparing the reveal...
      </main>
    );
  }

  const isHost = userId === hostId;

  return (
    <main className="min-h-screen bg-[#111018] text-[#f4eee7] px-5 py-10 md:px-10">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/game")}
          className="text-xs tracking-widest text-[#c7a9bd]"
        >
          ← RETURN TO INVESTIGATION
        </button>

        <p className="text-xs tracking-[0.3em] text-[#c7a9bd] mt-10">
          NEXORA · FINAL CHAPTER · {room?.code}
        </p>

        <h1 className="text-4xl md:text-6xl font-serif mt-3">
          The Truth Revealed
        </h1>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm leading-7 break-words">
            <p className="font-semibold mb-1">Something went wrong:</p>
            {error}
          </div>
        )}

        {!reveal && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-7">
            <h2 className="text-2xl font-serif">
              The investigation is not over.
            </h2>

            <p className="text-white/50 mt-3 leading-7">
              The true solution remains sealed. The host can reveal the
              case when the detectives have finished submitting their
              accusations.
            </p>

            {isHost && (
              <button
                onClick={revealCase}
                disabled={revealing}
                className="mt-6 rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold px-7 py-3 disabled:opacity-50"
              >
                {revealing ? "Revealing..." : "Reveal the truth"}
              </button>
            )}
          </section>
        )}

        {reveal && (
          <>
            <section className="mt-8 rounded-2xl border border-[#c7a9bd]/30 bg-[#c7a9bd]/[0.06] p-7 md:p-9">
              <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
                THE PERSON RESPONSIBLE
              </p>

              <h2 className="text-4xl md:text-5xl font-serif mt-4">
                {reveal.culprit}
              </h2>

              <p className="text-sm text-white/40 mt-2">
                Night Manager
              </p>

              <div className="border-t border-white/10 mt-7 pt-6 space-y-6">
                <div>
                  <p className="text-xs tracking-widest text-[#c7a9bd]">
                    MOTIVE
                  </p>
                  <p className="leading-7 text-white/75 mt-2">
                    {reveal.motive}
                  </p>
                </div>

                <div>
                  <p className="text-xs tracking-widest text-[#c7a9bd]">
                    METHOD
                  </p>
                  <p className="leading-7 text-white/75 mt-2">
                    {reveal.method}
                  </p>
                </div>

                <div>
                  <p className="text-xs tracking-widest text-[#c7a9bd]">
                    THE NIGHT, RECONSTRUCTED
                  </p>
                  <p className="leading-7 text-white/75 mt-2">
                    {reveal.timeline}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-10">
              <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
                THE DETECTIVES
              </p>

              <h2 className="text-2xl font-serif mt-2">
                Final accusations
              </h2>

              <div className="space-y-4 mt-5">
                {accusations.map((item, index) => (
                  <article
                    key={`${item.user_id}-${index}`}
                    className="rounded-xl border border-white/10 bg-white/[0.035] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-[#c7a9bd]">{item.author}</p>

                      <p
                        className={
                          item.suspect === reveal.culprit
                            ? "text-emerald-300 text-sm"
                            : "text-red-300 text-sm"
                        }
                      >
                        {item.suspect === reveal.culprit
                          ? "Correct suspect"
                          : "Incorrect suspect"}
                      </p>
                    </div>

                    <p className="mt-3 text-lg font-serif">
                      {item.suspect}
                    </p>

                    <p className="text-sm text-white/55 mt-2">
                      {item.explanation}
                    </p>
                  </article>
                ))}

                {accusations.length === 0 && (
                  <p className="text-white/40 text-sm">
                    No accusations were submitted.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
