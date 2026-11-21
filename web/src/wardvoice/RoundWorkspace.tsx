"use client";

import {
	Activity,
	ArrowLeft,
	Check,
	ChevronRight,
	Droplets,
	FlaskConical,
	Gauge,
	HeartPulse,
	Lock,
	Mic,
	Pencil,
	Pill,
	ShieldCheck,
	Thermometer,
	Trash2,
	Wind,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { CONDITION_OPTIONS, CONSCIOUSNESS_OPTIONS, DIET_OPTIONS, MOBILITY_OPTIONS, VITAL_META, formatVital, vitalInRange } from "./data";
import { OrganFigure } from "./figures";
import type { FieldState, Patient, RoundRecord, SectionKey, TranscriptLine, Vitals } from "./types";
import { Card, Chip, FieldStateBadge, IconButton, PillButton } from "./ui";

export type RoundActions = {
	confirmSection: (s: SectionKey) => void;
	setChoice: (field: "condition" | "consciousness" | "diet" | "mobility", value: string) => void;
	setVital: (key: keyof Vitals, value: number | null) => void;
	confirmOrder: (id: string) => void;
	removeOrder: (id: string) => void;
	setNote: (field: "clinical_note" | "family_note", value: string) => void;
	verifyIdentity: () => void;
	signAndSend: () => void;
};

const VITAL_ICONS: Record<keyof typeof VITAL_META, ReactNode> = {
	hr: <HeartPulse className="h-4 w-4" />,
	bp: <Droplets className="h-4 w-4" />,
	temp_c: <Thermometer className="h-4 w-4" />,
	spo2: <Activity className="h-4 w-4" />,
	rr: <Wind className="h-4 w-4" />,
	pain: <Gauge className="h-4 w-4" />,
};

const STEPS: { key: SectionKey | "sign"; label: string }[] = [
	{ key: "identity", label: "ID" },
	{ key: "vitals", label: "Vitals" },
	{ key: "status", label: "Status" },
	{ key: "orders", label: "Orders" },
	{ key: "notes", label: "Notes" },
	{ key: "sign", label: "Sign" },
];

export function canSign(r: RoundRecord) {
	return r.verified && (Object.keys(r.sections) as SectionKey[]).every((k) => r.sections[k] === "confirmed");
}

function Section({
	title,
	state,
	onConfirm,
	locked,
	children,
	aside,
}: {
	title: string;
	state: FieldState;
	onConfirm: () => void;
	locked: boolean;
	children: ReactNode;
	aside?: ReactNode;
}) {
	return (
		<Card
			className={cn(
				"p-4 transition",
				state === "confirmed" ? "ring-2 ring-wv-green/40" : state === "captured" ? "ring-2 ring-wv-amber/50" : "",
			)}
		>
			<div className="mb-3 flex items-center gap-2">
				<h3 className="mr-auto text-base font-medium tracking-tight">{title}</h3>
				{aside}
				<FieldStateBadge state={state} />
			</div>
			{children}
			{!locked && state === "captured" && (
				<button
					type="button"
					onClick={onConfirm}
					className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-wv-green text-sm font-medium text-white"
				>
					<Check className="h-4 w-4" /> Confirm {title.toLowerCase()}
				</button>
			)}
		</Card>
	);
}

function Choice<T extends string>({
	label,
	options,
	value,
	onChange,
	locked,
	tone,
}: {
	label: string;
	options: { value: T; label: string }[];
	value: T | null;
	onChange: (v: T) => void;
	locked: boolean;
	tone?: (v: T) => string;
}) {
	return (
		<div>
			<p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-wv-muted">{label}</p>
			<div className="flex flex-wrap gap-1.5">
				{options.map((o) => {
					const active = o.value === value;
					return (
						<button
							key={o.value}
							type="button"
							disabled={locked}
							onClick={() => onChange(o.value)}
							aria-pressed={active}
							className={cn(
								"h-9 rounded-full px-3.5 text-[13px] font-medium transition disabled:cursor-default",
								active ? (tone?.(o.value) ?? "bg-wv-blue text-white shadow-wv-blue") : "bg-white text-wv-muted shadow-wv-sm",
							)}
						>
							{o.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function VitalTile({
	k,
	vitals,
	locked,
	onSet,
}: {
	k: keyof typeof VITAL_META;
	vitals: Vitals;
	locked: boolean;
	onSet: (key: keyof Vitals, value: number | null) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const meta = VITAL_META[k];
	const ok = vitalInRange(k, vitals);
	const value = formatVital(k, vitals);

	const save = () => {
		if (k === "bp") {
			const [s, d] = draft.split("/").map((x) => Number.parseInt(x.trim(), 10));
			if (s && d) {
				onSet("bp_sys", s);
				onSet("bp_dia", d);
			}
		} else {
			const n = Number.parseFloat(draft);
			if (!Number.isNaN(n)) onSet(k, n);
		}
		setEditing(false);
	};

	return (
		<div className={cn("relative rounded-[20px] bg-white p-3 shadow-wv-sm", ok === false && "ring-2 ring-wv-red/40")}>
			<div className="flex items-center gap-2">
				<span className={cn("grid h-7 w-7 place-items-center rounded-full", ok === false ? "bg-wv-red-soft text-wv-red" : "bg-wv-blue-soft text-wv-blue")}>
					{VITAL_ICONS[k]}
				</span>
				<p className="mr-auto truncate text-[11px] text-wv-muted">{meta.label}</p>
				{!locked && (
					<button
						type="button"
						aria-label={`Edit ${meta.label}`}
						onClick={() => {
							setDraft(value === "—" ? "" : value);
							setEditing(true);
						}}
						className="-mr-1 grid h-7 w-7 place-items-center rounded-full text-wv-muted"
					>
						<Pencil className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			{editing ? (
				<input
					// biome-ignore lint/a11y/noAutofocus: inline edit opened by explicit tap
					autoFocus
					inputMode="decimal"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && save()}
					onBlur={save}
					placeholder={k === "bp" ? "120/80" : ""}
					className="mt-1.5 h-8 w-full rounded-lg border border-wv-line px-2 text-base font-semibold outline-none focus:border-wv-blue"
				/>
			) : (
				<p className={cn("mt-1.5 text-xl font-semibold leading-none", ok === false && "text-wv-red")}>
					{value}
					{value !== "—" && <span className="ml-1 text-[11px] font-normal text-wv-muted">{meta.unit}</span>}
				</p>
			)}
			{ok === false && <p className="mt-1 text-[10px] font-medium text-wv-red">Out of range · re-check</p>}
		</div>
	);
}


/** Free-text note with a local draft; saves on blur so live polling never clobbers typing. */
function NoteField({
	label,
	hint,
	value,
	locked,
	family,
	onSave,
}: {
	label: string;
	hint: string;
	value: string;
	locked: boolean;
	family?: boolean;
	onSave: (v: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	const [focused, setFocused] = useState(false);
	useEffect(() => {
		if (!focused) setDraft(value);
	}, [value, focused]);
	return (
		<label className="mt-3 block first:mt-0">
			<span className="mb-1 flex justify-between text-[11px] font-medium text-wv-muted">
				{label} <span className={cn("uppercase", family && "text-wv-blue")}>{hint}</span>
			</span>
			<textarea
				value={draft}
				disabled={locked}
				onFocus={() => setFocused(true)}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={() => {
					setFocused(false);
					if (draft !== value) onSave(draft);
				}}
				rows={3}
				className={cn(
					"w-full resize-none rounded-2xl border p-3 text-sm outline-none focus:border-wv-blue disabled:bg-wv-card",
					family ? "border-wv-blue/30 bg-wv-blue-soft/50" : "border-wv-line bg-white",
				)}
			/>
		</label>
	);
}

/** Compact live voice card: orb, status, latest exchange, step progress. */
export function VoiceCard({
	record,
	transcript,
	listening,
	onOpenTranscript,
	voiceSlot,
	statusLabel,
}: {
	record: RoundRecord;
	transcript: TranscriptLine[];
	listening: boolean;
	onOpenTranscript: () => void;
	voiceSlot?: ReactNode;
	statusLabel?: string;
}) {
	const locked = record.status === "signed";
	const last = transcript[transcript.length - 1];
	const stepState = (key: SectionKey | "sign"): FieldState => (key === "sign" ? (locked ? "confirmed" : "empty") : record.sections[key]);
	return (
		<Card className="bg-wv-blue p-4 text-white shadow-wv-blue">
			<div className="flex items-center gap-3">
				<span className="relative grid h-14 w-14 shrink-0 place-items-center">
					{listening && !locked && <span className="absolute inset-0 animate-ping rounded-full bg-white/25" />}
					<span className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-wv-blue">
						{locked ? <Lock className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
					</span>
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium">{locked ? "Round signed" : (statusLabel ?? (listening ? "Listening…" : "Voice paused"))}</p>
					<p className="line-clamp-2 text-xs text-white/80">
						{last
							? `${last.who === "agent" ? "WardVoice" : "You"}: ${last.text}`
							: locked
								? `Locked by ${record.signed_by ?? "doctor"} at ${record.signed_at ?? ""}. Audit entry added.`
								: 'Say the bed number to begin, e.g. "Bed 12".'}
					</p>
				</div>
			</div>
			{voiceSlot}
			<ol className="mt-4 grid grid-cols-6 gap-1">
				{STEPS.map((s) => {
					const st = stepState(s.key);
					return (
						<li key={s.key} className="flex flex-col items-center gap-1">
							<span className={cn("h-1.5 w-full rounded-full", st === "confirmed" ? "bg-white" : st === "captured" ? "bg-wv-amber" : "bg-white/25")} />
							<span className="text-[10px] text-white/80">{s.label}</span>
						</li>
					);
				})}
			</ol>
			<button type="button" onClick={onOpenTranscript} className="mt-3 flex w-full items-center justify-between rounded-full bg-white/15 px-4 py-2 text-xs font-medium">
				Live transcript · {transcript.length} lines <ChevronRight className="h-4 w-4" />
			</button>
		</Card>
	);
}

export function TranscriptList({ transcript }: { transcript: TranscriptLine[] }) {
	if (transcript.length === 0) return <p className="p-4 text-sm text-wv-muted">Nothing said yet.</p>;
	return (
		<div className="space-y-2.5">
			{transcript.map((t) => (
				<div key={t.ts + t.who + t.text.slice(0, 12)} className={cn("flex", t.who === "doctor" ? "justify-end" : "justify-start")}>
					<p
						className={cn(
							"max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug",
							t.who === "doctor" ? "rounded-br-md bg-wv-blue text-white" : "rounded-bl-md bg-white text-wv-ink shadow-wv-sm",
						)}
					>
						{t.text}
					</p>
				</div>
			))}
		</div>
	);
}

/** Sticky bottom bar replacing the tab bar during a round. */
export function SignBar({ record, onSign }: { record: RoundRecord; onSign: () => void }) {
	const locked = record.status === "signed";
	const ready = canSign(record);
	return (
		<div className="rounded-full bg-wv-card/95 p-1.5 shadow-wv backdrop-blur">
			<PillButton
				variant="primary"
				className="h-12 w-full text-sm"
				disabled={!ready || locked}
				onClick={onSign}
				icon={locked ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
			>
				{locked ? "Signed & sent" : ready ? 'Sign & send · or say "sign and send"' : "Confirm all sections to sign"}
			</PillButton>
		</div>
	);
}

export function RoundWorkspace({
	patient,
	record,
	transcript,
	listening,
	actions,
	voiceSlot,
	statusLabel,
	banner,
	onOpenTranscript,
}: {
	patient: Patient;
	record: RoundRecord;
	transcript: TranscriptLine[];
	listening: boolean;
	actions: RoundActions;
	voiceSlot?: ReactNode;
	statusLabel?: string;
	banner?: ReactNode;
	onOpenTranscript: () => void;
}) {
	const locked = record.status === "signed";
	const s = record.sections;
	const vitalKeys = Object.keys(VITAL_META) as (keyof typeof VITAL_META)[];
	const [showAudit, setShowAudit] = useState(false);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<IconButton label="Back" href="/doctor">
					<ArrowLeft className="h-5 w-5" />
				</IconButton>
				<div className="mr-auto min-w-0">
					<p className="text-xs text-wv-muted">
						Bed {patient.bed} · {patient.age} {patient.sex} · {patient.mrn}
					</p>
					<h1 className="truncate text-2xl font-medium tracking-[-0.02em]">{patient.name}</h1>
				</div>
				<span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-white shadow-wv-sm">
					<OrganFigure diagnosis={patient.diagnosis} className="h-11 w-11" />
				</span>
			</div>

			{record.verified ? (
				<Chip tone="green">
					<ShieldCheck className="h-3.5 w-3.5" /> Identity verified · {patient.diagnosis}
				</Chip>
			) : (
				<button
					type="button"
					onClick={actions.verifyIdentity}
					className="w-full rounded-[20px] bg-wv-amber-soft px-4 py-3 text-left text-sm text-[#9A5B00]"
				>
					<span className="font-semibold">Confirm identity:</span> {patient.name}, {patient.mrn}. Say "correct" or tap here.
				</button>
			)}

			{banner}

			<VoiceCard record={record} transcript={transcript} listening={listening} onOpenTranscript={onOpenTranscript} voiceSlot={voiceSlot} statusLabel={statusLabel} />

			<Section title="Vitals" state={s.vitals} onConfirm={() => actions.confirmSection("vitals")} locked={locked}>
				<div className="grid grid-cols-2 gap-2">
					{vitalKeys.map((k) => (
						<VitalTile key={k} k={k} vitals={record.vitals} locked={locked} onSet={actions.setVital} />
					))}
				</div>
			</Section>

			<Section title="Status" state={s.status} onConfirm={() => actions.confirmSection("status")} locked={locked}>
				<div className="space-y-3">
					<Choice
						label="Overall condition"
						options={CONDITION_OPTIONS}
						value={record.condition}
						locked={locked}
						onChange={(v) => actions.setChoice("condition", v)}
						tone={(v) =>
							({
								improving: "bg-wv-green text-white",
								stable: "bg-wv-blue text-white shadow-wv-blue",
								deteriorating: "bg-wv-amber text-white",
								critical: "bg-wv-red text-white",
							})[v]
						}
					/>
					<Choice label="Consciousness" options={CONSCIOUSNESS_OPTIONS} value={record.consciousness} locked={locked} onChange={(v) => actions.setChoice("consciousness", v)} />
					<Choice label="Diet" options={DIET_OPTIONS} value={record.diet} locked={locked} onChange={(v) => actions.setChoice("diet", v)} />
					<Choice label="Mobility" options={MOBILITY_OPTIONS} value={record.mobility} locked={locked} onChange={(v) => actions.setChoice("mobility", v)} />
				</div>
			</Section>

			<Section title="Orders" state={s.orders} onConfirm={() => actions.confirmSection("orders")} locked={locked}>
				{record.orders.length === 0 ? (
					<p className="text-sm text-wv-muted">Say e.g. "Start paracetamol 1 gram IV 6-hourly".</p>
				) : (
					<ul className="space-y-2">
						{record.orders.map((o) => (
							<li key={o.id} className="flex items-start gap-2.5 rounded-[18px] bg-white p-3 shadow-wv-sm">
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-wv-blue-soft text-wv-blue">
									{o.kind === "medication" ? <Pill className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-[10px] font-semibold uppercase tracking-wide text-wv-muted">
										{o.action} · {o.kind}
									</p>
									<p className="text-sm font-medium leading-snug">{o.text}</p>
								</div>
								{o.state === "confirmed" ? (
									<Check className="mt-1 h-5 w-5 text-wv-green" aria-label="Confirmed" />
								) : (
									!locked && (
										<button type="button" onClick={() => actions.confirmOrder(o.id)} aria-label="Confirm order" className="grid h-8 w-8 place-items-center rounded-full bg-wv-green-soft text-[#0B7A47]">
											<Check className="h-4 w-4" />
										</button>
									)
								)}
								{!locked && (
									<button type="button" aria-label="Remove order" onClick={() => actions.removeOrder(o.id)} className="grid h-8 w-8 place-items-center rounded-full text-wv-muted">
										<Trash2 className="h-4 w-4" />
									</button>
								)}
							</li>
						))}
					</ul>
				)}
			</Section>

			<Section title="Notes" state={s.notes} onConfirm={() => actions.confirmSection("notes")} locked={locked} aside={<Chip>Free text</Chip>}>
				<NoteField label="Clinical note" hint="internal" value={record.clinical_note} locked={locked} onSave={(v) => actions.setNote("clinical_note", v)} />
				<NoteField label="Note for family" hint="sent in email" family value={record.family_note} locked={locked} onSave={(v) => actions.setNote("family_note", v)} />
			</Section>

			<Card className="p-4">
				<button type="button" className="flex w-full items-center justify-between text-sm font-medium" onClick={() => setShowAudit((v) => !v)}>
					Audit trail · {record.audit.length} entries
					<ChevronRight className={cn("h-4 w-4 transition", showAudit && "rotate-90")} />
				</button>
				{showAudit && (
					<ol className="mt-3 space-y-1.5 text-[11px]">
						{record.audit.map((a) => (
							<li key={a.ts + a.text} className="flex gap-2">
								<span className="shrink-0 font-mono text-wv-muted">{a.ts.slice(0, 5)}</span>
								<span className={cn("w-10 shrink-0 font-semibold uppercase", a.via === "voice" ? "text-wv-blue" : a.via === "touch" ? "text-[#9A5B00]" : "text-wv-muted")}>
									{a.via}
								</span>
								<span>{a.text}</span>
							</li>
						))}
					</ol>
				)}
			</Card>
		</div>
	);
}
