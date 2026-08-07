# SIH Portal - Technical Data & Features Report

This report outlines the complete data schema currently fetched by the application, outstanding feature gaps yet to be developed in the Admin Panel, and the list of structural/functional updates made to the frontend (excluding theme colors).

---

## 1. Data Schema & Supabase Fetches
The frontend communicates with the database using the following table queries:

| Database Table | Fetched Fields | Purpose in Application |
| :--- | :--- | :--- |
| **`profiles`** | `id`, `name`, `register_no`, `email`, `phone`, `department`, `year`, `section`, `gender`, `languages`, `linkedin`, `project_type`, `project_title`, `project_description`, `google_drive_ppt`, `youtube_link`, `software_domain`, `hardware_domain`, `github`, `role`, `verified` | * Profile view & registration validation.<br>* Admin students grid verification check.<br>* Dashboard profile information card. |
| **`teams`** | `id`, `name`, `leader_id`, `problem_id`, `theme_id`, `created_at` | * Lists all current hackathon teams in the dashboard and admin tabs. |
| **`team_members`** | `id`, `team_id`, `member_id`, `joined_at` | * Maps student accounts to their assigned teams. |
| **`problems`** | `id`, `theme_id`, `title`, `category`, `description` | * Lists selected hackathon problem statements. |
| **`themes`** | `id`, `name`, `slug` | * Tracks broad hackathon domains (e.g. Smart Vehicles, Healthcare). |
| **`invites`** | `id`, `team_id`, `sender_id`, `invitee_id`, `kind`, `status`, `created_at` | * Handles team join requests and peer invites. |
| **`timeline_events`** | `id`, `step`, `date`, `label`, `description`, `status`, `sort_order` | * Feeds the interactive timeline milestones. |
| **`announcements`** | `id`, `content`, `active` | * Displays global admin announcements at the top of the portal. |

---

## 2. Outstanding Gaps in the Admin Panel (To Be Built)
The following administrative features should be built next to provide a production-ready dashboard:

1. **Mentor Team Matchmaker Tool (Auto-assignment UI)**:
   * A button/panel in the "Teams" tab that triggers a backend matching script to automatically cluster unassigned students into teams of 6, checking compliance with constraints (2 departments, at least 2 female members).
2. **Direct Member Management (Add/Remove Students)**:
   * Currently, administrators can only delete teams entirely. The panel needs a dialog to add or remove individual students from teams manually.
3. **Excel/CSV Data Export**:
   * A button to download the registered students roster (`profiles`) and finalized groups roster (`teams`) as a structured `.xlsx` or `.csv` spreadsheet file for submittal to the SIH national coordinators.
4. **Registration Analytics Visualizations**:
   * Charts/graphs showing registration rates grouped by engineering department, year of study (I-IV), and project type (Software vs. Hardware).
5. **Portal Submission Toggle (State Controller)**:
   * A master toggle to shut down or reopen student registration inputs when the registration deadline is met.

---

## 3. Structural & Functional Frontend Modifications
*Excluding theme color changes, the following functional updates were implemented:*

### Timeline Section:
* **Layout Narrowing**: Confined the key dates list from a wide grid to a centered `max-w-4xl` desktop timeline sheet to improve layout symmetry.
* **Scroll Entry Animations**: Added an `IntersectionObserver` scroll wrapper (`TimelineItem`) to animate card entry reveals sequentially.

### Input Components:
* **Dropdown Down-Arrow Icon**: Refactored the `<Select>` dropdown tag to be wrapped inside a relative div block and appended an absolute down-arrow SVG icon.

### Registration Form:
* **Automatic Credentials**: Re-engineered signup flow to assign the student's Register Number as their account password.
* **Dynamic Validation Fields**: Implemented layout filters that toggle input fields (e.g. GitHub Repository, Hardware Domain, YouTube demonstration links) based on selected project type steps.

### Main Background:
* **Orb Containment**: Restructured viewport ambient blur orb coordinates to fix overflow clipping by anchoring coordinates strictly to edge constraints (`-25vw`).
* **Grayscale Banner Overlay**: Embedded the college banner image as a static asset, styled with a grayscale filter and a vertical gradient mask to fade out at `85vh` when scrolling.
