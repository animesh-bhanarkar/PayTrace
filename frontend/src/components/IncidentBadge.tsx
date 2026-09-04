interface IncidentItem {
  incident_type: string;
  severity: string;
}

interface IncidentBadgeProps {
  incidents: IncidentItem[];
}

export default function IncidentBadge({ incidents }: IncidentBadgeProps) {
  if (!incidents || incidents.length === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        No incidents
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {incidents.map((inc, index) => {
        const sev = (inc.severity || "").toUpperCase();
        let colorClasses = "bg-slate-800 text-slate-300 border-slate-700";

        if (sev === "HIGH") {
          colorClasses = "bg-red-500/15 text-red-400 border-red-500/30";
        } else if (sev === "MEDIUM") {
          colorClasses = "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
        } else if (sev === "LOW") {
          colorClasses = "bg-slate-700/50 text-slate-300 border-slate-600";
        }

        return (
          <span
            key={`${inc.incident_type}-${index}`}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}
          >
            {inc.incident_type}
          </span>
        );
      })}
    </div>
  );
}
