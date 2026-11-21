"use client";

import { ArrowUpRight, BedDouble, Mic } from "lucide-react";
import Link from "next/link";

import { CONDITION_OPTIONS, DOCTOR, PATIENTS, REPORTS, SAMPLE_RECORD, labelOf } from "@/wardvoice/data";
import { DoctorShell } from "@/wardvoice/DoctorShell";
import type { RecordStatus } from "@/wardvoice/types";
import { Card, Chip, PillButton, conditionTone, greeting } from "@/wardvoice/ui";

// Today's status per bed (mock until /ward/state is live).
const TODAY: Record<string, { status: RecordStatus; condition: (typeof CONDITION_OPTIONS)[number]["value"] | null; time?: string }> = {
	P1: { status: SAMPLE_RECORD.status, condition: SAMPLE_RECORD.condition },
	P2: { status: "signed", condition: "stable", time: "09:24" },
	P3: { status: "signed", condition: "improving", time: "09:12" },
};

export default function DoctorHome() {
	const signed = Object.values(TODAY).filter((t) => t.status === "signed").length;
	const next = PATIENTS.find((p) => TODAY[p.id]?.status !== "signed") ?? PATIENTS[0];
	const sentToday = REPORTS.filter((r) => r.date === "2026-11-21" && r.status === "sent").length;

	return (
		<DoctorShell>
			<div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
				<Card className="flex flex-col justify-between gap-8 p-7">
					<div>
						<p className="text-sm text-wv-muted">
							{greeting()}, {DOCTOR.name.split(" ").slice(0, 2).join(" ")}
						</p>
						<h1 className="mt-2 max-w-lg text-[40px] font-medium leading-[1.05] tracking-[-0.03em] md:text-5xl">
							Ready for your ward round?
						</h1>
						<p className="mt-3 max-w-md text-wv-muted">
							Say the bed number to begin. Keep your gloves on. Every value is read back before it's saved.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<PillButton variant="primary" href={`/doctor/round/${next.id}`} icon={<Mic className="h-5 w-5" />}>
							Start voice round · Bed {next.bed}
						</PillButton>
						<Chip tone="blue" dot>
							Agora voice · Murf Falcon
						</Chip>
					</div>
				</Card>

				<div className="grid grid-cols-2 gap-4">
					<Card className="p-6">
						<p className="text-sm text-wv-muted">Round progress</p>
						<p className="mt-2 text-5xl font-medium tracking-tight">
							{signed}
							<span className="text-2xl text-wv-muted">/{PATIENTS.length}</span>
						</p>
						<div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
							<div className="h-full rounded-full bg-wv-blue" style={{ width: `${(signed / PATIENTS.length) * 100}%` }} />
						</div>
						<p className="mt-2 text-xs text-wv-muted">patients signed</p>
					</Card>
					<Card className="p-6">
						<p className="text-sm text-wv-muted">Family updates</p>
						<p className="mt-2 text-5xl font-medium tracking-tight">{sentToday}</p>
						<p className="mt-4 text-xs text-wv-muted">emails sent today, automatically after sign-off</p>
					</Card>
					<Card className="col-span-2 flex items-center gap-4 bg-wv-blue p-6 text-white">
						<span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20">
							<Mic className="h-5 w-5" />
						</span>
						<p className="text-sm leading-relaxed text-white/90">
							Try: <span className="font-semibold text-white">"Bed 12. Pulse 88, BP 124 over 78, sats 96. He's improving."</span>
						</p>
					</Card>
				</div>
			</div>

			<div className="mb-3 mt-8 flex items-center justify-between">
				<h2 className="text-lg font-medium">Today's patients</h2>
				<Chip tone="blue" dot>
					{DOCTOR.ward}
				</Chip>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				{PATIENTS.map((p) => {
					const t = TODAY[p.id];
					return (
						<Link key={p.id} href={`/doctor/round/${p.id}`} className="group">
							<Card className="flex h-full flex-col gap-5 p-5 transition group-hover:-translate-y-0.5">
								<div className="flex items-start justify-between">
									<span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-wv-sm">
										<BedDouble className="h-4 w-4 text-wv-blue" aria-hidden /> Bed {p.bed}
									</span>
									{t.status === "signed" ? (
										<Chip tone="green" dot>
											Signed {t.time}
										</Chip>
									) : t.status === "draft" ? (
										<Chip tone="amber" dot>
											In progress
										</Chip>
									) : (
										<Chip>Not started</Chip>
									)}
								</div>
								<div>
									<p className="text-xl font-medium tracking-tight">{p.name}</p>
									<p className="text-sm text-wv-muted">
										{p.age} {p.sex} · {p.mrn}
									</p>
									<p className="mt-2 text-sm">{p.diagnosis}</p>
								</div>
								<div className="mt-auto flex items-center justify-between">
									{t.condition ? (
										<Chip tone={conditionTone(t.condition)} dot>
											{labelOf(CONDITION_OPTIONS, t.condition)}
										</Chip>
									) : (
										<span />
									)}
									<span className="grid h-11 w-11 place-items-center rounded-full bg-wv-blue text-white transition group-hover:rotate-45">
										<ArrowUpRight className="h-5 w-5" aria-hidden />
									</span>
								</div>
							</Card>
						</Link>
					);
				})}
			</div>
		</DoctorShell>
	);
}
