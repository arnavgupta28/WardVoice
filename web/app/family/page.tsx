"use client";

import { Activity, Droplets, HeartPulse, PhoneCall, Stethoscope, Thermometer } from "lucide-react";

import { CONDITION_OPTIONS, FAMILY_USER, VITAL_META, formatVital, vitalInRange } from "@/wardvoice/data";
import { CareBadge, EcgLine, OrganFigure, organFor } from "@/wardvoice/figures";
import { AppScreen } from "@/wardvoice/Phone";
import { useWard } from "@/wardvoice/store";
import { Card, Chip, VitalRow, conditionTone } from "@/wardvoice/ui";

export default function FamilyHome() {
	const { state } = useWard(2000);
	const patient = state?.patients.find((p) => p.id === FAMILY_USER.patient_id);
	const latest = state?.reports
		.filter((r) => r.patient_id === FAMILY_USER.patient_id && r.status === "sent")
		.sort((a, b) => b.date.localeCompare(a.date) || b.signed_at.localeCompare(a.signed_at))[0];
	const isToday = latest?.date === state?.today;

	const rows = [
		{ k: "hr" as const, icon: <HeartPulse className="h-6 w-6" /> },
		{ k: "bp" as const, icon: <Droplets className="h-6 w-6" /> },
		{ k: "spo2" as const, icon: <Activity className="h-6 w-6" /> },
		{ k: "temp_c" as const, icon: <Thermometer className="h-6 w-6" /> },
	];

	return (
		<AppScreen role="family" name={FAMILY_USER.name}>
			{!patient || !latest ? (
				<p className="text-sm text-wv-muted">No updates yet.</p>
			) : (
				<>
					<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">
						How is {patient.name.split(" ")[0]}
						<br />
						today?
					</h1>

					<div className="mt-5 flex items-center gap-2 rounded-full bg-wv-card p-1.5 shadow-wv-sm">
						<span className="flex h-11 flex-1 items-center gap-2 rounded-full bg-white px-4 text-sm shadow-wv-sm">
							<Stethoscope className="h-4 w-4 text-wv-blue" /> Bed {patient.bed}
						</span>
						<span className="flex h-11 flex-1 items-center justify-center rounded-full bg-white px-3 text-sm shadow-wv-sm">
							<Chip tone={conditionTone(latest.condition)} dot className="bg-transparent px-0">
								{CONDITION_OPTIONS.find((c) => c.value === latest.condition)?.family}
							</Chip>
						</span>
						<a href="tel:+918040001234" aria-label="Call ward desk" className="grid h-11 w-11 place-items-center rounded-full bg-wv-blue text-white shadow-wv-blue">
							<PhoneCall className="h-4 w-4" />
						</a>
					</div>

					<Card className="relative mt-4 overflow-hidden p-0">
						<div className="relative grid h-[200px] place-items-center bg-gradient-to-b from-white to-wv-card">
							<OrganFigure diagnosis={patient.diagnosis} className="h-[170px] w-auto motion-safe:animate-[wv-bob_5s_ease-in-out_infinite]" />
							<span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-wv-muted shadow-wv-sm">
								Focus of care · {organFor(patient.diagnosis).label}
							</span>
							<EcgLine className="absolute inset-x-0 bottom-2 h-8 text-wv-blue" />
						</div>
						<div className="flex items-center gap-3 p-4">
							<CareBadge className="h-11 w-11 shrink-0" />
							<p className="text-sm leading-snug">
								<span className="font-medium">{patient.diagnosis}.</span>{" "}
								<span className="text-wv-muted">The care team updates you here after every ward round.</span>
							</p>
						</div>
					</Card>

					{latest.family_note && (
						<Card className="mt-4 p-4">
							<p className="mb-1 text-xs font-semibold text-wv-blue">Note from {latest.signed_by}</p>
							<p className="text-sm leading-relaxed">{latest.family_note}</p>
							<p className="mt-2 text-[11px] text-wv-muted">
								{isToday ? "Today" : new Date(latest.date).toLocaleDateString(undefined, { weekday: "long" })} · signed {latest.signed_at}
							</p>
						</Card>
					)}

					<div className="mb-3 mt-6 flex items-center justify-between">
						<h2 className="text-base font-medium">Your father's condition</h2>
						<Chip tone="blue" dot>
							{isToday ? "Today" : "Latest"}
						</Chip>
					</div>
					<div className="space-y-2.5">
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

					{latest.plan.length > 0 && (
						<>
							<h2 className="mb-3 mt-6 text-base font-medium">Plan for today</h2>
							<Card className="space-y-2 p-4">
								{latest.plan.map((p) => (
									<p key={p} className="flex gap-3 text-sm">
										<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-wv-blue" />
										{p}
									</p>
								))}
							</Card>
						</>
					)}
				</>
			)}
		</AppScreen>
	);
}
