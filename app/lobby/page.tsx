
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Room = {
  room_id: string;
  player_id: string;
  code: string;
  mode: string;
  status: string;
};

type Player = {
  id: string;
  display_name: string;
  is_ready: boolean;
};

export default function LobbyPage() {
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readyLoading, setReadyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadLobby() {
      try {
        const savedRoom = sessionStorage.getItem("nexora_room");

        if (!savedRoom) {
          throw new Error("No room found. Please create or join a room first.");
        }

        const parsedRoom: Room = JSON.parse(savedRoom);

        if (!parsedRoom.room_id || !parsedRoom.player_id) {
          throw new Error("Your saved room information is incomplete. Please rejoin.");
        }

        if (!active) return;
        setRoom(parsedRoom);

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;

        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("host_id, status")
          .eq("id", parsedRoom.room_id)
          .single();

        if (roomError) throw roomError;

        if (!active) return;

        setIsHost(roomData.host_id === userData.user.id);

        if (roomData.status === "playing") {
          router.replace("/game");
          return;
        }

        if (roomData.status === "finished") {
          router.replace("/reveal");
          return;
        }

        const fetchPlayers = async () => {
          const { data, error } = await supabase
            .from("players")
            .select("id, display_name, is_ready")
            .eq("room_id", parsedRoom.room_id)
            .order("joined_at", { ascending: true });

          if (error) {
            throw new Error(`${error.message} (Code: ${error.code})`);
          }

          if (active) {
            setPlayers(data || []);
            setError("");
          }
        };

        const checkRoomStatus = async () => {
          const { data, error } = await supabase
            .from("rooms")
            .select("status")
            .eq("id", parsedRoom.room_id)
            .single();

          if (error) throw error;

          if (!active) return;

          if (data.status === "playing") {
            router.replace("/game");
          } else if (data.status === "finished") {
            router.replace("/reveal");
          }
        };

        await fetchPlayers();

        if (!active) return;

        channel = supabase
          .channel(`lobby-${parsedRoom.room_id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "players",
              filter: `room_id=eq.${parsedRoom.room_id}`,
            },
            () => {
              fetchPlayers().catch((err) => {
                if (active) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not refresh players."
                  );
                }
              });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "rooms",
              filter: `id=eq.${parsedRoom.room_id}`,
            },
            () => {
              checkRoomStatus().catch((err) => {
                console.error("ROOM STATUS ERROR:", err);
              });
            }
          )
          .subscribe();
      } catch (err) {
        console.error("LOBBY LOAD ERROR:", err);

        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load the lobby."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLobby();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  async function toggleReady() {
    if (!room || readyLoading || startLoading) return;

    const currentPlayer = players.find(
      (player) => player.id === room.player_id
    );

    if (!currentPlayer) {
      setError("Your player record was not found. Please refresh the page.");
      return;
    }

    setReadyLoading(true);
    setError("");

    try {
      const newReadyStatus = !currentPlayer.is_ready;

      const { error } = await supabase
        .from("players")
        .update({ is_ready: newReadyStatus })
        .eq("id", room.player_id);

      if (error) {
        throw new Error(`${error.message} (Code: ${error.code})`);
      }

      setPlayers((current) =>
        current.map((player) =>
          player.id === room.player_id
            ? { ...player, is_ready: newReadyStatus }
            : player
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update your status."
      );
    } finally {
      setReadyLoading(false);
    }
  }

  async function startInvestigation() {
    if (!room || !isHost || startLoading) return;

    if (players.length < 2) {
      setError("At least two detectives must join before starting.");
      return;
    }

    if (players.length > 6) {
      setError("A room can have a maximum of six detectives.");
      return;
    }

    if (players.some((player) => !player.is_ready)) {
      setError("Every detective must be ready before the investigation begins.");
      return;
    }

    setStartLoading(true);
    setError("");

    try {
      const { error: startError } = await supabase.rpc("start_game", {
        p_room_id: room.room_id,
      });

      if (startError) throw startError;

      const { error: suspectsError } = await supabase.rpc(
        "setup_suspects",
        {
          p_room_id: room.room_id,
        }
      );

      if (suspectsError) throw suspectsError;

      const { error: solutionError } = await supabase.rpc(
        "setup_case_solution",
        {
          p_room_id: room.room_id,
        }
      );

      if (solutionError) throw solutionError;

      router.replace("/game");
    } catch (err) {
      console.error("START INVESTIGATION ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not start the investigation."
      );

      setStartLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center">
        Loading your investigation...
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-[#111018] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-red-400">
            {error || "Room could not be loaded."}
          </p>
          <a href="/play" className="text-[#c7a9bd] underline mt-5 block">
            Return to the game
          </a>
        </div>
      </main>
    );
  }

  const myPlayer = players.find((player) => player.id === room.player_id);
  const readyCount = players.filter((player) => player.is_ready).length;
  const everyoneReady =
    players.length >= 2 &&
    players.length <= 6 &&
    readyCount === players.length;

  return (
    <main className="min-h-screen bg-[#111018] text-[#f4eee7] px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="text-sm text-[#c7a9bd]">
          ← NEXORA
        </a>

        <p className="text-xs tracking-[0.35em] text-[#c7a9bd] mt-12">
          INVESTIGATION ROOM
        </p>

        <h1 className="text-5xl font-serif mt-4">
          The room is yours.
        </h1>

        <p className="text-white/50 mt-3">
          Invite your fellow detectives to join the investigation.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-sm text-white/50 tracking-widest">
            YOUR ROOM CODE
          </p>

          <h2 className="text-5xl tracking-[0.3em] font-semibold mt-4">
            {room.code}
          </h2>

          <button
            onClick={() => {
              navigator.clipboard.writeText(room.code).catch(() => {
                setError("Could not copy the room code. Please copy it manually.");
              });
            }}
            className="mt-5 px-5 py-2 rounded-lg border border-white/20 hover:bg-white/10"
          >
            Copy room code
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex justify-between items-center gap-3">
            <h2 className="text-xl font-serif">Detectives present</h2>
            <span className="text-sm text-white/50">
              {players.length}/6 players
            </span>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-400 break-words">{error}</p>
          )}

          <div className="mt-5 space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex justify-between items-center rounded-xl bg-white/[0.04] px-4 py-3"
              >
                <div>
                  <p className="text-white/90">
                    {player.display_name}
                    {player.id === room.player_id && (
                      <span className="text-[#c7a9bd] text-xs ml-2">
                        YOU
                      </span>
                    )}
                  </p>

                  {player.id === room.player_id && (
                    <p className="text-xs text-white/40 mt-1">
                      Room host
                    </p>
                  )}
                </div>

                <span
                  className={`text-xs ${
                    player.is_ready ? "text-green-400" : "text-white/40"
                  }`}
                >
                  {player.is_ready ? "READY" : "NOT READY"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm text-white/40">
            {readyCount} of {players.length} detectives ready
          </p>

          <button
            onClick={toggleReady}
            disabled={readyLoading || startLoading || !myPlayer}
            className="mt-5 w-full rounded-xl bg-[#c7a9bd] text-[#17131b] font-semibold py-3 disabled:opacity-50"
          >
            {readyLoading
              ? "Updating..."
              : myPlayer?.is_ready
                ? "I'm Not Ready"
                : "I'm Ready"}
          </button>

          {isHost && (
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-xs text-white/40 text-center mb-4">
                {everyoneReady
                  ? "All detectives are ready. The investigation can begin."
                  : "Waiting for every detective to be ready."}
              </p>

              <button
                onClick={startInvestigation}
                disabled={!everyoneReady || startLoading || readyLoading}
                className="w-full rounded-xl bg-[#c4b5d8] py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#171522] transition hover:bg-[#ded2ec] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {startLoading
                  ? "Opening the case..."
                  : "Start Investigation →"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-white/40">
          Mode:{" "}
          {room.mode === "collective" ? "The Collective" : "The Deception"}
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          {isHost
            ? "As host, you can begin once every detective is ready."
            : "The host will begin the investigation when everyone is ready."}
        </p>
      </div>
    </main>
  );
}
