export type Dahora = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string | null;
};

export type Wave = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string | null;
};

export type Presence = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string | null;
};

export type Fan = {
  id: string;
  profile_id: string;
  fan_user_id: string;
  created_at: string | null;
};

export type Select = {
  id: string;
  profile_id: string;
  selected_user_id: string;
  created_at: string | null;
};