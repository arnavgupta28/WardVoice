"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { CONDITION_OPTIONS, FAMILY_USER } from "@/wardvoice/data";
import { FamilyEmail } from "@/wardvoice/FamilyEmail";
import { AppScreen, Sheet } from "@/wardvoice/Phone";
import { useWard } from "@/wardvoice/store";
import { Card, Chip, conditionTone } from "@/wardvoice/ui";

export default function FamilyUpdates() {
	const { state } = useWard(2000);
	const patient = state?.patients.find((p) => p.id === FAMILY_USER.patient_id);
	const mine = (state?.reports ?? [])
		.filter((r) => r.patient_id === FAMILY_USER.patient_id && r.status === "sent")
		.sort((a, b) => b.date.localeCompare(a.date) || b.signed_at.localeCompare(a.signed_at));
	const [open, setOpen] = useState<string | null>(null);
	const report = mine.find((r) => r.id === open);

	const overlay = report ? (
		<Sheet label="Daily update" onClose={() => setOpen(null)}>
			<FamilyEmail report={report} recipientName={FAMILY_USER.name.split(" ")[0]} />
		</Sheet>
	) : null;

	return (
		<AppScreen role="family" name={FAMILY_USER.name} overlay={overlay}>
			<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">Daily updates</h1>
			<p className="mt-2 text-sm text-wv-muted">Each one is reviewed and signed by {patient?.name.split(" ")[0]}'s doctor.</p>

			<ol className="relative mt-6 space-y-3 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-px before:bg-wv-line">
				{mine.map((r, i) => (
					<li key={r.id} className="relative pl-10">
						<span className={cn("absolute left-[8px] top-6 h-4 w-4 rounded-full ring-4 ring-wv-page", i === 0 ? "bg-wv-blue" : "bg-wv-line")} />
						<button type="button" className="block w-full text-left" onClick={() => setOpen(r.id)}>
							<Card className="p-4">
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-medium">
										{r.date === state?.today ? "Today" : new Date(r.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
									</p>
									<Chip tone={conditionTone(r.condition)} dot>
										{CONDITION_OPTIONS.find((c) => c.value === r.condition)?.family}
									</Chip>
								</div>
								<p className="mt-2 line-clamp-2 text-sm text-wv-muted">{r.family_note}</p>
								<p className="mt-2 text-xs font-medium text-wv-blue">Open full update</p>
							</Card>
						</button>
					</li>
				))}
			</ol>
		</AppScreen>
	);
}
