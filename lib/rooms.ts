
import { supabase } from "./supabase";
import { ensureAnonymousUser } from "./auth";

export type GameMode = "collective" | "deception";

export type RoomResult = {
  room_id: string;
  player_id: string;
  code: string;
  mode: GameMode;
  status: string;
};

export async function createRoom(
  displayName: string,
  mode: GameMode
): Promise<RoomResult> {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("create_room", {
    p_display_name: displayName,
    p_mode: mode,
  });

  if (error) throw error;

  return data as RoomResult;
}

export async function joinRoom(
  code: string,
  displayName: string
): Promise<RoomResult> {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("join_room", {
    p_code: code,
    p_display_name: displayName,
  });

  if (error) throw error;

  return data as RoomResult;
}
