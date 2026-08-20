-- Backfill team_code for existing teams that have created_by_dept set
-- but are missing a proper dept-based team_code.
--
-- This assigns sequential codes like "AI&DS#001", "CSE#002", etc.
-- using a window function ordered by creation time (id) within each dept.
--
-- Teams without created_by_dept are left as-is (they will be handled
-- by the backend backfill API which can infer dept from member records).

-- Map full dept names to short codes
CREATE OR REPLACE FUNCTION _dept_code(dept text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE lower(trim(dept))
      WHEN 'computer science and engineering'                      THEN 'CSE'
      WHEN 'information technology'                               THEN 'IT'
      WHEN 'artificial intelligence and data science'             THEN 'AI&DS'
      WHEN 'civil engineering'                                    THEN 'CIVIL'
      WHEN 'mechanical engineering'                               THEN 'MECH'
      WHEN 'instrumentation and control engineering'              THEN 'ICE'
      WHEN 'computer science and engineering and business systems' THEN 'CSEBS'
      WHEN 'computer and communication engineering'               THEN 'CCE'
      WHEN 'mechatronics'                                         THEN 'MCTR'
      WHEN 'electrical and electronics engineering'               THEN 'EEE'
      WHEN 'electronics and communication engineering'            THEN 'ECE'
      WHEN 'biomedical engineering'                               THEN 'BME'
      WHEN 'master of computer applications'                      THEN 'MCA'
      WHEN 'master of business administration'                    THEN 'MBA'
      ELSE upper(regexp_replace(trim(dept), '\s+', '', 'g'))
    END
  $$;

-- Backfill: assign dept-based sequential team_code to teams that either
--   (a) have no team_code, or
--   (b) have an old generic code (starts with 'SIH' — the old trigger format)
-- Only processes teams that have a created_by_dept value.
WITH ranked AS (
  SELECT
    id,
    created_by_dept,
    category,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(created_by_dept))
      ORDER BY id
    ) AS rn
  FROM public.teams
  WHERE
    created_by_dept IS NOT NULL
    AND created_by_dept <> ''
    AND (
      team_code IS NULL
      OR team_code = ''
      OR team_code ILIKE 'SIH%'
    )
)
UPDATE public.teams t
SET team_code = CASE
    WHEN lower(t.category) = 'solo'
      THEN _dept_code(r.created_by_dept) || '-SOLO#' || lpad(r.rn::text, 3, '0')
    ELSE
      _dept_code(r.created_by_dept) || '#' || lpad(r.rn::text, 3, '0')
  END
FROM ranked r
WHERE t.id = r.id;
