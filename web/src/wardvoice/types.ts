// Shapes mirror the planned backend (server/src/ward.py) so mock → live is a swap.

export type Condition = "improving" | "stable" | "deteriorating" | "critical";
export type Consciousness = "alert" | "drowsy" | "responds_to_voice" | "unresponsive";
export type Diet = "nil_by_mouth" | "liquids" | "soft" | "normal" | "diabetic";
export type Mobility = "bed_rest" | "assisted" | "independent";
export type FieldState = "empty" | "captured" | "confirmed";
export type RecordStatus = "pending" | "draft" | "signed";

export type VitalKey = "hr" | "bp" | "temp_c" | "spo2" | "rr" | "pain";

export interface Vitals {
	hr: number | null;
	bp_sys: number | null;
	bp_dia: number | null;
	temp_c: number | null;
	spo2: number | null;
	rr: number | null;
	pain: number | null;
}

export interface FamilyContact {
	name: string;
	relation: string;
	email: string;
	consent: boolean;
}

export interface Patient {
	id: string;
	bed: string;
	name: string;
	age: number;
	sex: "M" | "F";
	mrn: string;
	ward: string;
	diagnosis: string;
	admitted_on: string;
	family: FamilyContact[];
	/** last 7 readings per vital, oldest first, for sparklines */
	trend: Partial<Record<VitalKey, number[]>>;
}

export type OrderKind = "medication" | "test" | "consult" | "discharge";
export interface Order {
	id: string;
	kind: OrderKind;
	action: "start" | "stop" | "change" | "order" | "plan";
	text: string; // e.g. "Ceftriaxone 1 g IV 12-hourly"
	state: FieldState;
}

export type SectionKey = "identity" | "vitals" | "status" | "orders" | "notes";

export interface AuditEntry {
	ts: string;
	actor: string;
	via: "voice" | "touch" | "system";
	text: string;
}

export interface RoundRecord {
	patient_id: string;
	status: RecordStatus;
	verified: boolean;
	vitals: Vitals;
	condition: Condition | null;
	consciousness: Consciousness | null;
	diet: Diet | null;
	mobility: Mobility | null;
	orders: Order[];
	clinical_note: string;
	family_note: string;
	sections: Record<SectionKey, FieldState>;
	signed_by: string | null;
	signed_at: string | null;
	audit: AuditEntry[];
}

export type ReportStatus = "sent" | "held_call_family" | "no_consent";
export interface FamilyReport {
	id: string;
	patient_id: string;
	date: string;
	status: ReportStatus;
	recipients: string[];
	condition: Condition;
	vitals: Vitals;
	plan: string[];
	family_note: string;
	signed_by: string;
	signed_at: string;
}

export interface TranscriptLine {
	who: "doctor" | "agent";
	text: string;
	ts: string;
}
