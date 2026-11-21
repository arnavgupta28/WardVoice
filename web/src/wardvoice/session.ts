"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type Role = "doctor" | "family";
const KEY = "wv-role";

export function signIn(role: Role) {
	try {
		localStorage.setItem(KEY, role);
	} catch {}
}

export function signOut() {
	try {
		localStorage.removeItem(KEY);
	} catch {}
}

function readRole(): Role | null {
	try {
		const v = localStorage.getItem(KEY);
		return v === "doctor" || v === "family" ? v : null;
	} catch {
		return null;
	}
}

/** Demo-grade guard: send the visitor to sign-in if they aren't this role. */
export function useRequireRole(role: Role) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	useEffect(() => {
		// Demo deep link: /doctor?as=doctor signs in directly (handy for judges and screenshots).
		const as = new URLSearchParams(window.location.search).get("as");
		if (as === role) signIn(role);
		if (readRole() === role) setReady(true);
		else router.replace(`/signin?role=${role}`);
	}, [role, router]);
	return ready;
}
