"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { CONDITION_OPTIONS, FAMILY_USER, REPORTS, patientById } from "@/wardvoice/data";
import { FamilyEmail } from "@/wardvoice/FamilyEmail";
import { FamilyShell } from "@/wardvoice/FamilyShell";
import { Card, Chip, conditionTone } from "@/wardvoice/ui";

export default function FamilyUpdates() {
	const patient = patientById(FAMILY_USER.patient_id);
	const mine = REPORTS.filter((r) => r.patient_id === FAMILY_USER.patient_id && r.status === "sent").sort((a, b) =>
		b.date.localeCompare(a.date),
	);
	const [open, setOpen] = useState<string | null>(null);

	return (
		<FamilyShell>
			<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[40px]">Daily updates</h1>
			<p className="mt-2 text-sm text-wv-muted">Every update is reviewed and signed by {patient?.name.split(" ")[0]}'s doctor.</p>

			<ol className="relative mt-6 space-y-4 before:absolute before:bottom-4 before:left-[22px] before:top-4 before:w-px before:bg-wv-line">
				{mine.map((r, i) => (
					<li key={r.id} className="relative pl-14">
						<span
							className={cn(
								"absolute left-[14px] top-6 h-4 w-4 rounded-full ring-4 ring-wv-page",
								i === 0 ? "bg-wv-blue" : "bg-wv-line",
							)}
						/>
						<button type="button" className="block w-full text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
							<Card className="p-5">
								<div className="flex items-center justify-between">
									<p className="text-sm font-medium">
										{new Date(r.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
									</p>
									<Chip tone={conditionTone(r.condition)} dot>
										{CONDITION_OPTIONS.find((c) => c.value === r.condition)?.family}
									</Chip>
								</div>
								<p className="mt-2 line-clamp-2 text-sm text-wv-muted">{r.family_note}</p>
								<p className="mt-3 text-xs font-medium text-wv-blue">{open === r.id ? "Hide email" : "Open full update"}</p>
							</Card>
						</button>
						{open === r.id && (
							<div className="mt-3">
								<FamilyEmail report={r} recipientName={FAMILY_USER.name.split(" ")[0]} />
							</div>
						)}
					</li>
				))}
			</ol>
		</FamilyShell>
	);
}
