"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase, supabaseEnabled } from "@/lib/supabase";

export type Role = "doctor" | "family";
const KEY = "wv-role";

export type Credentials = { email: string; password: string };

function isRole(v: unknown): v is Role {
	return v === "doctor" || v === "family";
}

function setDemoRole(role: Role) {
	try {
		localStorage.setItem(KEY, role);
	} catch {}
}

function readRole(): Role | null {
	try {
		const v = localStorage.getItem(KEY);
		return isRole(v) ? v : null;
	} catch {
		return null;
	}
}

/** Role of a Supabase user: user_metadata.role, else their `profiles` row. */
async function roleOf(user: User): Promise<Role | null> {
	const meta = user.user_metadata?.role;
	if (isRole(meta)) return meta;
	if (!supabase) return null;
	const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
	const role: unknown = data?.role;
	return isRole(role) ? role : null;
}

/**
 * Sign in as `role`. With Supabase configured this is a real email + password sign-in
 * (throws with a readable message on failure); otherwise it is the demo localStorage role.
 */
export async function signIn(role: Role, creds?: Credentials): Promise<void> {
	if (!supabase || !creds) {
		setDemoRole(role);
		return;
	}
	const { data, error } = await supabase.auth.signInWithPassword({
		email: creds.email.trim(),
		password: creds.password,
	});
	if (error || !data.user) throw new Error(error?.message || "Sign-in failed. Check your email and password.");
	const actual = await roleOf(data.user);
	if (actual !== role) {
		await supabase.auth.signOut();
		throw new Error(
			actual ? `This is a ${actual} account. Switch to the ${actual === "doctor" ? "Doctor" : "Family"} tab.` : "This account has no WardVoice role yet.",
		);
	}
	// Clear any old demo deep-link role so the Supabase session is the one that counts.
	try {
		localStorage.removeItem(KEY);
	} catch {}
}

export function signOut() {
	try {
		localStorage.removeItem(KEY);
	} catch {}
	supabase?.auth.signOut().catch(() => {});
}

/** Guard: send the visitor to sign-in if they aren't this role. */
export function useRequireRole(role: Role) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let cancelled = false;
		// Demo deep link: /doctor?as=doctor signs in directly (handy for judges and screenshots).
		const as = new URLSearchParams(window.location.search).get("as");
		if (as === role) setDemoRole(role);
		if (readRole() === role) {
			setReady(true);
			return;
		}
		if (!supabaseEnabled || !supabase) {
			router.replace(`/signin?role=${role}`);
			return;
		}
		const client = supabase;
		(async () => {
			const { data } = await client.auth.getSession();
			const user = data.session?.user;
			const ok = user ? (await roleOf(user)) === role : false;
			if (cancelled) return;
			if (ok) setReady(true);
			else router.replace(`/signin?role=${role}`);
		})().catch(() => {
			if (!cancelled) router.replace(`/signin?role=${role}`);
		});
		return () => {
			cancelled = true;
		};
	}, [role, router]);
	return ready;
}
