export const DEPARTMENTS = [
  "Computer Science and Engineering",
  "Information Technology",
  "Artificial Intelligence and Data Science",
  "Civil Engineering",
  "Mechanical Engineering",
  "Instrumentation and Control Engineering",
  "Computer Science and Engineering and Business Systems",
  "Computer and Communication Engineering",
  "Mechatronics",
  "Electrical and Electronics Engineering",
  "Electronics and Communication Engineering",
  "BioMedical Engineering",
  "Master of Computer Applications",
  "Master of Business Administration",
];

export const MINISTRIES = [
  "Ministry of Development of North Eastern Region (MoDoNER)",
  "Ministry of Fisheries, Animal Husbandry & Dairying",
  "Ministry of Railways",
  "Ministry of Ayush",
  "Ministry of Corporate Affairs (MoCA)",
  "Ministry of Earth Sciences (MoES)",
  "Ministry of Consumer Affairs, Food & Public Distribution",
  "Ministry of Social Justice & Empowerment (MoSJE)",
  "Ministry of Jal Shakti (MoJS)",
  "Ministry of Mines",
  "Ministry of Youth Affairs and Sports",
  "Ministry of Tribal Affairs (MoTA)",
  "Ministry of Agriculture & Farmers Welfare (MoA&FW)",
  "Ministry of Coal (MoC)",
  "Ministry of Defence (MoD)",
  "Ministry of Steel (MoS)",
  "Ministry of Power (MoP)",
  "Ministry of Home Affairs (MHA)",
  "Ministry of Skill Development & Entrepreneurship (MSDE)",
  "Ministry of Science and Technology",
  "Ministry of Education (MoE)",
  "Government of Punjab",
  "Government of Jharkhand",
  "Government of Odisha",
  "Government of Sikkim",
  "Government of Kerala",
  "Government of Jammu and Kashmir",
  "Government of Rajasthan",
  "Government of Gujarat",
  "Government of Chhattisgarh",
  "AICTE",
  "National Technical Research Organisation (NTRO)",
  "Indian Space Research Organisation (ISRO)",
  "Bharat Electronics Limited (BEL)",
  "Autodesk",
  "MathWorks India Pvt. Ltd.",
  "Neilsoft Ltd.",
];

export const MAX_MEMBERS_PER_MINISTRY_PER_DEPT = 6;

/**
 * Short department codes used as prefixes in team IDs.
 * e.g. "Artificial Intelligence and Data Science" → "AI&DS"
 * Maps canonical full name → abbreviation.
 */
export const DEPT_CODE = {
  "Computer Science and Engineering": "CSE",
  "Information Technology": "IT",
  "Artificial Intelligence and Data Science": "AI&DS",
  "Civil Engineering": "CIVIL",
  "Mechanical Engineering": "MECH",
  "Instrumentation and Control Engineering": "ICE",
  "Computer Science and Engineering and Business Systems": "CSEBS",
  "Computer and Communication Engineering": "CCE",
  "Mechatronics": "MCTR",
  "Electrical and Electronics Engineering": "EEE",
  "Electronics and Communication Engineering": "ECE",
  "BioMedical Engineering": "BME",
  "Master of Computer Applications": "MCA",
  "Master of Business Administration": "MBA",
};

export const YEARS = ["I", "II", "III", "IV"];

export const CATEGORIES = ["Pairs", "Solo"];

export const LANGUAGE_OPTIONS = ["English", "Hindi"];

export const PROJECT_TYPES = ["Hardware", "Software", "Hardware & Software"];

export const HARDWARE_ROLES = [
  "IoT & Sensors",
  "Embedded Systems & Microcontrollers",
  "Circuit Design & PCB Layout",
  "Smart Automation & Industrial Control",
  "Robotics & Drones",
  "Edge AI & Hardware AI",
];

export const SOFTWARE_ROLES = [
  "Frontend Development",
  "Backend Development",
  "AI / Machine Learning",
  "Cybersecurity / Blockchain",
  "Full Stack Development",
  "Cloud / DevOps",
  "Mobile App Development",
];

export const OTHER_ROLES = [
  "Business Analysis & Documentation",
  "UI/UX Design",
  "Project Management",
  "Data Analysis & Visualization",
  "Research & Innovation",
];
