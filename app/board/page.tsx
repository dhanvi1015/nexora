
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Evidence = {
  id: string;
  title: string;
  description: string;
  is_shared: boolean;
};

type Suspect = {
  id: string;
  name: string;
  role: string;
};

type Connection = {
  id: string;
  evidence_id: string;
  suspect_id: string;
  user_id: string;
  explanation: string;
  created_at: string;
  author?: string;
  evidence_title?: string;
  suspect_name?: string;
};

type Player = {
  user_id: string;
  display_name: string;
};

export default function BoardPage() {
  const router = useRouter();

  const [roomId, setRoomId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [userId, setUserId] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState("");
  const [selectedSuspect, setSelectedSuspect] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBoard = useCallback(async (id: string) => {
    const [evidenceResult, suspectResult, connectionResult, playerResult] =
      await Promise.all([
        supabase
          .from("evidence")
          .select("id, title, description, is_shared")
          .eq("room_id", id)
          .order("created_at", { ascending: true }),

        supabase
          .from("suspects")
          .select("id, name, role")
          .eq("room_id", id)
          .order("created_at", { ascending: true }),

        supabase
          .from("case_connections")
          .select("id, evidence_id, suspect_id, user_id, explanation, created_at")
          .eq("room_id", id)
          .order("created_at", { ascending: false }),

        supabase
          .from("players")
          .select("user_id, display_name")
          .eq("room_id", id),
      ]);

    if (evidenceResult.error) throw evidenceResult.error;
    if (suspectResult.error) throw suspectResult.error;
    if (connectionResult.error) throw connectionResult.error;
    if (playerResult.error) throw playerResult.error;

    const evidenceList = evidenceResult.data || [];
    const suspectList = suspectResult.data || [];
    const playerList = playerResult.data || [];

    const evidenceMap = new Map(
      evidenceList.map((item) => [item.id, item.title])
    );

    const suspectMap = new Map(
      suspectList.map((item) => [item.id, item.name])
    );

    const playerMap = new Map(
      playerList.map((item) => [item.user_id, item.display_name])
    );

    setEvidence(evidenceList);
    setSuspects(suspectList);

    setConnections(
      (connectionResult.data || []).map((item) => ({
        ...item,
        evidence_title: evidenceMap.get(item.evidence_id) || "Evidence",
        suspect_name: suspectMap.get(item.suspect_id) || "Suspect",
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
        if (!userData.user) throw new Error("Please rejoin your room.");

        if (!active) return;

        setRoomId(room.room_id);
        setRoomCode(room.code || "");
        setUserId(userData.user.id);

        await loadBoard(room.room_id);

        if (!active) return;

        channel = supabase
          .channel(`connections-${room.room_id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "case_connections",
              filter: `room_id=eq.${room.room_id}`,
            },
            () => {
              loadBoard(room.room_id).catch(console.error);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "evidence",
              filter: `room_id=eq.${room.room_id}`,
            },
            () => {
              loadBoard(room.room_id).catch(console.error);
            }
          )
          .subscribe();
      } catch (err) {
        console.error("BOARD LOAD ERROR:", err);
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load the board."
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
  }, [loadBoard]);

  async function addConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEvidence || !selectedSuspect || !explanation.trim()) {
      setError("Choose evidence, choose a suspect, and explain the connection.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.rpc("add_case_connection", {
        p_evidence_id: selectedEvidence,
        p_suspect_id: selectedSuspect,
        p_explanation: explanation.trim(),
      });

      if (error) throw error;

      setExplanation("");
      setSelectedEvidence("");
      setSelectedSuspect("");
      setSuccess("Your theory has been added to the team board.");

      await loadBoard(roomId);
    } catch (err) {
      console.error("ADD CONNECTION ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Could not save your theory."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center">
        Loading the connections board...
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
            COLLABORATIVE INVESTIGATION · {roomCode}
          </p>

          <h1 className="text-4xl md:text-5xl font-serif mt-3">
            Connect the Evidence
          </h1>

          <p className="text-white/45 mt-3 max-w-2xl leading-7">
            Every clue may point somewhere. Link evidence to a suspect and
            explain your reasoning. Your theories will be visible to the team.
          </p>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 mt-8">
          <div>
            <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
              BUILD A THEORY
            </p>
            <h2 className="text-2xl font-serif mt-2">
              What connects them?
            </h2>

            <form
              onSubmit={addConnection}
              className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6 space-y-5"
            >
              <div>
                <label className="block text-xs tracking-widest text-white/50 mb-2">
                  SELECT EVIDENCE
                </label>
                <select
                  value={selectedEvidence}
                  onChange={(event) => setSelectedEvidence(event.target.value)}
                  required
                  className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-sm text-white"
                >
                  <option value="">Choose a clue</option>
                  {evidence.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.is_shared ? " · Shared" : " · Private"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-white/35 mt-2">
                  You can only connect clues you are allowed to see.
                </p>
              </div>

              <div>
                <label className="block text-xs tracking-widest text-white/50 mb-2">
                  SELECT SUSPECT
                </label>
                <select
                  value={selectedSuspect}
                  onChange={(event) => setSelectedSuspect(event.target.value)}
                  required
                  className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-sm text-white"
                >
                  <option value="">Choose a suspect</option>
                  {suspects.map((suspect) => (
                    <option key={suspect.id} value={suspect.id}>
                      {suspect.name} · {suspect.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs tracking-widest text-white/50 mb-2">
                  YOUR REASONING
                </label>
                <textarea
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  placeholder="Why do you think this clue connects to this suspect?"
                  maxLength={500}
                  minLength={5}
                  required
                  rows={5}
                  className="w-full rounded-xl bg-[#211e29] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 resize-y"
                />
                <p className="text-right text-xs text-white/30 mt-1">
                  {explanation.length}/500
                </p>
              </div>

              <button
                type="submit"
                disabled={saving || evidence.length === 0 || suspects.length === 0}
                className="w-full rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold px-5 py-3 disabled:opacity-40"
              >
                {saving ? "Saving theory..." : "Add to team board"}
              </button>
            </form>
          </div>

          <div>
            <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
              THE DETECTIVES' THEORIES
            </p>
            <h2 className="text-2xl font-serif mt-2">
              Case connections
            </h2>
            <p className="text-sm text-white/40 mt-2">
              Shared reasoning from everyone in this room.
            </p>

            <div className="mt-6 space-y-4">
              {connections.length === 0 && (
                <div className="rounded-2xl border border-white/10 p-7 text-center">
                  <p className="text-white/40 text-sm">
                    No theories yet. Make the first connection.
                  </p>
                </div>
              )}

              {connections.map((connection) => (
                <article
                  key={connection.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <p className="text-[10px] tracking-[0.25em] text-[#c7a9bd]">
                    EVIDENCE CONNECTION
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="rounded-lg bg-white/[0.07] px-3 py-2 text-sm">
                      {connection.evidence_title}
                    </span>
                    <span className="text-[#c7a9bd]">→</span>
                    <span className="rounded-lg bg-[#c7a9bd]/10 px-3 py-2 text-sm text-[#e5cddd]">
                      {connection.suspect_name}
                    </span>
                  </div>

                  <p className="text-sm leading-7 text-white/70 mt-4">
                    {connection.explanation}
                  </p>

                  <div className="flex justify-between gap-3 mt-5 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40">
                      Theory by {connection.author}
                      {connection.user_id === userId ? " · You" : ""}
                    </p>
                    <p className="text-xs text-white/30">
                      {new Date(connection.created_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 mt-12 pt-6 flex flex-wrap justify-between gap-4">
          <p className="text-xs text-white/35">
            NEXORA · THE MISSING GUEST · ROOM {roomCode}
          </p>
          <button
            onClick={() => router.push("/suspects")}
            className="text-sm text-[#c7a9bd]"
          >
            View suspect files →
          </button>
        </footer>
      </div>
    </main>
  );
}

