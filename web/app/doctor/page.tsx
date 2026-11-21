"use client";

import { ArrowUpRight, BedDouble, Mic } from "lucide-react";
import Link from "next/link";

import { CONDITION_OPTIONS, DOCTOR, labelOf } from "@/wardvoice/data";
import { AppScreen } from "@/wardvoice/Phone";
import { useWard } from "@/wardvoice/store";
import { Card, Chip, PillButton, conditionTone } from "@/wardvoice/ui";

export default function DoctorHome() {
	const { state, live } = useWard(2000);
	const patients = state?.patients ?? [];
	const records = state?.records ?? {};
	const signed = patients.filter((p) => records[p.id]?.status === "signed").length;
	const next = patients.find((p) => records[p.id]?.status !== "signed") ?? patients[0];
	const sentToday = state?.reports.filter((r) => r.date === state.today && r.status === "sent").length ?? 0;

	return (
		<AppScreen role="doctor" name={DOCTOR.name} subtitle={DOCTOR.ward}>
			<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">
				Ready for
				<br />
				your round?
			</h1>
			<p className="mt-2 text-sm text-wv-muted">Keep your gloves on. Say the bed number to begin.</p>

			<Card className="mt-5 p-3">
				<div className="flex items-center gap-2">
					<span className="flex h-12 flex-1 items-center gap-2 rounded-full bg-white px-4 text-sm shadow-wv-sm">
						<span className="font-semibold">{signed}</span>
						<span className="text-wv-muted">of {patients.length} signed</span>
					</span>
					<span className="flex h-12 flex-1 items-center gap-2 rounded-full bg-white px-4 text-sm shadow-wv-sm">
						<span className="font-semibold">{sentToday}</span>
						<span className="text-wv-muted">updates sent</span>
					</span>
				</div>
				{next && (
					<PillButton variant="primary" href={`/doctor/round/${next.id}`} className="mt-3 w-full" icon={<Mic className="h-5 w-5" />}>
						Start round · Bed {next.bed}
					</PillButton>
				)}
			</Card>

			<div className="mb-3 mt-7 flex items-center justify-between">
				<h2 className="text-base font-medium">Today's patients</h2>
				{live === false ? (
					<Chip tone="amber" dot>
						Offline demo
					</Chip>
				) : (
					<Chip tone="blue" dot>
						Live
					</Chip>
				)}
			</div>

			<div className="space-y-3">
				{patients.map((p) => {
					const r = records[p.id];
					return (
						<Link key={p.id} href={`/doctor/round/${p.id}`} className="block">
							<Card className="flex items-center gap-3 p-3 pr-3 active:scale-[0.99]">
								<span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white text-wv-blue shadow-wv-sm">
									<span className="flex flex-col items-center leading-none">
										<BedDouble className="h-4 w-4" />
										<span className="mt-1 text-sm font-semibold text-wv-ink">{p.bed}</span>
									</span>
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{p.name}</p>
									<p className="truncate text-xs text-wv-muted">{p.diagnosis}</p>
									<div className="mt-1.5 flex gap-1.5">
										{r?.status === "signed" ? (
											<Chip tone="green" dot>
												Signed {r.signed_at}
											</Chip>
										) : r?.status === "draft" ? (
											<Chip tone="amber" dot>
												In progress
											</Chip>
										) : (
											<Chip>Not started</Chip>
										)}
										{r?.condition && <Chip tone={conditionTone(r.condition)}>{labelOf(CONDITION_OPTIONS, r.condition)}</Chip>}
									</div>
								</div>
								<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wv-blue text-white">
									<ArrowUpRight className="h-5 w-5" />
								</span>
							</Card>
						</Link>
					);
				})}
			</div>

			<Card className="mt-5 flex items-center gap-3 bg-wv-blue p-4 text-white">
				<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
					<Mic className="h-4 w-4" />
				</span>
				<p className="text-xs leading-relaxed text-white/90">
					Try: <span className="font-semibold text-white">"Bed 12. Pulse 88, BP 124 over 78, sats 96. He's improving."</span>
				</p>
			</Card>
		</AppScreen>
	);
}
