import { Button } from "@/components/unlumen-ui/button";
import { Avatar } from "@/components/unlumen-ui/avatar";

export function StudentDetailModal({
  student,
  onClose,
  isAssigned,
  onAssign,
}) {
  if (!student) return null;

  const ensureHttp = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  };

  const languagesList = Array.isArray(student.languages)
    ? student.languages.join(", ")
    : student.language || student.languages_known || null;

  const softwareDomains = Array.isArray(student.software_domain)
    ? student.software_domain
    : typeof student.software_domain === "string"
    ? student.software_domain.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const hardwareDomains = Array.isArray(student.hardware_domain)
    ? student.hardware_domain
    : typeof student.hardware_domain === "string"
    ? student.hardware_domain.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border/80 bg-[#0a0f1d] p-6 sm:p-8 shadow-2xl text-left z-[100000] space-y-6 scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

        {/* Header & Close Button */}
        <div className="flex items-start justify-between border-b border-border/20 pb-4 gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={student.name} src={student.avatar_url ?? undefined} className="size-12 sm:size-16 text-base sm:text-lg ring-2 ring-[#c9a227]/50 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">{student.name}</h3>
                {isAssigned ? (
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-400 shrink-0">
                    Assigned to Team
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 shrink-0">
                    Available for Team
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <span className="font-mono text-slate-300 font-semibold">{student.register_no || "N/A"}</span>
                {" · "}<span className="text-slate-300 font-semibold">{student.department || "N/A"}</span>
                {" · "}Yr {student.year || "N/A"}{student.section ? ` (${student.section} Sec)` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Comprehensive Academic & Personal Info Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
            Personal & Academic Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-card/40 p-4 rounded-2xl border border-border/30">
            <div>
              <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">College Email</span>
              <a href={`mailto:${student.email}`} className="text-[#93c5fd] hover:underline font-mono truncate block" title={student.email}>
                {student.email || "—"}
              </a>
            </div>
            <div>
              <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">Phone Number</span>
              <span className="text-slate-200 font-medium">{student.phone ? `📞 ${student.phone}` : "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">Register Number</span>
              <span className="text-slate-200 font-mono font-medium">{student.register_no || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">Department & Year</span>
              <span className="text-slate-200 font-medium">{student.department || "—"} {student.year ? `(Yr ${student.year})` : ""}</span>
            </div>
            <div>
              <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">Section</span>
              <span className="text-slate-200 font-medium">{student.section ? `Section ${student.section}` : "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">Gender</span>
              <span className="text-slate-200 font-medium">{student.gender || "—"}</span>
            </div>
            {languagesList && (
              <div className="sm:col-span-2 md:col-span-3 border-t border-border/20 pt-2 mt-1">
                <span className="text-muted-foreground font-bold uppercase text-[10px] block mb-0.5">Languages Known</span>
                <span className="text-slate-200 font-medium">{languagesList}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Technical Domain Interests & Specializations */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
            Technical Domains & Specializations
          </h4>
          
          {student.domain_interests && student.domain_interests.length > 0 && (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1.5">Domain Interests</span>
              <div className="flex flex-wrap gap-1.5">
                {student.domain_interests.map((domain) => (
                  <span key={domain} className="rounded-lg bg-[#c9a227]/10 border border-[#c9a227]/30 px-2.5 py-1 text-xs font-semibold text-[#e8c058]">
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {softwareDomains.length > 0 && (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1.5">Software Domain Expertise</span>
              <div className="flex flex-wrap gap-1.5">
                {softwareDomains.map((sd) => (
                  <span key={sd} className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 text-xs font-medium text-blue-300">
                    💻 {sd}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hardwareDomains.length > 0 && (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1.5">Hardware Domain Expertise</span>
              <div className="flex flex-wrap gap-1.5">
                {hardwareDomains.map((hd) => (
                  <span key={hd} className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-300">
                    ⚡ {hd}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Proposed Project Details */}
        {(student.project_type || student.project_title || student.project_description) && (
          <div className="space-y-3 bg-muted/10 p-4.5 rounded-2xl border border-border/30">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
                Proposed Hackathon Project Details
              </h4>
              {student.project_type && (
                <span className="rounded-full bg-[#c9a227]/20 border border-[#c9a227]/40 px-3 py-0.5 text-xs font-bold text-[#e8c058]">
                  Type: {student.project_type}
                </span>
              )}
            </div>

            {student.project_title && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Project Title</span>
                <p className="text-sm font-extrabold text-white mt-0.5">{student.project_title}</p>
              </div>
            )}
            {student.project_description && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Project Summary</span>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{student.project_description}</p>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Portfolios, Resumes & Deliverable Links */}
        {(student.github || student.github_repo || student.youtube_link || student.google_drive_ppt || student.linkedin || student.resume) && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
              Profiles, Resume & Deliverable Links
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {student.resume && (
                <a
                  href={ensureHttp(student.resume)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition font-bold"
                >
                  <span>📄 Resume Document</span>
                </a>
              )}
              {student.linkedin && (
                <a
                  href={ensureHttp(student.linkedin)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition font-bold"
                >
                  <span>🔗 LinkedIn Profile</span>
                </a>
              )}
              {student.github && (
                <a
                  href={ensureHttp(student.github)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 bg-card/60 text-slate-200 hover:border-[#c9a227] hover:text-white transition"
                >
                  <span>🐙 GitHub Profile</span>
                </a>
              )}
              {student.github_repo && (
                <a
                  href={ensureHttp(student.github_repo)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 bg-card/60 text-slate-200 hover:border-[#c9a227] hover:text-white transition"
                >
                  <span>💻 Code Repository</span>
                </a>
              )}
              {student.google_drive_ppt && (
                <a
                  href={ensureHttp(student.google_drive_ppt)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 bg-card/60 text-slate-200 hover:border-[#c9a227] hover:text-white transition"
                >
                  <span>📊 Presentation Deck (PPT)</span>
                </a>
              )}
              {student.youtube_link && (
                <a
                  href={ensureHttp(student.youtube_link)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 bg-card/60 text-slate-200 hover:border-[#c9a227] hover:text-white transition"
                >
                  <span>▶ Demo Video</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Section 5: SIH Past Participation History */}
        {student.sih_participant && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a227]">
                Past SIH Participation History
              </h4>
              {student.sih_num_participations && (
                <span className="text-[11px] font-bold text-[#e8c058]">
                  Participated {student.sih_num_participations} time(s)
                </span>
              )}
            </div>

            {student.sih_history && student.sih_history.length > 0 ? (
              <div className="space-y-2">
                {student.sih_history.map((hist, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-[#c9a227]/30 bg-[#c9a227]/5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>SIH {hist.year} · {hist.project_domain || "Domain N/A"}</span>
                      <span className="text-[#e8c058] rounded bg-[#c9a227]/20 border border-[#c9a227]/40 px-2 py-0.5 text-[10px]">
                        {hist.position_reached || "Participated"}
                      </span>
                    </div>
                    {hist.problem_statement && (
                      <p className="text-slate-300 text-[11px]">
                        <span className="text-muted-foreground font-semibold">Problem Statement:</span> {hist.problem_statement}
                      </p>
                    )}
                    {hist.project_role && (
                      <p className="text-slate-300 text-[11px]">
                        <span className="text-muted-foreground font-semibold">Role:</span> {hist.project_role}
                      </p>
                    )}
                    {hist.nodal_center && (
                      <p className="text-slate-300 text-[11px]">
                        <span className="text-muted-foreground font-semibold">Nodal Center:</span> {hist.nodal_center}
                      </p>
                    )}
                    {hist.certificate_link && (
                      <a
                        href={ensureHttp(hist.certificate_link)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#93c5fd] hover:underline mt-1"
                      >
                        📄 View Certificate
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Student indicated past SIH participation.</p>
            )}
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-border/20 pt-4 mt-6">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Close Profile
          </Button>

          {!isAssigned && onAssign && (
            <Button
              onClick={() => {
                onClose();
                onAssign(student);
              }}
              className="bg-[#c9a227] text-black font-bold text-xs hover:bg-[#e8c058] px-5 py-2"
            >
              + Add {student.name.split(" ")[0]} to Team
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
