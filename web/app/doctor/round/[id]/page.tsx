"use client";

import { MailCheck, PhoneCall, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { DOCTOR, SAMPLE_RECORD, SAMPLE_TRANSCRIPT, blankRecord, patientById } from "@/wardvoice/data";
import { DoctorShell } from "@/wardvoice/DoctorShell";
import { FamilyEmail } from "@/wardvoice/FamilyEmail";
import { type RoundActions, RoundWorkspace } from "@/wardvoice/RoundWorkspace";
import type { FamilyReport, RoundRecord, SectionKey } from "@/wardvoice/types";
import { Card } from "@/wardvoice/ui";

const now = () => new Date().toTimeString().slice(0, 8);

function sectionFor(field: string): SectionKey {
	if (["condition", "consciousness", "diet", "mobility"].includes(field)) return "status";
	if (field === "clinical_note" || field === "family_note") return "notes";
	return "vitals";
}

/** Plain-language plan lines for the family, derived only from confirmed orders. */
function familyPlan(r: RoundRecord): string[] {
	return r.orders.filter((o) => o.state === "confirmed").map((o) => o.text);
}

export default function RoundPage() {
	const { id } = useParams<{ id: string }>();
	const patient = patientById(id);
	const [record, setRecord] = useState<RoundRecord>(() => (id === "P1" ? structuredClone(SAMPLE_RECORD) : blankRecord(id)));
	const [showEmail, setShowEmail] = useState(false);

	const log = (r: RoundRecord, text: string, via: "voice" | "touch" | "system" = "touch"): RoundRecord => ({
		...r,
		audit: [...r.audit, { ts: now(), actor: via === "system" ? "WardVoice" : DOCTOR.name, via, text }],
	});
	const recapture = (r: RoundRecord, sec: SectionKey): RoundRecord => ({
		...r,
		status: r.status === "pending" ? "draft" : r.status,
		sections: { ...r.sections, [sec]: "captured" },
	});

	const actions: RoundActions = useMemo(
		() => ({
			verifyIdentity: () =>
				setRecord((r) => log({ ...r, verified: true, sections: { ...r.sections, identity: "confirmed" } }, "Identity confirmed")),
			confirmSection: (sec) =>
				setRecord((r) => {
					const orders = sec === "orders" ? r.orders.map((o) => ({ ...o, state: "confirmed" as const })) : r.orders;
					return log({ ...r, orders, sections: { ...r.sections, [sec]: "confirmed" } }, `${sec} confirmed`);
				}),
			setChoice: (field, value) =>
				setRecord((r) => log(recapture({ ...r, [field]: value }, sectionFor(field)), `${field} set to ${value}`)),
			setVital: (key, value) => setRecord((r) => log(recapture({ ...r, vitals: { ...r.vitals, [key]: value } }, "vitals"), `${key} edited to ${value}`)),
			confirmOrder: (oid) =>
				setRecord((r) => {
					const orders = r.orders.map((o) => (o.id === oid ? { ...o, state: "confirmed" as const } : o));
					const all = orders.every((o) => o.state === "confirmed");
					return log({ ...r, orders, sections: { ...r.sections, orders: all ? "confirmed" : "captured" } }, `Order ${oid} confirmed`);
				}),
			removeOrder: (oid) =>
				setRecord((r) => log(recapture({ ...r, orders: r.orders.filter((o) => o.id !== oid) }, "orders"), `Order ${oid} removed`)),
			setNote: (field, value) => setRecord((r) => recapture({ ...r, [field]: value }, "notes")),
			signAndSend: () => {
				setRecord((r) => log({ ...r, status: "signed", signed_by: DOCTOR.name, signed_at: now().slice(0, 5) }, "Round signed and locked", "voice"));
				setShowEmail(true);
			},
		}),
		[],
	);

	if (!patient) {
		return (
			<DoctorShell>
				<Card className="p-8">Unknown patient.</Card>
			</DoctorShell>
		);
	}

	const held = record.condition === "deteriorating" || record.condition === "critical";
	const consented = patient.family.filter((f) => f.consent);
	const report: FamilyReport = {
		id: `R-live-${patient.id}`,
		patient_id: patient.id,
		date: new Date().toISOString().slice(0, 10),
		status: held ? "held_call_family" : consented.length ? "sent" : "no_consent",
		recipients: consented.map((f) => f.email),
		condition: record.condition ?? "stable",
		vitals: record.vitals,
		plan: familyPlan(record),
		family_note: record.family_note,
		signed_by: record.signed_by ?? DOCTOR.name,
		signed_at: record.signed_at ?? "",
	};

	const banner =
		record.status === "signed" ? (
			<Card className="flex flex-wrap items-center gap-3 p-4">
				<span className={`grid h-10 w-10 place-items-center rounded-full ${held ? "bg-wv-amber-soft text-[#9A5B00]" : "bg-wv-green-soft text-[#0B7A47]"}`}>
					{held ? <PhoneCall className="h-5 w-5" /> : <MailCheck className="h-5 w-5" />}
				</span>
				<p className="mr-auto text-sm">
					{held
						? "Family email held: condition needs a personal call. Added to your call list."
						: report.status === "no_consent"
							? "No family member has consented to updates, so nothing was sent."
							: `Family update emailed to ${report.recipients.join(", ")}.`}
				</p>
				{!held && report.status === "sent" && (
					<button type="button" onClick={() => setShowEmail(true)} className="h-9 rounded-full bg-wv-blue px-4 text-sm font-medium text-white">
						View email
					</button>
				)}
			</Card>
		) : null;

	return (
		<DoctorShell>
			<RoundWorkspace
				patient={patient}
				record={record}
				transcript={id === "P1" ? SAMPLE_TRANSCRIPT : []}
				listening={record.status !== "signed"}
				actions={actions}
				banner={banner}
			/>
			{showEmail && report.status === "sent" && (
				<div className="fixed inset-0 z-50 grid place-items-center bg-wv-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Family email preview">
					<div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto">
						<button
							type="button"
							aria-label="Close"
							onClick={() => setShowEmail(false)}
							className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-wv-ink shadow-wv-sm"
						>
							<X className="h-4 w-4" />
						</button>
						<FamilyEmail report={report} recipientName={consented[0]?.name.split(" ")[0]} />
					</div>
				</div>
			)}
		</DoctorShell>
	);
}
