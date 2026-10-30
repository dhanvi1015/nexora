
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, type GameMode } from "../lib/rooms";

export default function Home() {
  const router = useRouter();

  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<GameMode>("collective");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateRoom() {
    if (!displayName.trim()) {
      setError("Please enter your detective name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const room = await createRoom(displayName.trim(), mode);

      sessionStorage.setItem("nexora_room", JSON.stringify(room));
      router.push("/lobby");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the room."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom() {
    if (!displayName.trim()) {
      setError("Please enter your detective name.");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const room = await joinRoom(
        roomCode.trim().toUpperCase(),
        displayName.trim()
      );

      sessionStorage.setItem("nexora_room", JSON.stringify(room));
      router.push("/lobby");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not join the room."
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setError("");
    setShowJoin(false);
    setShowCreate(true);
  }

  function openJoin() {
    setError("");
    setShowCreate(false);
    setShowJoin(true);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#090b12] text-[#f4eee5]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-[#7770a8]/20 blur-[120px]" />
        <div className="absolute -right-32 top-64 h-96 w-96 rounded-full bg-[#9a7891]/15 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#607d86]/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(#d8c9bb 0.7px, transparent 0.7px)",
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 md:px-12">
        <header className="flex items-center justify-between border-b border-white/10 py-7">
          <div className="text-xl font-semibold tracking-[0.35em]">
            NEXORA<span className="text-[#b8a8d5]">.</span>
          </div>

          <div className="hidden text-[10px] uppercase tracking-[0.35em] text-white/40 sm:block">
            A multiplayer mystery experience
          </div>

          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="h-2 w-2 rounded-full bg-[#a9c5b1] shadow-[0_0_12px_#a9c5b1]" />
            Online experience
          </div>
        </header>

        <section className="grid flex-1 items-center gap-14 py-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="max-w-2xl">
            <div className="mb-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-[#c4b5d8]">
              <span className="h-px w-10 bg-[#c4b5d8]/70" />
              Every secret has another side
            </div>

            <h1 className="font-serif text-6xl font-light leading-[1.08] tracking-[-0.045em] sm:text-7xl lg:text-[88px]">
              Some stories
              <br />
              <span className="italic text-[#c4b5d8]">aren't meant</span>
              <br />
              to be solved alone.
            </h1>

            <p className="mt-8 max-w-lg text-sm leading-8 text-[#c2bec7]/70 sm:text-base">
              Step into a world of hidden truths, conflicting memories and
              impossible questions. Every player holds a different piece of
              the story. Only together can you uncover what really happened.
            </p>

            <div className="mt-11 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={openCreate}
                className="group rounded-sm bg-[#c4b5d8] px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#171522] transition hover:bg-[#ded2ec]"
              >
                Create a room{" "}
                <span className="ml-3 transition group-hover:translate-x-1">
                  ↗
                </span>
              </button>

              <button
                onClick={openJoin}
                className="rounded-sm border border-white/20 px-8 py-4 text-xs uppercase tracking-[0.2em] text-white/80 transition hover:border-[#c4b5d8] hover:text-[#d8c9eb]"
              >
                Join a room
              </button>
            </div>

            {showCreate && (
              <div className="mt-6 max-w-md space-y-4 border border-white/15 bg-white/[0.04] p-5">
                <div className="text-xs uppercase tracking-[0.25em] text-[#c4b5d8]">
                  Create your investigation
                </div>

                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="YOUR DETECTIVE NAME"
                  maxLength={24}
                  className="w-full border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#c4b5d8]"
                />

                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50">
                  Game mode
                </label>

                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as GameMode)}
                  className="w-full border border-white/15 bg-[#171824] px-4 py-3 text-sm text-white outline-none focus:border-[#c4b5d8]"
                >
                  <option value="collective">The Collective</option>
                  <option value="deception">The Deception</option>
                </select>

                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full bg-[#c4b5d8] px-5 py-3 text-xs font-semibold uppercase tracking-widest text-[#171522] disabled:opacity-50"
                >
                  {loading ? "Creating room..." : "Create investigation"}
                </button>

                <button
                  onClick={() => setShowCreate(false)}
                  className="w-full py-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {showJoin && (
              <div className="mt-6 max-w-md space-y-4 border border-white/15 bg-white/[0.04] p-5">
                <div className="text-xs uppercase tracking-[0.25em] text-[#c4b5d8]">
                  Join an investigation
                </div>

                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="YOUR DETECTIVE NAME"
                  maxLength={24}
                  className="w-full border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#c4b5d8]"
                />

                <input
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase())
                  }
                  placeholder="ENTER ROOM CODE"
                  maxLength={8}
                  className="w-full border border-white/15 bg-black/20 px-4 py-3 text-sm tracking-[0.2em] text-white outline-none placeholder:text-white/30 focus:border-[#c4b5d8]"
                />

                <button
                  onClick={handleJoinRoom}
                  disabled={loading}
                  className="w-full bg-[#c4b5d8] px-5 py-3 text-xs font-semibold uppercase tracking-widest text-[#171522] disabled:opacity-50"
                >
                  {loading ? "Joining room..." : "Enter investigation"}
                </button>

                <button
                  onClick={() => setShowJoin(false)}
                  className="w-full py-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 max-w-md border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-16 flex gap-10 border-t border-white/10 pt-7">
              <div>
                <div className="font-serif text-2xl">03–06</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/40">
                  Players
                </div>
              </div>

              <div>
                <div className="font-serif text-2xl">01</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/40">
                  Shared mystery
                </div>
              </div>

              <div>
                <div className="font-serif text-2xl">∞</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/40">
                  Possibilities
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-8 rounded-full bg-[#8f83ad]/10 blur-3xl" />

            <div className="relative aspect-[4/5] overflow-hidden border border-white/15 bg-gradient-to-br from-[#29273b] via-[#171b29] to-[#0c1018]">
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at 50% 20%, #a99bbd55, transparent 45%), linear-gradient(145deg, transparent 40%, #090b12 100%)",
                }}
              />

              <div className="absolute left-1/2 top-[18%] h-40 w-40 -translate-x-1/2 rounded-full border border-[#d7c8e0]/20 bg-[#c8bad8]/10 blur-[1px]" />
              <div className="absolute left-1/2 top-[22%] h-28 w-28 -translate-x-1/2 rounded-full border border-[#e8dcec]/30" />

              <div className="absolute bottom-0 left-[12%] h-[48%] w-[76%] border-x border-t border-white/20 bg-gradient-to-b from-[#9c91ad]/20 to-[#0b0e17]">
                <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
                <div className="absolute left-0 top-[38%] h-px w-full bg-white/15" />
                <div className="absolute left-[12%] top-[38%] h-[62%] w-[30%] border border-white/10 bg-[#a99bbd]/10" />
                <div className="absolute right-[12%] top-[38%] h-[62%] w-[30%] border border-white/10 bg-[#a99bbd]/10" />
              </div>

              <div className="absolute left-6 top-6 text-[9px] uppercase tracking-[0.3em] text-white/50">
                Case No. 001
              </div>

              <div className="absolute bottom-8 left-8 right-8">
                <div className="mb-3 text-[9px] uppercase tracking-[0.35em] text-[#c4b5d8]">
                  The first mystery
                </div>

                <h2 className="font-serif text-4xl italic">
                  The Missing Guest
                </h2>

                <p className="mt-3 max-w-xs text-xs leading-6 text-white/55">
                  One hotel. One vanished guest. And a night nobody remembers
                  the same way.
                </p>

                <div className="mt-6 h-px w-full bg-white/20" />

                <div className="mt-3 flex justify-between text-[9px] uppercase tracking-[0.2em] text-white/40">
                  <span>Something is missing</span>
                  <span>01 / 01</span>
                </div>
              </div>
            </div>

            <div className="absolute -right-5 top-1/3 hidden border border-white/15 bg-[#171824]/90 px-4 py-3 text-[9px] uppercase tracking-[0.2em] text-white/60 sm:block">
              <span className="mr-2 text-[#c4b5d8]">✧</span>
              Nothing is as it seems
            </div>
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-3 border-t border-white/10 py-6 text-[9px] uppercase tracking-[0.25em] text-white/35 sm:flex-row">
          <span>An experience built on what we don't know</span>
          <span>Think together. Question everything.</span>
        </footer>
      </div>
    </main>
  );
}

