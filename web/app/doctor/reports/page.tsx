"use client";

import { MailCheck, PhoneCall, ShieldOff } from "lucide-react";
import { useState } from "react";

import { CONDITION_OPTIONS, DOCTOR, labelOf } from "@/wardvoice/data";
import { FamilyEmail } from "@/wardvoice/FamilyEmail";
import { AppScreen, Sheet } from "@/wardvoice/Phone";
import { useWard } from "@/wardvoice/store";
import type { ReportStatus } from "@/wardvoice/types";
import { Card, Chip, conditionTone } from "@/wardvoice/ui";

const STATUS: Record<ReportStatus, { label: string; tone: "green" | "amber" | "neutral"; icon: React.ReactNode }> = {
	sent: { label: "Emailed", tone: "green", icon: <MailCheck className="h-5 w-5" /> },
	held_call_family: { label: "Call family", tone: "amber", icon: <PhoneCall className="h-5 w-5" /> },
	no_consent: { label: "No consent", tone: "neutral", icon: <ShieldOff className="h-5 w-5" /> },
};

export default function ReportsPage() {
	const { state } = useWard(2000);
	const [open, setOpen] = useState<string | null>(null);
	const reports = state?.reports ?? [];
	const report = reports.find((r) => r.id === open);
	const patientOf = (pid: string) => state?.patients.find((p) => p.id === pid);

	const overlay = report ? (
		<Sheet label="Report" onClose={() => setOpen(null)}>
			{report.status === "sent" ? (
				<FamilyEmail report={report} recipientName={patientOf(report.patient_id)?.family.find((f) => f.consent)?.name.split(" ")[0]} />
			) : (
				<Card className="p-5">
					<p className="text-lg font-medium">{STATUS[report.status].label}</p>
					<p className="mt-2 text-sm text-wv-muted">
						{report.status === "no_consent"
							? "The family hasn't consented to email updates, so this report stays internal."
							: "The condition needs a personal conversation. The email was withheld and the family was added to your call list."}
					</p>
				</Card>
			)}
		</Sheet>
	) : null;

	return (
		<AppScreen role="doctor" name={DOCTOR.name} subtitle={DOCTOR.ward} overlay={overlay}>
			<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">Family reports</h1>
			<p className="mt-2 text-sm text-wv-muted">Sent automatically after sign-off, only to consented family.</p>
			<div className="mt-5 space-y-3">
				{reports.map((r) => {
					const p = patientOf(r.patient_id);
					const st = STATUS[r.status];
					return (
						<button key={r.id} type="button" onClick={() => setOpen(r.id)} className="block w-full text-left">
							<Card className="flex items-center gap-3 p-3">
								<span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white text-wv-blue shadow-wv-sm">{st.icon}</span>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">
										{p?.name} <span className="text-xs font-normal text-wv-muted">· Bed {p?.bed}</span>
									</p>
									<p className="text-xs text-wv-muted">
										{new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · signed {r.signed_at}
									</p>
									<div className="mt-1.5 flex gap-1.5">
										<Chip tone={conditionTone(r.condition)}>{labelOf(CONDITION_OPTIONS, r.condition)}</Chip>
										<Chip tone={st.tone} dot>
											{st.label}
										</Chip>
									</div>
								</div>
							</Card>
						</button>
					);
				})}
			</div>
		</AppScreen>
	);
}
