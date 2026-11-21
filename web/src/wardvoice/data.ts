import type {
	Condition,
	Consciousness,
	Diet,
	FamilyReport,
	Mobility,
	Patient,
	RoundRecord,
	TranscriptLine,
	Vitals,
} from "./types";

// ---------------------------------------------------------------- labels
// Deterministic options — the only values voice or touch can set.

export const CONDITION_OPTIONS: { value: Condition; label: string; family: string }[] = [
	{ value: "improving", label: "Improving", family: "Getting better" },
	{ value: "stable", label: "Stable", family: "Stable" },
	{ value: "deteriorating", label: "Deteriorating", family: "Needs closer care" },
	{ value: "critical", label: "Critical", family: "Critical" },
];
export const CONSCIOUSNESS_OPTIONS: { value: Consciousness; label: string }[] = [
	{ value: "alert", label: "Alert" },
	{ value: "drowsy", label: "Drowsy" },
	{ value: "responds_to_voice", label: "Responds to voice" },
	{ value: "unresponsive", label: "Unresponsive" },
];
export const DIET_OPTIONS: { value: Diet; label: string }[] = [
	{ value: "nil_by_mouth", label: "Nil by mouth" },
	{ value: "liquids", label: "Liquids" },
	{ value: "soft", label: "Soft" },
	{ value: "normal", label: "Normal" },
	{ value: "diabetic", label: "Diabetic" },
];
export const MOBILITY_OPTIONS: { value: Mobility; label: string }[] = [
	{ value: "bed_rest", label: "Bed rest" },
	{ value: "assisted", label: "Assisted" },
	{ value: "independent", label: "Independent" },
];

export function labelOf<T extends string>(opts: { value: T; label: string }[], v: T | null) {
	return opts.find((o) => o.value === v)?.label ?? "—";
}

// Normal ranges drive the amber "check this" flag and the family wording.
export const VITAL_META = {
	hr: { label: "Heart rate", unit: "bpm", min: 60, max: 100 },
	bp: { label: "Blood pressure", unit: "mmHg", min: 90, max: 140 },
	temp_c: { label: "Temperature", unit: "°C", min: 36.1, max: 37.8 },
	spo2: { label: "Oxygen (SpO₂)", unit: "%", min: 94, max: 100 },
	rr: { label: "Breathing rate", unit: "/min", min: 12, max: 20 },
	pain: { label: "Pain", unit: "/10", min: 0, max: 3 },
} as const;

export function formatVital(key: keyof typeof VITAL_META, v: Vitals): string {
	if (key === "bp") return v.bp_sys && v.bp_dia ? `${v.bp_sys}/${v.bp_dia}` : "—";
	const value = v[key];
	return value === null || value === undefined ? "—" : String(value);
}

export function vitalInRange(key: keyof typeof VITAL_META, v: Vitals): boolean | null {
	const m = VITAL_META[key];
	const value = key === "bp" ? v.bp_sys : v[key];
	if (value === null || value === undefined) return null;
	return value >= m.min && value <= m.max;
}

// ---------------------------------------------------------------- mock ward

export const DOCTOR = { name: "Dr. Kavya Rao", role: "Consultant, Internal Medicine", ward: "Ward 4B" };
export const FAMILY_USER = { name: "Anita Kumar", relation: "Daughter", patient_id: "P1" };

export const PATIENTS: Patient[] = [
	{
		id: "P1",
		bed: "12",
		name: "Ramesh Kumar",
		age: 64,
		sex: "M",
		mrn: "MRN-204381",
		ward: "Ward 4B",
		diagnosis: "Community-acquired pneumonia",
		admitted_on: "2026-11-18",
		family: [
			{ name: "Anita Kumar", relation: "Daughter", email: "anita@example.com", consent: true },
			{ name: "Suresh Kumar", relation: "Son", email: "suresh@example.com", consent: true },
		],
		trend: {
			hr: [104, 101, 98, 96, 92, 90, 88],
			spo2: [90, 91, 92, 93, 94, 95, 96],
			temp_c: [38.6, 38.4, 38.1, 37.9, 37.6, 37.4, 37.2],
			bp: [138, 135, 132, 130, 128, 126, 124],
		},
	},
	{
		id: "P2",
		bed: "14",
		name: "Lakshmi Iyer",
		age: 71,
		sex: "F",
		mrn: "MRN-204417",
		ward: "Ward 4B",
		diagnosis: "Post-op hip replacement, day 2",
		admitted_on: "2026-11-19",
		family: [{ name: "Vikram Iyer", relation: "Son", email: "vikram@example.com", consent: true }],
		trend: { hr: [82, 84, 80, 78, 79, 77, 76], spo2: [97, 97, 98, 97, 98, 98, 98], bp: [128, 126, 124, 125, 122, 121, 120] },
	},
	{
		id: "P3",
		bed: "15",
		name: "Mohammed Farooq",
		age: 58,
		sex: "M",
		mrn: "MRN-204452",
		ward: "Ward 4B",
		diagnosis: "Uncontrolled type 2 diabetes, DKA resolving",
		admitted_on: "2026-11-20",
		family: [{ name: "Ayesha Farooq", relation: "Wife", email: "ayesha@example.com", consent: false }],
		trend: { hr: [112, 108, 102, 98, 95, 94, 92], spo2: [96, 96, 97, 97, 97, 98, 98], bp: [110, 112, 115, 118, 120, 121, 122] },
	},
];

const emptyVitals: Vitals = { hr: null, bp_sys: null, bp_dia: null, temp_c: null, spo2: null, rr: null, pain: null };
const emptySections = { identity: "empty", vitals: "empty", status: "empty", orders: "empty", notes: "empty" } as const;

export function blankRecord(patient_id: string): RoundRecord {
	return {
		patient_id,
		status: "pending",
		verified: false,
		vitals: { ...emptyVitals },
		condition: null,
		consciousness: null,
		diet: null,
		mobility: null,
		orders: [],
		clinical_note: "",
		family_note: "",
		sections: { ...emptySections },
		signed_by: null,
		signed_at: null,
		audit: [],
	};
}

/** Bed 12 mid-round: shows every UI state (confirmed, captured, empty). */
export const SAMPLE_RECORD: RoundRecord = {
	patient_id: "P1",
	status: "draft",
	verified: true,
	vitals: { hr: 88, bp_sys: 124, bp_dia: 78, temp_c: 37.2, spo2: 96, rr: 18, pain: 2 },
	condition: "improving",
	consciousness: "alert",
	diet: "soft",
	mobility: "assisted",
	orders: [
		{ id: "O1", kind: "medication", action: "change", text: "Ceftriaxone IV → Cefuroxime 500 mg oral, 12-hourly", state: "captured" },
		{ id: "O2", kind: "test", action: "order", text: "Repeat chest X-ray tomorrow morning", state: "captured" },
	],
	clinical_note:
		"Afebrile for 18 h, crackles reduced at right base. Tolerating soft diet. Plan IV-to-oral switch; consider discharge in 48 h if CXR improves.",
	family_note: "Ramesh is breathing more comfortably and his fever has settled. We're switching his antibiotic to tablets today.",
	sections: { identity: "confirmed", vitals: "confirmed", status: "captured", orders: "captured", notes: "empty" },
	signed_by: null,
	signed_at: null,
	audit: [
		{ ts: "09:31:04", actor: "Dr. Kavya Rao", via: "voice", text: "Selected Bed 12" },
		{ ts: "09:31:09", actor: "Dr. Kavya Rao", via: "voice", text: "Identity confirmed: Ramesh Kumar, MRN-204381" },
		{ ts: "09:31:40", actor: "Dr. Kavya Rao", via: "voice", text: "Vitals captured (HR 88, BP 124/78, T 37.2, SpO₂ 96, RR 18, pain 2)" },
		{ ts: "09:31:52", actor: "Dr. Kavya Rao", via: "voice", text: "Vitals confirmed" },
		{ ts: "09:32:20", actor: "Dr. Kavya Rao", via: "voice", text: "Condition set to Improving; diet Soft; mobility Assisted" },
		{ ts: "09:32:41", actor: "Dr. Kavya Rao", via: "voice", text: "Order: switch Ceftriaxone IV → Cefuroxime oral" },
	],
};

export const SAMPLE_TRANSCRIPT: TranscriptLine[] = [
	{ who: "doctor", text: "Bed twelve.", ts: "09:31:02" },
	{ who: "agent", text: "Bed 12 is Ramesh Kumar, MRN ending 381. Correct?", ts: "09:31:05" },
	{ who: "doctor", text: "Correct.", ts: "09:31:08" },
	{ who: "doctor", text: "Pulse eighty-eight, BP one twenty-four over seventy-eight, temp thirty-seven point two, sats ninety-six, resp eighteen, pain two.", ts: "09:31:30" },
	{ who: "agent", text: "Heart rate 88, BP 124 over 78, temperature 37.2, oxygen 96, breathing 18, pain 2. Confirm vitals?", ts: "09:31:42" },
	{ who: "doctor", text: "Yes.", ts: "09:31:51" },
	{ who: "doctor", text: "He's improving. Soft diet, assisted mobility. Switch ceftriaxone to oral cefuroxime five hundred twice daily, and repeat chest X-ray tomorrow.", ts: "09:32:35" },
	{ who: "agent", text: "Condition improving, soft diet, assisted mobility. Two orders captured. Confirm?", ts: "09:32:44" },
];

export const REPORTS: FamilyReport[] = [
	{
		id: "R-1121-P2",
		patient_id: "P2",
		date: "2026-11-21",
		status: "sent",
		recipients: ["vikram@example.com"],
		condition: "stable",
		vitals: { hr: 76, bp_sys: 120, bp_dia: 76, temp_c: 36.8, spo2: 98, rr: 16, pain: 3 },
		plan: ["Physiotherapy twice today", "Walking with a frame from tomorrow"],
		family_note: "Lakshmi took her first steps with the physiotherapist this morning and is in good spirits.",
		signed_by: "Dr. Kavya Rao",
		signed_at: "09:24",
	},
	{
		id: "R-1121-P3",
		patient_id: "P3",
		date: "2026-11-21",
		status: "no_consent",
		recipients: [],
		condition: "improving",
		vitals: { hr: 92, bp_sys: 122, bp_dia: 80, temp_c: 36.9, spo2: 98, rr: 17, pain: 1 },
		plan: ["Insulin drip stopped, now on injections", "Diabetes educator visit at 3 pm"],
		family_note: "",
		signed_by: "Dr. Kavya Rao",
		signed_at: "09:12",
	},
	{
		id: "R-1120-P1",
		patient_id: "P1",
		date: "2026-11-20",
		status: "sent",
		recipients: ["anita@example.com", "suresh@example.com"],
		condition: "stable",
		vitals: { hr: 96, bp_sys: 130, bp_dia: 82, temp_c: 37.9, spo2: 93, rr: 20, pain: 3 },
		plan: ["Continue IV antibiotics", "Oxygen by nasal prongs, wean as tolerated"],
		family_note: "Ramesh had a restful night. His fever is coming down slowly and we are watching his oxygen closely.",
		signed_by: "Dr. Kavya Rao",
		signed_at: "09:40",
	},
	{
		id: "R-1119-P1",
		patient_id: "P1",
		date: "2026-11-19",
		status: "sent",
		recipients: ["anita@example.com", "suresh@example.com"],
		condition: "stable",
		vitals: { hr: 101, bp_sys: 135, bp_dia: 85, temp_c: 38.4, spo2: 91, rr: 22, pain: 4 },
		plan: ["IV antibiotics started", "Chest physiotherapy", "Blood cultures sent"],
		family_note: "Ramesh settled into the ward well. We have started antibiotics for his chest infection.",
		signed_by: "Dr. Kavya Rao",
		signed_at: "10:05",
	},
];

export function patientById(id: string) {
	return PATIENTS.find((p) => p.id === id);
}
