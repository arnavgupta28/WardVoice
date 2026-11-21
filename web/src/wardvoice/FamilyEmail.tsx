import { CONDITION_OPTIONS, VITAL_META, formatVital, patientById, vitalInRange } from "./data";
import type { FamilyReport } from "./types";
import { Chip, conditionTone } from "./ui";

/** Visual twin of the HTML email the backend sends (server renders the same template). */
export function FamilyEmail({ report, recipientName }: { report: FamilyReport; recipientName?: string }) {
	const patient = patientById(report.patient_id);
	const first = patient?.name.split(" ")[0] ?? "your relative";
	const cond = CONDITION_OPTIONS.find((c) => c.value === report.condition);
	const keys = ["hr", "bp", "temp_c", "spo2"] as const;

	return (
		<article className="overflow-hidden rounded-[24px] bg-white text-wv-ink shadow-wv">
			<div className="border-b border-wv-line px-5 py-3 text-xs text-wv-muted">
				<p>
					<span className="font-medium text-wv-ink">From:</span> WardVoice · Ward 4B &lt;updates@wardvoice.demo&gt;
				</p>
				<p>
					<span className="font-medium text-wv-ink">To:</span> {report.recipients.join(", ") || "—"}
				</p>
				<p>
					<span className="font-medium text-wv-ink">Subject:</span> Daily update for {patient?.name}: {cond?.family}
				</p>
			</div>
			<div className="bg-wv-blue px-6 py-6 text-white">
				<p className="text-sm text-white/75">Daily update · {new Date(report.date).toDateString()}</p>
				<p className="mt-1 text-2xl font-medium tracking-tight">How {first} is doing today</p>
			</div>
			<div className="space-y-5 px-6 py-6">
				<p className="text-sm">Dear {recipientName ?? "family"},</p>
				<div className="flex items-center gap-3">
					<span className="text-sm text-wv-muted">Overall</span>
					<Chip tone={conditionTone(report.condition)} dot>
						{cond?.family}
					</Chip>
				</div>
				<div className="grid grid-cols-2 gap-3">
					{keys.map((k) => {
						const ok = vitalInRange(k, report.vitals);
						return (
							<div key={k} className="rounded-2xl bg-wv-card p-3">
								<p className="text-xs text-wv-muted">{VITAL_META[k].label}</p>
								<p className="text-lg font-semibold">
									{formatVital(k, report.vitals)}
									<span className="ml-1 text-xs font-normal text-wv-muted">{VITAL_META[k].unit}</span>
								</p>
								<p className={ok ? "text-xs text-[#0B7A47]" : "text-xs text-[#9A5B00]"}>
									{ok ? "In the normal range" : "Being watched closely"}
								</p>
							</div>
						);
					})}
				</div>
				{report.plan.length > 0 && (
					<div>
						<p className="mb-2 text-sm font-semibold">Plan for today</p>
						<ul className="space-y-1.5 text-sm">
							{report.plan.map((p) => (
								<li key={p} className="flex gap-2">
									<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-wv-blue" />
									{p}
								</li>
							))}
						</ul>
					</div>
				)}
				{report.family_note && (
					<blockquote className="rounded-2xl bg-wv-blue-soft p-4 text-sm leading-relaxed">
						<p className="mb-1 text-xs font-semibold text-wv-blue">A note from {report.signed_by}</p>
						{report.family_note}
					</blockquote>
				)}
				<p className="text-xs text-wv-muted">
					Reviewed and signed by {report.signed_by} at {report.signed_at}. For questions, call the ward desk at +91 80 4000 1234.
					This update is shared only with family members the patient has consented to.
				</p>
				<span className="inline-flex rounded-full bg-wv-blue px-5 py-2.5 text-sm font-medium text-white">View in family portal</span>
			</div>
		</article>
	);
}
