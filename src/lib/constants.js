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
  "Ministry of Rural Development",
  "Ministry of MSME",
  "Ministry of Cooperation",
  "Ministry of Petroleum & Natural Gas",
  "Ministry of Statistics and Programme Implementation (MoSPI)",
  "Defence Research and Development Organisation (DRDO)",
  "Government of Maharashtra",
  "Mangalore Refinery and Petrochemicals Limited (MRPL)",
  "Oil India Limited",
  "Qualcomm Inc",
  "Egreen Quanta",
];

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

// A final SPOC team has exactly 6 members
export const SPOC_TEAM_SIZE = 6;
export const SPOC_MIN_FEMALE = 2;
export const SPOC_MIN_DEPTS = 2;

/**
 * Ministries that are in our codebase but NOT present in the
 * official SIH_2026_Problem_Statements.xlsx — tagged as outdated.
 */
export const OUTDATED_MINISTRIES = new Set([
  "Ministry of Corporate Affairs (MoCA)",
  "Ministry of Jal Shakti (MoJS)",
  "Ministry of Mines",
  "Ministry of Youth Affairs and Sports",
  "Ministry of Tribal Affairs (MoTA)",
  "Ministry of Agriculture & Farmers Welfare (MoA&FW)",
  "Ministry of Power (MoP)",
  "Ministry of Skill Development & Entrepreneurship (MSDE)",
  "Ministry of Science and Technology",
  "Ministry of Education (MoE)",
  "Government of Punjab",
  "Government of Odisha",
  "Government of Sikkim",
  "Government of Kerala",
  "Government of Jammu and Kashmir",
  "Government of Rajasthan",
  "Government of Gujarat",
  "Government of Chhattisgarh",
  "Neilsoft Ltd.",
]);

/**
 * Ministries newly added from the official SIH 2026 Problem Statements.
 * These are valid targets for team assignment — tagged "New" so mentors,
 * participants, and admins know they were recently introduced.
 */
export const NEW_MINISTRIES = new Set([
  "Ministry of Rural Development",
  "Ministry of MSME",
  "Ministry of Cooperation",
  "Ministry of Petroleum & Natural Gas",
  "Ministry of Statistics and Programme Implementation (MoSPI)",
  "Defence Research and Development Organisation (DRDO)",
  "Government of Maharashtra",
  "Mangalore Refinery and Petrochemicals Limited (MRPL)",
  "Oil India Limited",
  "Qualcomm Inc",
  "Egreen Quanta",
]);

/**
 * The effective active ministry count:
 * total ministries minus outdated ones (which are no longer valid targets).
 * Use this everywhere instead of MINISTRIES.length for display purposes.
 */
export const ACTIVE_MINISTRIES_COUNT = MINISTRIES.length - OUTDATED_MINISTRIES.size;
