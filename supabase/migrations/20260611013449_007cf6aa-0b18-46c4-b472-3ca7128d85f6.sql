ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_html text NOT NULL DEFAULT '';