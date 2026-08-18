-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if needed, or allow read access
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to everyone
DROP POLICY IF EXISTS "Allow public read system_settings" ON public.system_settings;
CREATE POLICY "Allow public read system_settings" ON public.system_settings
  FOR SELECT USING (true);

-- Policy to allow full control to authenticated users / service role
DROP POLICY IF EXISTS "Allow all for authenticated system_settings" ON public.system_settings;
CREATE POLICY "Allow all for authenticated system_settings" ON public.system_settings
  FOR ALL USING (true);

-- Insert default registration_control row if not exists
INSERT INTO public.system_settings (key, value)
VALUES (
  'registration_control',
  '{"manual_status": "open", "closing_date": null, "closing_message": "Registration for SIH Internal Hackathon 2026 is currently closed."}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
