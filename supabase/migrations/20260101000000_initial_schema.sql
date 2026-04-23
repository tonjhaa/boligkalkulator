-- ============================================================
-- Min Økonomi — initial databaseskjema
-- Opprettet: 2026-01-01 (rekonstruert fra eksisterende database)
-- ============================================================

-- Tabell: user_data
-- Lagrer all økonomidata som én JSON-blob per bruker.
-- Enkel og effektiv for single-user-app, men betyr at all data
-- hentes og skrives i sin helhet ved hver synk.

CREATE TABLE IF NOT EXISTS public.user_data (
  user_id   uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  economy_data jsonb,
  updated_at   timestamptz DEFAULT now()
);

-- Row Level Security: brukere kan kun lese/skrive sin egen rad
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kun egen data"
  ON public.user_data
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indeks på user_id (er allerede PK, men eksplisitt for klarhet)
-- CREATE INDEX IF NOT EXISTS user_data_user_id_idx ON public.user_data(user_id);

-- Trigger: oppdater updated_at automatisk ved upsert
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER user_data_updated_at
  BEFORE UPDATE ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
