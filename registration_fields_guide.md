# Dynamic Registration Form: Fields & Replication Prompt

This document provides a complete reference of the registration fields and a high-fidelity prompt that you can copy and paste into any AI coding assistant (like Gemini, Claude, Cursor, or v0) to replicate this exact registration form on another system or codebase.

---

## 1. Complete Field Schema

### Section 1: Basic Information (Common for all users)
*   **NAME** — Short Text (Required, capitalized input: e.g. `NAVEEN K`).
*   **REGISTER NO** — Short Text (Required, uppercase input: e.g. `711522CS001`).
*   **PHONE NO.** — Short Text (Required, 10-digit number validation).
*   **EMAIL** — Short Text (Required, email format validation, used for account setup/login).
*   **Department** — Dropdown Selection (Required). Options:
    *   *Computer Science and Engineering*
    *   *Information Technology*
    *   *Artificial Intelligence and Data Science*
    *   *Civil Engineering*
    *   *Mechanical Engineering*
    *   *Instrumentation and Control Engineering*
    *   *Computer Science and Engineering and Business Systems*
    *   *Computer and Communication Engineering*
    *   *Mechatronics*
    *   *Electrical and Electronics Engineering*
    *   *Electronics and Communication Engineering*
    *   *BioMedical Engineering*
    *   *Master of Computer Applications*
    *   *Master of Business Administration*
*   **YEAR** — Dropdown Selection (Required). Options: `I`, `II`, `III`, `IV`.
*   **SECTION** — Short Text (Required, capitalized input: e.g. `A`).
*   **GENDER** — Dropdown Selection (Required). Options: `Male`, `Female`.
*   **LANGUAGE KNOWN** — Checkbox Options (Required). Options: `English`, `Hindi`.
*   **LINKEDIN PROFILE URL** — URL Link (Required, format: `https://www.linkedin.com/in/...`).
*   **SELECT PROJECT TYPE** — Button / Radio Selection (Required). Options: `Hardware`, `Software`, `Both`.

---

## Section 2: Hardware (Shown only if Project Type is "Hardware")
*   **PROJECT TITLE** — Short Text (Required).
*   **PROJECT BRIEF DESCRIPTION** — Long Text / Textarea (Required).
*   **GITHUB PROFILE LINK** — URL Link (Optional).
*   **YOUTUBE (Unlisted)** — URL Link (Optional).
*   **DOMAIN** — Dropdown Selection (Required). Options:
    *   *IoT & Sensors*
    *   *Embedded Systems & Microcontrollers*
    *   *Circuit Design & PCB Layout*
    *   *Smart Automation & Industrial Control*
    *   *Robotics & Drones*
*   **GOOGLE DRIVE LINK FOR PPT** — URL Link (Required, shared as public).

---

## Section 3: Software (Shown only if Project Type is "Software")
*   **PROJECT TITLE** — Short Text (Required).
*   **PROJECT BRIEF DESCRIPTION** — Long Text / Textarea (Required).
*   **GITHUB PROFILE LINK** — URL Link (Required).
*   **DOMAIN** — Dropdown Selection (Required). Options:
    *   *Frontend*
    *   *Backend*
    *   *AI/ML*
    *   *Cybersecurity / Blockchain*
    *   *Full Stack*
    *   *Cloud / DevOps*
    *   *Mobile App Development*
*   **GOOGLE DRIVE LINK FOR PPT** — URL Link (Required, shared as public).
*   **GITHUB REPOSITORY LINK (describes your domain)** — URL Link (Required).

---

## Section 4: Both Hardware & Software (Shown only if Project Type is "Both")
*   **PROJECT TITLE** — Short Text (Required).
*   **PROJECT BRIEF DESCRIPTION** — Long Text / Textarea (Required).
*   **SOFTWARE DOMAIN** — Dropdown Selection (Required). Options:
    *   *Frontend*, *Backend*, *AI/ML*, *Cybersecurity / Blockchain*, *Full Stack*, *Cloud / DevOps*, *Mobile App Development*.
*   **HARDWARE DOMAIN** — Dropdown Selection (Required). Options:
    *   *IoT & Sensors*, *Embedded Systems & Microcontrollers*, *Circuit Design & PCB Layout*, *Smart Automation & Industrial Control*, *Robotics & Drones*.
*   **GITHUB REPOSITORY URL** — URL Link (Required).
*   **YOUTUBE (Unlisted)** — URL Link (Optional).
*   **GOOGLE DRIVE LINK FOR PPT** — URL Link (Required, shared as public).

---

## Section 5: Account & Review (Final Submission)
*   **Review Rows:** Renders a summary card of all submitted common fields and conditional project fields.
*   **Declaration Checkbox:**
    *   *Text:* "I hereby declare that all the information provided in this registration form is true, accurate, and complete. I understand that my Register Number will serve as my login password."
    *   *Required Check:* Form submission is blocked until this box is checked.
    *   *No Password Fields:* Standard password/confirm password input fields are removed. The system automatically sets the login password to the student's uppercase **Register Number** (e.g. `711522CS001`) behind the scenes.

---

## 2. Replication Prompt for other AI systems
*Copy and paste the block below into your AI assistant or IDE to implement this on a different codebase:*

```markdown
Modify the registration form wizard component to dynamically collect fields depending on the student's selected project type (Hardware, Software, or Both) and implement a passwordless declaration step.

Follow these rules:
1. Wizard Steps Structure:
   - Step 1: Personal details (Name, Register No, Phone No, Email).
   - Step 2: Academic details (Department, Year, Section, Gender).
   - Step 3: Skills & project type (Languages Known, LinkedIn URL, and Project Type buttons: Hardware / Software / Both).
   - Step 4 (Dynamic Project Step): Automatically injects a new step between Step 3 and the final step after a project type is selected:
     * If 'Hardware': Show Project Title, Description (textarea), GitHub Profile (optional URL), YouTube Link (optional URL), Hardware Domain dropdown (IoT & Sensors, Embedded Systems, Circuit Design, Smart Automation, Robotics), and Google Drive PPT Link (required URL).
     * If 'Software': Show Project Title, Description (textarea), GitHub Profile (required URL), Software Domain dropdown (Frontend, Backend, AI/ML, Cybersecurity/Blockchain, Full Stack, Cloud/DevOps, Mobile Apps), Google Drive PPT Link (required URL), and GitHub Repo Link (required URL).
     * If 'Both': Show Project Title, Description (textarea), Software Domain dropdown, Hardware Domain dropdown, GitHub Repo Link (required URL), YouTube Link (optional URL), and Google Drive PPT Link (required URL).
   - Step 5 (Final Step): Account & Review. Renders a summary of all fields (Common & Project details) and displays a declaration checkbox: "I hereby declare that all the information provided in this registration form is true, accurate, and complete. I understand that my Register Number will serve as my login password."

2. Passwordless Authentication Logic:
   - Remove all password and confirm-password text fields from the UI.
   - For backend authentication (e.g. Supabase, Firebase, or Custom Auth), automatically set the user's password to their uppercase 'Register Number' (trimmed) during sign-up.

3. Validations:
   - Validate that required URLs start with http:// or https://.
   - Validate name is at least 3 chars and capitalized.
   - Validate 10-digit phone number.
   - Prevent wizard navigation to the next step if validation checks on the current step fail.

4. Database Integration:
   - Save the details in the user signup metadata object.
   - For database mappings:
     * Set 'domain' to the selected Hardware/Software domain, or join both together (e.g. 'Frontend & IoT & Sensors') if project type is 'Both'.
     * Set 'github' to the GitHub Profile URL (for Hardware/Software) or the GitHub Repository URL (for Both).
```
