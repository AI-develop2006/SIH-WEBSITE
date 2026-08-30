-- Migration: Create metadata tables (departments, ministries, roles) and seed default entries

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed departments
INSERT INTO public.departments (name, code) VALUES
  ('Computer Science and Engineering', 'CSE'),
  ('Information Technology', 'IT'),
  ('Artificial Intelligence and Data Science', 'AI&DS'),
  ('Civil Engineering', 'CIVIL'),
  ('Mechanical Engineering', 'MECH'),
  ('Instrumentation and Control Engineering', 'ICE'),
  ('Computer Science and Engineering and Business Systems', 'CSEBS'),
  ('Computer and Communication Engineering', 'CCE'),
  ('Mechatronics', 'MCTR'),
  ('Electrical and Electronics Engineering', 'EEE'),
  ('Electronics and Communication Engineering', 'ECE'),
  ('BioMedical Engineering', 'BME'),
  ('Master of Computer Applications', 'MCA'),
  ('Master of Business Administration', 'MBA')
ON CONFLICT (name) DO NOTHING;

-- 2. Ministries Table
CREATE TABLE IF NOT EXISTS public.ministries (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_outdated BOOLEAN DEFAULT FALSE,
  is_new BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed ministries
INSERT INTO public.ministries (name, is_outdated, is_new) VALUES
  ('Ministry of Development of North Eastern Region (MoDoNER)', FALSE, FALSE),
  ('Ministry of Fisheries, Animal Husbandry & Dairying', FALSE, FALSE),
  ('Ministry of Railways', FALSE, FALSE),
  ('Ministry of Ayush', FALSE, FALSE),
  ('Ministry of Corporate Affairs (MoCA)', TRUE, FALSE),
  ('Ministry of Earth Sciences (MoES)', FALSE, FALSE),
  ('Ministry of Consumer Affairs, Food & Public Distribution', FALSE, FALSE),
  ('Ministry of Social Justice & Empowerment (MoSJE)', FALSE, FALSE),
  ('Ministry of Jal Shakti (MoJS)', TRUE, FALSE),
  ('Ministry of Mines', TRUE, FALSE),
  ('Ministry of Youth Affairs and Sports', TRUE, FALSE),
  ('Ministry of Tribal Affairs (MoTA)', TRUE, FALSE),
  ('Ministry of Agriculture & Farmers Welfare (MoA&FW)', TRUE, FALSE),
  ('Ministry of Coal (MoC)', FALSE, FALSE),
  ('Ministry of Defence (MoD)', FALSE, FALSE),
  ('Ministry of Steel (MoS)', FALSE, FALSE),
  ('Ministry of Power (MoP)', TRUE, FALSE),
  ('Ministry of Home Affairs (MHA)', FALSE, FALSE),
  ('Ministry of Skill Development & Entrepreneurship (MSDE)', TRUE, FALSE),
  ('Ministry of Science and Technology', TRUE, FALSE),
  ('Ministry of Education (MoE)', TRUE, FALSE),
  ('Government of Punjab', TRUE, FALSE),
  ('Government of Jharkhand', FALSE, FALSE),
  ('Government of Odisha', TRUE, FALSE),
  ('Government of Sikkim', TRUE, FALSE),
  ('Government of Kerala', TRUE, FALSE),
  ('Government of Jammu and Kashmir', TRUE, FALSE),
  ('Government of Rajasthan', TRUE, FALSE),
  ('Government of Gujarat', TRUE, FALSE),
  ('Government of Chhattisgarh', TRUE, FALSE),
  ('AICTE', FALSE, FALSE),
  ('National Technical Research Organisation (NTRO)', FALSE, FALSE),
  ('Indian Space Research Organisation (ISRO)', FALSE, FALSE),
  ('Bharat Electronics Limited (BEL)', FALSE, FALSE),
  ('Autodesk', FALSE, FALSE),
  ('MathWorks India Pvt. Ltd.', FALSE, FALSE),
  ('Neilsoft Ltd.', TRUE, FALSE),
  ('Ministry of Rural Development', FALSE, TRUE),
  ('Ministry of MSME', FALSE, TRUE),
  ('Ministry of Cooperation', FALSE, TRUE),
  ('Ministry of Petroleum & Natural Gas', FALSE, TRUE),
  ('Ministry of Statistics and Programme Implementation (MoSPI)', FALSE, TRUE),
  ('Defence Research and Development Organisation (DRDO)', FALSE, TRUE),
  ('Government of Maharashtra', FALSE, TRUE),
  ('Mangalore Refinery and Petrochemicals Limited (MRPL)', FALSE, TRUE),
  ('Oil India Limited', FALSE, TRUE),
  ('Qualcomm Inc', FALSE, TRUE),
  ('Egreen Quanta', FALSE, TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3. Roles / Skills Table
CREATE TABLE IF NOT EXISTS public.roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT roles_name_category_key UNIQUE (name, category)
);

-- Seed roles
INSERT INTO public.roles (name, category) VALUES
  ('IoT & Sensors', 'Hardware'),
  ('Embedded Systems & Microcontrollers', 'Hardware'),
  ('Circuit Design & PCB Layout', 'Hardware'),
  ('Smart Automation & Industrial Control', 'Hardware'),
  ('Robotics & Drones', 'Hardware'),
  ('Edge AI & Hardware AI', 'Hardware'),
  ('Frontend Development', 'Software'),
  ('Backend Development', 'Software'),
  ('AI / Machine Learning', 'Software'),
  ('Cybersecurity / Blockchain', 'Software'),
  ('Full Stack Development', 'Software'),
  ('Cloud / DevOps', 'Software'),
  ('Mobile App Development', 'Software'),
  ('Business Analysis & Documentation', 'Other'),
  ('UI/UX Design', 'Other'),
  ('Project Management', 'Other'),
  ('Data Analysis & Visualization', 'Other'),
  ('Research & Innovation', 'Other')
ON CONFLICT (name, category) DO NOTHING;
