"use client";

import { Activity, Droplets, HeartPulse, PhoneCall, Stethoscope, Thermometer } from "lucide-react";

import { CONDITION_OPTIONS, FAMILY_USER, REPORTS, VITAL_META, formatVital, patientById, vitalInRange } from "@/wardvoice/data";
import { FamilyShell } from "@/wardvoice/FamilyShell";
import { Card, Chip, VitalRow, conditionTone } from "@/wardvoice/ui";

export default function FamilyHome() {
	const patient = patientById(FAMILY_USER.patient_id);
	const latest = REPORTS.filter((r) => r.patient_id === FAMILY_USER.patient_id && r.status === "sent").sort((a, b) =>
		b.date.localeCompare(a.date),
	)[0];
	if (!patient || !latest) return <FamilyShell>No updates yet.</FamilyShell>;

	const first = patient.name.split(" ")[0];
	const cond = CONDITION_OPTIONS.find((c) => c.value === latest.condition);
	const rows = [
		{ k: "hr" as const, icon: <HeartPulse className="h-6 w-6" /> },
		{ k: "bp" as const, icon: <Droplets className="h-6 w-6" /> },
		{ k: "spo2" as const, icon: <Activity className="h-6 w-6" /> },
		{ k: "temp_c" as const, icon: <Thermometer className="h-6 w-6" /> },
	];

	return (
		<FamilyShell>
			<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-[40px]">How is {first} today?</h1>

			<Card className="mt-6 overflow-hidden p-0">
				<div className="flex items-center gap-4 p-5">
					<span className="grid h-14 w-14 place-items-center rounded-[18px] bg-wv-blue text-white shadow-wv-blue">
						<Stethoscope className="h-6 w-6" />
					</span>
					<div className="mr-auto">
						<p className="text-sm text-wv-muted">
							Bed {patient.bed} · {patient.ward}
						</p>
						<p className="text-xl font-medium tracking-tight">{patient.name}</p>
					</div>
					<Chip tone={conditionTone(latest.condition)} dot>
						{cond?.family}
					</Chip>
				</div>
				{latest.family_note && (
					<blockquote className="mx-2 mb-2 rounded-[22px] bg-white p-4 text-sm leading-relaxed shadow-wv-sm">
						<p className="mb-1 text-xs font-semibold text-wv-blue">Note from {latest.signed_by}</p>
						{latest.family_note}
					</blockquote>
				)}
			</Card>

			<div className="mb-3 mt-7 flex items-center justify-between">
				<h2 className="text-lg font-medium">Today's readings</h2>
				<Chip tone="blue" dot>
					Signed {latest.signed_at}
				</Chip>
			</div>
			<div className="space-y-3">
				{rows.map((r, i) => {
					const ok = vitalInRange(r.k, latest.vitals);
					return (
						<VitalRow
							key={r.k}
							icon={r.icon}
							label={VITAL_META[r.k].label}
							value={formatVital(r.k, latest.vitals)}
							unit={VITAL_META[r.k].unit}
							trend={patient.trend[r.k]}
							highlight={i === 0}
							outOfRange={ok === false}
							trailing={
								<Chip tone={ok ? "green" : "amber"} dot>
									{ok ? "Normal" : "Watching"}
								</Chip>
							}
						/>
					);
				})}
			</div>

			<h2 className="mb-3 mt-7 text-lg font-medium">Plan for today</h2>
			<Card className="space-y-2 p-5">
				{latest.plan.map((p) => (
					<p key={p} className="flex gap-3 text-sm">
						<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-wv-blue" />
						{p}
					</p>
				))}
			</Card>

			<Card className="mt-4 flex items-center gap-4 p-5">
				<span className="grid h-12 w-12 place-items-center rounded-full bg-wv-blue-soft text-wv-blue">
					<PhoneCall className="h-5 w-5" />
				</span>
				<div className="text-sm">
					<p className="font-medium">Questions?</p>
					<p className="text-wv-muted">Ward 4B desk · +91 80 4000 1234 (8 am–8 pm)</p>
				</div>
			</Card>
		</FamilyShell>
	);
}
