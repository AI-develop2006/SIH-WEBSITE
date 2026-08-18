import { Button } from "@/components/unlumen-ui/button";
import { DEPARTMENTS } from "@/lib/constants";

export function EditProfileModal({
  showProfileModal,
  setShowProfileModal,
  profileForm,
  setProfileForm,
  busyAssign,
  handleProfileSubmit,
}) {
  if (!showProfileModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-[#0a0f18] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-border/10 pb-4 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-white">
              Edit Mentor Profile
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Update your coordinator profile information</p>
          </div>
          <button
            type="button"
            onClick={() => setShowProfileModal(false)}
            className="text-muted-foreground hover:text-white font-extrabold text-xl p-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {/* Name Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajan"
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-border/60 bg-[#0c1424] px-4 py-2.5 text-sm text-white focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] outline-none"
            />
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Email Address</label>
            <input
              type="email"
              placeholder="Enter your real email address"
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-xl border border-border/60 bg-[#0c1424] px-4 py-2.5 text-sm text-white focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] outline-none"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              If left blank, a fallback email linked to your phone number will be used.
            </p>
          </div>

          {/* Phone Field (Read-only) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Mobile Number</label>
            <input
              type="text"
              disabled
              value={profileForm.phone}
              className="w-full rounded-xl border border-border/40 bg-[#0c1424]/40 px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed outline-none"
            />
            <p className="text-[9px] text-amber-500/80 font-medium">
              * Mobile number cannot be modified as it is your login identifier.
            </p>
          </div>

          {/* Domain Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Evaluation Domain</label>
            <select
              value={profileForm.domain}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, domain: e.target.value }))}
              className="w-full rounded-xl border border-border/60 bg-[#0c1424] px-4 py-2.5 text-sm text-white focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] outline-none"
            >
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Hardware & Software">Hardware & Software</option>
            </select>
          </div>

          {/* Department Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Department</label>
            <select
              value={profileForm.department}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, department: e.target.value }))}
              className="w-full rounded-xl border border-border/60 bg-[#0c1424] px-4 py-2.5 text-sm text-white focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227] outline-none"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Footer Controls */}
          <div className="flex justify-end gap-2 border-t border-border/10 pt-4 mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowProfileModal(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busyAssign}
              className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058]"
            >
              Save Profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
