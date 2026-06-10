import type { ThemeId } from "./theme";

export type Profile = {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: ThemeId | string | null;
  aura: string | null;
  state?: string | null;
  city?: string | null;
  country?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy_meters?: number | null;
  geolocation_permission?: "unknown" | "granted" | "denied" | "unavailable";
  geolocation_consent_at?: string | null;
  geolocation_denied_at?: string | null;
  biological_sex?: "male" | "female" | "intersex" | "prefer_not_to_say" | null;
  profile_required_completed?: boolean;
  created_at: string | null;
  updated_at: string | null;
};
