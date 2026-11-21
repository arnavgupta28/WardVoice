"use client";

import { MailCheck, PhoneCall, ShieldOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { CONDITION_OPTIONS, REPORTS, labelOf, patientById } from "@/wardvoice/data";
import { DoctorShell } from "@/wardvoice/DoctorShell";
import { FamilyEmail } from "@/wardvoice/FamilyEmail";
import type { ReportStatus } from "@/wardvoice/types";
import { Card, Chip, conditionTone } from "@/wardvoice/ui";

const STATUS: Record<ReportStatus, { label: string; tone: "green" | "amber" | "neutral"; icon: React.ReactNode }> = {
	sent: { label: "Emailed", tone: "green", icon: <MailCheck className="h-4 w-4" /> },
	held_call_family: { label: "Held · call family", tone: "amber", icon: <PhoneCall className="h-4 w-4" /> },
	no_consent: { label: "No consent on file", tone: "neutral", icon: <ShieldOff className="h-4 w-4" /> },
};

export default function ReportsPage() {
	const [selected, setSelected] = useState(REPORTS.find((r) => r.status === "sent")?.id ?? REPORTS[0].id);
	const report = REPORTS.find((r) => r.id === selected) ?? REPORTS[0];
	const patient = patientById(report.patient_id);

	return (
		<DoctorShell>
			<div className="mb-6">
				<h1 className="text-[40px] font-medium leading-tight tracking-[-0.03em]">Family reports</h1>
				<p className="text-wv-muted">Generated automatically after each sign-off. Only consented family members receive them.</p>
			</div>
			<div className="grid gap-6 lg:grid-cols-[1fr_480px]">
				<div className="space-y-3">
					{REPORTS.map((r) => {
						const p = patientById(r.patient_id);
						const st = STATUS[r.status];
						return (
							<button key={r.id} type="button" onClick={() => setSelected(r.id)} className="block w-full text-left">
								<Card className={cn("flex flex-wrap items-center gap-4 p-4 transition", r.id === selected && "ring-2 ring-wv-blue")}>
									<span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-wv-blue shadow-wv-sm">{st.icon}</span>
									<div className="mr-auto min-w-0">
										<p className="font-medium">
											{p?.name} <span className="text-sm font-normal text-wv-muted">· Bed {p?.bed}</span>
										</p>
										<p className="text-xs text-wv-muted">
											{new Date(r.date).toDateString()} · signed {r.signed_at} by {r.signed_by}
										</p>
									</div>
									<Chip tone={conditionTone(r.condition)} dot>
										{labelOf(CONDITION_OPTIONS, r.condition)}
									</Chip>
									<Chip tone={st.tone}>{st.label}</Chip>
								</Card>
							</button>
						);
					})}
				</div>
				<div className="lg:sticky lg:top-6 lg:self-start">
					{report.status === "sent" ? (
						<FamilyEmail report={report} recipientName={patient?.family.find((f) => f.consent)?.name.split(" ")[0]} />
					) : (
						<Card className="p-6">
							<p className="text-lg font-medium">{STATUS[report.status].label}</p>
							<p className="mt-2 text-sm text-wv-muted">
								{report.status === "no_consent"
									? `${patient?.name}'s family hasn't consented to email updates, so this report stays internal. Ask the family at the next visit.`
									: "Condition needs a personal conversation. The email was withheld and the family was added to your call list."}
							</p>
						</Card>
					)}
				</div>
			</div>
		</DoctorShell>
	);
}
