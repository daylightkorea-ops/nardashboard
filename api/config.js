// GET /api/config — public values the browser needs to sign in.
// The anon key is designed to be public; Row Level Security protects the data.
import { env } from "../lib/server.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ supabaseUrl: env("SUPABASE_URL"), supabaseAnonKey: env("SUPABASE_ANON_KEY") });
}
