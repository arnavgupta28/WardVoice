"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DOCTOR, PATIENTS, REPORTS, SAMPLE_RECORD, blankRecord } from "./data";
import type { FamilyReport, Patient, RoundRecord, SectionKey } from "./types";

export interface WardState {
	doctor: typeof DOCTOR;
	active_patient_id: string | null;
	patients: Patient[];
	records: Record<string, RoundRecord>;
	reports: FamilyReport[];
	today: string;
}

export type TouchAction =
	| { action: "select" }
	| { action: "verify" }
	| { action: "confirm_section"; section: SectionKey }
	| { action: "set_choice"; field: "condition" | "consciousness" | "diet" | "mobility"; value: string }
	| { action: "set_vital"; key: string; value: number | null }
	| { action: "confirm_order"; order_id: string }
	| { action: "remove_order"; order_id: string }
	| { action: "set_note"; field: "clinical_note" | "family_note"; value: string }
	| { action: "sign" };

// ---------------------------------------------------------------- offline mock (same rules as ward.py)

function mockState(): WardState {
	const records: Record<string, RoundRecord> = {};
	for (const p of PATIENTS) records[p.id] = blankRecord(p.id);
	records.P1 = structuredClone(SAMPLE_RECORD);
	for (const [pid, cond, t] of [
		["P2", "stable", "09:24"],
		["P3", "improving", "09:12"],
	] as const) {
		records[pid] = {
			...records[pid],
			status: "signed",
			verified: true,
			condition: cond,
			signed_by: DOCTOR.name,
			signed_at: t,
			sections: { identity: "confirmed", vitals: "confirmed", status: "confirmed", orders: "confirmed", notes: "confirmed" },
		};
	}
	return { doctor: DOCTOR, active_patient_id: null, patients: PATIENTS, records, reports: REPORTS, today: REPORTS[0].date };
}

const ts = () => new Date().toTimeString().slice(0, 8);
const sectionOf = (f: string): SectionKey => (["condition", "consciousness", "diet", "mobility"].includes(f) ? "status" : f.endsWith("note") ? "notes" : "vitals");

function applyMock(s: WardState, pid: string, a: TouchAction): WardState {
	const next = structuredClone(s);
	const r = next.records[pid];
	const log = (text: string) => r.audit.push({ ts: ts(), actor: DOCTOR.name, via: "touch", text });
	const capture = (sec: SectionKey) => {
		r.sections[sec] = "captured";
		if (r.status === "pending") r.status = "draft";
	};
	if (r.status === "signed" && a.action !== "select") return s;
	switch (a.action) {
		case "select":
			next.active_patient_id = pid;
			break;
		case "verify":
			r.verified = true;
			r.sections.identity = "confirmed";
			log("Identity confirmed");
			break;
		case "confirm_section":
			r.sections[a.section] = "confirmed";
			if (a.section === "orders") for (const o of r.orders) o.state = "confirmed";
			log(`${a.section} confirmed`);
			break;
		case "set_choice":
			(r as unknown as Record<string, unknown>)[a.field] = a.value;
			capture("status");
			log(`${a.field} set to ${a.value}`);
			break;
		case "set_vital":
			(r.vitals as unknown as Record<string, unknown>)[a.key] = a.value;
			capture("vitals");
			log(`${a.key} edited to ${a.value}`);
			break;
		case "confirm_order": {
			const o = r.orders.find((x) => x.id === a.order_id);
			if (o) o.state = "confirmed";
			r.sections.orders = r.orders.every((x) => x.state === "confirmed") ? "confirmed" : "captured";
			break;
		}
		case "remove_order":
			r.orders = r.orders.filter((o) => o.id !== a.order_id);
			capture("orders");
			break;
		case "set_note":
			r[a.field] = a.value;
			capture(sectionOf(a.field));
			break;
		case "sign": {
			r.status = "signed";
			r.signed_by = DOCTOR.name;
			r.signed_at = ts().slice(0, 5);
			log("Round signed and locked");
			const p = next.patients.find((x) => x.id === pid);
			const consented = p?.family.filter((f) => f.consent).map((f) => f.email) ?? [];
			const held = r.condition === "deteriorating" || r.condition === "critical";
			next.reports.unshift({
				id: `R-mock-${pid}-${Date.now()}`,
				patient_id: pid,
				date: next.today,
				status: held ? "held_call_family" : consented.length ? "sent" : "no_consent",
				recipients: held ? [] : consented,
				condition: r.condition ?? "stable",
				vitals: r.vitals,
				plan: r.orders.filter((o) => o.state === "confirmed").map((o) => o.text),
				family_note: r.family_note,
				signed_by: DOCTOR.name,
				signed_at: r.signed_at,
			});
			break;
		}
	}
	return next;
}

// ---------------------------------------------------------------- hook

/** Live ward state from the backend (polled), with an offline mock fallback. */
export function useWard(pollMs = 1000) {
	const [state, setState] = useState<WardState | null>(null);
	const [live, setLive] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const liveRef = useRef<boolean | null>(null);

	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/ward/state", { cache: "no-store" });
			if (!res.ok) throw new Error(String(res.status));
			setState(await res.json());
			liveRef.current = true;
			setLive(true);
		} catch {
			// Switch to the offline mock once; keep polling so we reconnect automatically.
			if (liveRef.current !== false) {
				liveRef.current = false;
				setLive(false);
				setState(mockState());
			}
		}
	}, []);

	useEffect(() => {
		refresh();
		const t = setInterval(refresh, pollMs);
		return () => clearInterval(t);
	}, [refresh, pollMs]);

	const act = useCallback(
		async (pid: string, a: TouchAction) => {
			setError(null);
			if (liveRef.current === false) {
				setState((s) => (s ? applyMock(s, pid, a) : s));
				return;
			}
			const { action, ...payload } = a;
			const res = await fetch(`/api/ward/patients/${pid}/action`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action, payload }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				setError(body.detail ?? `Action failed (${res.status})`);
			}
			refresh();
		},
		[refresh],
	);

	return { state, live, error, act, refresh };
}
