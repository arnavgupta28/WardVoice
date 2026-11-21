"use client";

import { MailCheck, PhoneCall } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SAMPLE_TRANSCRIPT } from "@/wardvoice/data";
import { FamilyEmail } from "@/wardvoice/FamilyEmail";
import { Phone, Sheet } from "@/wardvoice/Phone";
import { type RoundActions, RoundWorkspace, SignBar, TranscriptList } from "@/wardvoice/RoundWorkspace";
import { useRequireRole } from "@/wardvoice/session";
import { useWard } from "@/wardvoice/store";
import { useVoiceRound } from "@/wardvoice/VoiceControl";
import { Card, Chip } from "@/wardvoice/ui";

export default function RoundPage() {
	const { id } = useParams<{ id: string }>();
	const ready = useRequireRole("doctor");
	const { state, live, error, act } = useWard();
	const [sheet, setSheet] = useState<"transcript" | "email" | null>(null);
	const voice = useVoiceRound({ disabled: live === false });

	// Opening a patient's screen makes them the voice target.
	useEffect(() => {
		if (ready && live) act(id, { action: "select" });
	}, [ready, live, id, act]);

	const actions: RoundActions = useMemo(
		() => ({
			verifyIdentity: () => act(id, { action: "verify" }),
			confirmSection: (section) => act(id, { action: "confirm_section", section }),
			setChoice: (field, value) => act(id, { action: "set_choice", field, value }),
			setVital: (key, value) => act(id, { action: "set_vital", key, value }),
			confirmOrder: (order_id) => act(id, { action: "confirm_order", order_id }),
			removeOrder: (order_id) => act(id, { action: "remove_order", order_id }),
			setNote: (field, value) => act(id, { action: "set_note", field, value }),
			signAndSend: () => act(id, { action: "sign" }),
		}),
		[act, id],
	);

	const patient = state?.patients.find((p) => p.id === id);
	const record = state?.records[id];
	if (!ready || !state || !patient || !record) return <Phone>{null}</Phone>;

	const report = state.reports.find((r) => r.patient_id === id && r.date === state.today && record.status === "signed");
	// Live backend: the real Agora transcript. Offline demo: the scripted sample.
	const transcript = live ? voice.transcript : id === "P1" ? SAMPLE_TRANSCRIPT : [];
	const locked = record.status === "signed";

	const banner = (
		<>
			{live === false && (
				<Chip tone="amber" dot>
					Offline demo data: backend not reachable
				</Chip>
			)}
			{error && <p className="rounded-[18px] bg-wv-red-soft px-4 py-3 text-sm text-wv-red">{error}</p>}
			{report && (
				<Card className="flex items-center gap-3 p-3">
					<span
						className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${report.status === "held_call_family" ? "bg-wv-amber-soft text-[#9A5B00]" : "bg-wv-green-soft text-[#0B7A47]"}`}
					>
						{report.status === "held_call_family" ? <PhoneCall className="h-5 w-5" /> : <MailCheck className="h-5 w-5" />}
					</span>
					<p className="mr-auto text-xs leading-snug">
						{report.status === "held_call_family"
							? "Email held: condition needs a personal call. Added to your call list."
							: report.status === "no_consent"
								? "No family consent on file, so nothing was sent."
								: `Family update emailed to ${report.recipients.length} recipient(s).`}
					</p>
					{report.status === "sent" && (
						<button type="button" onClick={() => setSheet("email")} className="h-8 shrink-0 rounded-full bg-wv-blue px-3 text-xs font-medium text-white">
							View
						</button>
					)}
				</Card>
			)}
		</>
	);

	const overlay =
		sheet === "transcript" ? (
			<Sheet label="Live transcript" onClose={() => setSheet(null)}>
				<p className="mb-3 px-1 text-base font-medium">Live transcript</p>
				<TranscriptList transcript={transcript} />
			</Sheet>
		) : sheet === "email" && report ? (
			<Sheet label="Family email" onClose={() => setSheet(null)}>
				<FamilyEmail report={report} recipientName={patient.family.find((f) => f.consent)?.name.split(" ")[0]} />
			</Sheet>
		) : null;

	return (
		<Phone nav={<SignBar record={record} onSign={actions.signAndSend} />} overlay={overlay} caption="Doctor app · voice round">
			<RoundWorkspace
				patient={patient}
				record={record}
				transcript={transcript}
				listening={live ? voice.listening : !locked}
				statusLabel={live ? voice.statusLabel : undefined}
				voiceSlot={live && (!locked || voice.phase === "live") ? voice.slot : undefined}
				actions={actions}
				banner={banner}
				onOpenTranscript={() => setSheet("transcript")}
			/>
		</Phone>
	);
}
