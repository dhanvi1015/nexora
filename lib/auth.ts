
import { supabase } from "./supabase";

export async function ensureAnonymousUser() {
  // Check whether this player already has a session
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (sessionData.session) {
    return sessionData.session.user;
  }

  // Create a temporary anonymous account
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) throw error;

  return data.user;
}
