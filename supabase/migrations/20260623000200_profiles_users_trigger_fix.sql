-- Keep the legacy `profiles` table and app `users` table in sync for auth signups.

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text DEFAULT '',
  preferred_language text DEFAULT 'en' CHECK (preferred_language IN ('en', 'es', 'fr')),
  role text DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO users (id, email, full_name, preferred_language, role, created_at)
SELECT id, email, COALESCE(full_name, ''), COALESCE(preferred_language, 'en'), COALESCE(role, 'student'), COALESCE(created_at, now())
FROM profiles
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  preferred_language = EXCLUDED.preferred_language,
  role = EXCLUDED.role;

INSERT INTO profiles (id, email, full_name, preferred_language, role, created_at)
SELECT id, email, COALESCE(full_name, ''), COALESCE(preferred_language, 'en'), COALESCE(role, 'student'), COALESCE(created_at, now())
FROM users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  preferred_language = EXCLUDED.preferred_language,
  role = EXCLUDED.role,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  display_name text;
BEGIN
  display_name := COALESCE(new.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, display_name)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, display_name)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
