
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom, GameMode } from "../../lib/rooms";

export default function PlayPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<GameMode>("collective");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setError("");

    if (name.trim().length < 2) {
      setError("Please enter a name with at least 2 characters.");
      return;
    }

    try {
      setLoading(true);
      const room = await createRoom(name.trim(), mode);

      sessionStorage.setItem("nexora_room", JSON.stringify(room));
      sessionStorage.setItem("nexora_name", name.trim());

      router.push(`/lobby?room=${room.room_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError("");

    if (name.trim().length < 2) {
      setError("Please enter a name with at least 2 characters.");
      return;
    }

    if (code.trim().length !== 6) {
      setError("Please enter a valid 6-character room code.");
      return;
    }

    try {
      setLoading(true);
      const room = await joinRoom(code.trim(), name.trim());

      sessionStorage.setItem("nexora_room", JSON.stringify(room));
      sessionStorage.setItem("nexora_name", name.trim());

      router.push(`/lobby?room=${room.room_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#111018] text-[#f4eee7] px-6 py-12">
      <div className="max-w-xl mx-auto">
        <a href="/" className="text-sm text-[#c7a9bd] hover:text-white">
          ← Back to NEXORA
        </a>

        <div className="mt-12 mb-10">
          <p className="text-xs tracking-[0.35em] text-[#c7a9bd]">
            ENTER THE UNKNOWN
          </p>
          <h1 className="text-5xl font-serif mt-4">Your story begins here.</h1>
          <p className="text-white/50 mt-4">
            Create a private investigation or join your friends.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <label className="block text-sm mb-2 text-white/70">
            Your detective name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Enter your name"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-4 py-3 outline-none focus:border-[#c7a9bd]"
          />

          <div className="mt-7">
            <p className="text-sm text-white/70 mb-3">Choose your experience</p>

            <button
              type="button"
              onClick={() => setMode("collective")}
              className={`w-full text-left p-4 rounded-xl border mb-3 ${
                mode === "collective"
                  ? "border-[#c7a9bd] bg-[#c7a9bd]/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <span className="block font-semibold">THE COLLECTIVE</span>
              <span className="text-sm text-white/50">
                Every detective works together.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode("deception")}
              className={`w-full text-left p-4 rounded-xl border ${
                mode === "deception"
                  ? "border-[#c7a9bd] bg-[#c7a9bd]/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <span className="block font-semibold">THE DECEPTION</span>
              <span className="text-sm text-white/50">
                One player has a secret agenda.
              </span>
            </button>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full mt-7 rounded-lg bg-[#d8bdce] text-[#17121a] font-semibold py-3 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create a room"}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-xs text-white/40">OR JOIN FRIENDS</span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <label className="block text-sm mb-2 text-white/70">
            Room code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="E.G. A7K2PQ"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-4 py-3 tracking-[0.25em] outline-none focus:border-[#c7a9bd]"
          />

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full mt-3 rounded-lg border border-white/20 py-3 hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Join room"}
          </button>

          {error && (
            <p className="mt-5 text-sm text-red-300">{error}</p>
          )}
        </div>
      </div>
    </main>
  );
}

