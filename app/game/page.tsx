
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Room = {
  room_id: string;
  player_id: string;
  code: string;
  mode: string;
  status: string;
};

type Evidence = {
  id: string;
  title: string;
  description: string;
  is_shared: boolean;
};

type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  sender?: string;
};

type Player = {
  user_id: string;
  display_name: string;
};

export default function GamePage() {
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [hostId, setHostId] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [userId, setUserId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharingId, setSharingId] = useState("");
  const [error, setError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadRoom = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, code, mode, status, host_id")
      .eq("id", roomId)
      .single();

    if (error) throw error;

    setHostId(data.host_id);

    setRoom((previous) => {
      if (!previous) return previous;

      const updated = { ...previous, status: data.status };
      sessionStorage.setItem("nexora_room", JSON.stringify(updated));

      return updated;
    });
  }, []);

  const loadEvidence = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from("evidence")
      .select("id, title, description, is_shared")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    setEvidence(data || []);
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("id, user_id, content, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("user_id, display_name")
      .eq("room_id", roomId);

    if (playerError) throw playerError;

    const playerMap = new Map(
      (playerData || []).map((player) => [
        player.user_id,
        player.display_name,
      ])
    );

    setPlayers(playerData || []);

    setMessages(
      (data || []).map((message) => ({
        ...message,
        sender: playerMap.get(message.user_id) || "Detective",
      }))
    );
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialise() {
      try {
        const savedRoom = sessionStorage.getItem("nexora_room");

        if (!savedRoom) {
          throw new Error(
            "Room information not found. Please rejoin the lobby."
          );
        }

        const parsedRoom: Room = JSON.parse(savedRoom);

        if (!parsedRoom.room_id) {
          throw new Error("Invalid room information.");
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;

        if (!userData.user) {
          throw new Error("Please rejoin the room.");
        }

        if (!active) return;

        setUserId(userData.user.id);
        setRoom(parsedRoom);

        await loadRoom(parsedRoom.room_id);

        if (!active) return;

        await Promise.all([
          loadEvidence(parsedRoom.room_id),
          loadMessages(parsedRoom.room_id),
        ]);

        if (!active) return;

        channel = supabase
          .channel(`game-${parsedRoom.room_id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "rooms",
              filter: `id=eq.${parsedRoom.room_id}`,
            },
            () => {
              loadRoom(parsedRoom.room_id).catch(console.error);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "evidence",
              filter: `room_id=eq.${parsedRoom.room_id}`,
            },
            () => {
              loadEvidence(parsedRoom.room_id).catch(console.error);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
              filter: `room_id=eq.${parsedRoom.room_id}`,
            },
            () => {
              loadMessages(parsedRoom.room_id).catch(console.error);
            }
          )
          .subscribe((status) => {
            console.log("GAME REALTIME STATUS:", status);
          });
      } catch (err) {
        console.error("GAME LOAD ERROR:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load the investigation."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialise();

    return () => {
      active = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadRoom, loadEvidence, loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startCase() {
    if (!room || starting) return;

    setStarting(true);
    setError("");

    try {
      // Start the investigation and create the evidence.
      const { error: startError } = await supabase.rpc("start_game", {
        p_room_id: room.room_id,
      });

      if (startError) throw startError;

      // Create the four suspect profiles.
      const { error: suspectsError } = await supabase.rpc(
        "setup_suspects",
        {
          p_room_id: room.room_id,
        }
      );

      if (suspectsError) throw suspectsError;

      // Store the fixed solution securely on the server.
      const { error: solutionError } = await supabase.rpc(
        "setup_case_solution",
        {
          p_room_id: room.room_id,
        }
      );

      if (solutionError) throw solutionError;

      await loadRoom(room.room_id);

      await Promise.all([
        loadEvidence(room.room_id),
        loadMessages(room.room_id),
      ]);
    } catch (err) {
      console.error("START CASE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not start the case."
      );

      // Refresh room status in case the game started
      // but one of the additional setup calls failed.
      if (room) {
        await loadRoom(room.room_id).catch(console.error);
      }
    } finally {
      setStarting(false);
    }
  }

  async function shareEvidence(evidenceId: string) {
    if (sharingId) return;

    setSharingId(evidenceId);
    setError("");

    try {
      const { error } = await supabase.rpc("share_evidence", {
        p_evidence_id: evidenceId,
      });

      if (error) throw error;

      if (room) {
        await loadEvidence(room.room_id);
      }
    } catch (err) {
      console.error("SHARE EVIDENCE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not share this evidence."
      );
    } finally {
      setSharingId("");
    }
  }

  async function sendMessage(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!room || !messageText.trim() || sending) return;

    setSending(true);
    setError("");

    try {
      const { error } = await supabase.from("messages").insert({
        room_id: room.room_id,
        user_id: userId,
        content: messageText.trim(),
      });

      if (error) throw error;

      setMessageText("");
      await loadMessages(room.room_id);
    } catch (err) {
      console.error("SEND MESSAGE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not send your message."
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center">
        Preparing your investigation...
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400">
            {error || "Room not found."}
          </p>

          <button
            onClick={() => router.push("/play")}
            className="mt-5 underline"
          >
            Return to rooms
          </button>
        </div>
      </main>
    );
  }

  const isHost = userId === hostId;
  const sharedEvidence = evidence.filter((item) => item.is_shared);
  const privateEvidence = evidence.filter((item) => !item.is_shared);

  return (
    <main className="min-h-screen bg-[#111018] text-[#f4eee7] px-5 py-8 md:px-10">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-wrap justify-between items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <button
              onClick={() => router.push("/lobby")}
              className="text-xs text-[#c7a9bd] tracking-widest"
            >
              ← RETURN TO LOBBY
            </button>

            <h1 className="text-3xl md:text-4xl font-serif mt-3">
              The Missing Guest
            </h1>

            <p className="text-sm text-white/40 mt-1">
              Investigation room · {room.code}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs tracking-widest text-white/40">
              CASE STATUS
            </p>

            <p className="mt-1 text-sm text-[#c7a9bd]">
              {room.status === "playing"
                ? "INVESTIGATION ACTIVE"
                : room.status === "finished"
                  ? "CASE CLOSED"
                  : "AWAITING START"}
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300 break-words">
            {error}
          </div>
        )}

        {room.status === "lobby" && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
              BEFORE THE INVESTIGATION
            </p>

            <h2 className="text-2xl font-serif mt-3">
              The case is waiting.
            </h2>

            <p className="text-white/50 mt-2">
              {isHost
                ? "You are the host. Begin when everyone has joined."
                : "Waiting for the room host to begin the investigation."}
            </p>

            {isHost && (
              <button
                onClick={startCase}
                disabled={starting}
                className="mt-6 rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold px-7 py-3 disabled:opacity-50"
              >
                {starting
                  ? "Opening the case..."
                  : "Start the investigation"}
              </button>
            )}
          </section>
        )}

        {room.status === "playing" && (
          <>
            <nav className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/suspects")}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5"
              >
                Suspect profiles
              </button>

              <button
                onClick={() => router.push("/board")}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5"
              >
                Case connections
              </button>

              <button
                onClick={() => router.push("/accusation")}
                className="rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold px-4 py-3 text-sm hover:opacity-90"
              >
                Make an accusation
              </button>

              <button
                onClick={() => router.push("/reveal")}
                className="rounded-xl border border-[#c7a9bd]/40 px-4 py-3 text-sm text-[#e5cddd] hover:bg-[#c7a9bd]/10"
              >
                Case reveal
              </button>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 mt-8">
              <section className="space-y-6">
                <div>
                  <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
                    YOUR PRIVATE FILE
                  </p>

                  <h2 className="text-2xl font-serif mt-2">
                    Evidence assigned to you
                  </h2>

                  <p className="text-sm text-white/40 mt-2">
                    Your private clues are visible only to you until you
                    choose to share them.
                  </p>
                </div>

                {privateEvidence.length === 0 ? (
                  <p className="text-white/40 text-sm">
                    No private clues remain in your file. You have shared
                    them all.
                  </p>
                ) : (
                  privateEvidence.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-[#c7a9bd]/25 bg-[#c7a9bd]/[0.06] p-6"
                    >
                      <p className="text-[10px] tracking-[0.25em] text-[#c7a9bd]">
                        CONFIDENTIAL EVIDENCE
                      </p>

                      <h3 className="text-xl font-serif mt-3">
                        {item.title}
                      </h3>

                      <p className="text-sm leading-7 text-white/65 mt-3">
                        {item.description}
                      </p>

                      <button
                        onClick={() => shareEvidence(item.id)}
                        disabled={sharingId !== ""}
                        className="mt-5 rounded-lg border border-[#c7a9bd]/50 px-4 py-2 text-sm text-[#e5cddd] hover:bg-[#c7a9bd]/10 disabled:opacity-50"
                      >
                        {sharingId === item.id
                          ? "Sharing..."
                          : "Share with everyone"}
                      </button>
                    </article>
                  ))
                )}

                <div className="pt-4">
                  <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
                    SHARED CASE FILE
                  </p>

                  <h2 className="text-2xl font-serif mt-2">
                    Evidence board
                  </h2>

                  <p className="text-sm text-white/40 mt-2">
                    Clues revealed by the detectives appear here for
                    everyone.
                  </p>
                </div>

                {sharedEvidence.length === 0 ? (
                  <p className="text-sm text-white/40">
                    No shared evidence yet.
                  </p>
                ) : (
                  sharedEvidence.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                    >
                      <p className="text-[10px] tracking-[0.25em] text-white/40">
                        SHARED EVIDENCE
                      </p>

                      <h3 className="text-xl font-serif mt-3">
                        {item.title}
                      </h3>

                      <p className="text-sm leading-7 text-white/65 mt-3">
                        {item.description}
                      </p>
                    </article>
                  ))
                )}
              </section>

              <aside className="rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col min-h-[550px] max-h-[760px]">
                <div className="p-5 border-b border-white/10">
                  <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
                    DETECTIVE NETWORK
                  </p>

                  <h2 className="text-2xl font-serif mt-2">
                    Case discussion
                  </h2>

                  <p className="text-xs text-white/40 mt-1">
                    {players.length} detectives in this room
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-white/35 text-center mt-10">
                      The room is quiet. Share your first discovery.
                    </p>
                  )}

                  {messages.map((message) => (
                    <div key={message.id}>
                      <p className="text-xs text-[#c7a9bd] mb-1">
                        {message.user_id === userId
                          ? "YOU"
                          : message.sender}
                      </p>

                      <div
                        className={`rounded-xl p-3 text-sm leading-6 ${
                          message.user_id === userId
                            ? "bg-[#c7a9bd]/15 text-white"
                            : "bg-white/[0.06] text-white/75"
                        }`}
                      >
                        {message.content}
                      </div>

                      <p className="text-[10px] text-white/25 mt-1">
                        {new Date(
                          message.created_at
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}

                  <div ref={chatEndRef} />
                </div>

                <form
                  onSubmit={sendMessage}
                  className="p-4 border-t border-white/10 flex gap-2"
                >
                  <input
                    value={messageText}
                    onChange={(event) =>
                      setMessageText(event.target.value)
                    }
                    placeholder="Share a discovery..."
                    maxLength={1000}
                    className="min-w-0 flex-1 rounded-xl bg-white/[0.06] border border-white/10 px-4 py-3 text-sm outline-none focus:border-[#c7a9bd]/60"
                  />

                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className="rounded-xl bg-[#c7a9bd] text-[#17131b] px-4 font-semibold disabled:opacity-40"
                  >
                    {sending ? "..." : "Send"}
                  </button>
                </form>
              </aside>
            </div>
          </>
        )}

        {room.status === "finished" && (
          <section className="mt-8 rounded-2xl border border-[#c7a9bd]/25 bg-[#c7a9bd]/[0.06] p-7">
            <p className="text-xs tracking-[0.3em] text-[#c7a9bd]">
              INVESTIGATION COMPLETE
            </p>

            <h2 className="text-2xl font-serif mt-3">
              The case has been closed.
            </h2>

            <p className="text-sm text-white/55 mt-2">
              The host has revealed the case. Visit the reveal page to
              see the solution and the detectives&apos; accusations.
            </p>

            <button
              onClick={() => router.push("/reveal")}
              className="mt-6 rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold px-6 py-3"
            >
              View the case reveal
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
