"use client";

import { ArrowLeft, Stethoscope, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { supabaseEnabled } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { DOCTOR, FAMILY_USER, patientById } from "@/wardvoice/data";
import { HeartFigure } from "@/wardvoice/figures";
import { Phone } from "@/wardvoice/Phone";
import { type Role, signIn } from "@/wardvoice/session";
import { IconButton, Logo, PillButton } from "@/wardvoice/ui";

const DEMO_PASSWORD = "WardVoice2026!";

function SignInForm() {
	const params = useSearchParams();
	const router = useRouter();
	const [role, setRole] = useState<Role>(params.get("role") === "family" ? "family" : "doctor");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const demo =
		role === "doctor"
			? { id: "kavya.rao@wardvoice.demo", hint: `${DOCTOR.name} · ${DOCTOR.ward}` }
			: {
					id: "anita.kumar@wardvoice.demo",
					hint: `${FAMILY_USER.name} · ${FAMILY_USER.relation} of ${patientById(FAMILY_USER.patient_id)?.name}`,
				};

	const submit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		setError(null);
		setBusy(true);
		try {
			await signIn(role, { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
			router.push(role === "doctor" ? "/doctor" : "/family");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
			setBusy(false);
		}
	};

	return (
		<Phone caption="Sign in · demo accounts are pre-filled">
			<div className="mb-8 flex items-center justify-between">
				<IconButton label="Back" href="/">
					<ArrowLeft className="h-5 w-5" />
				</IconButton>
				<Logo />
				<span className="w-11" />
			</div>

			<div className="relative">
				<HeartFigure className="pointer-events-none absolute -right-1 -top-6 w-[112px] motion-safe:animate-[wv-bob_4s_ease-in-out_infinite]" />
				<h1 className="relative text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">
					Welcome
					<br />
					back
				</h1>
			</div>
			<p className="mt-2 text-sm text-wv-muted">Choose how you're signing in.</p>

			<div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-wv-card p-1.5 shadow-wv-sm" role="tablist">
				{(
					[
						{ r: "doctor", label: "Doctor", icon: <Stethoscope className="h-4 w-4" /> },
						{ r: "family", label: "Family", icon: <Users className="h-4 w-4" /> },
					] as const
				).map((t) => (
					<button
						key={t.r}
						type="button"
						role="tab"
						aria-selected={role === t.r}
						onClick={() => {
							setRole(t.r);
							setError(null);
						}}
						className={cn(
							"flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition",
							role === t.r ? "bg-wv-blue text-white shadow-wv-blue" : "text-wv-muted",
						)}
					>
						{t.icon}
						{t.label}
					</button>
				))}
			</div>

			<form onSubmit={submit} className="mt-6 space-y-3">
				<label className="block">
					<span className="mb-1 block text-xs font-medium text-wv-muted">{role === "doctor" && !supabaseEnabled ? "Hospital ID" : "Email"}</span>
					<input
						key={role}
						name="email"
						type={supabaseEnabled ? "email" : "text"}
						autoComplete="username"
						defaultValue={demo.id}
						className="h-12 w-full rounded-2xl border border-wv-line bg-white px-4 text-sm outline-none focus:border-wv-blue"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block text-xs font-medium text-wv-muted">Password</span>
					<input
						key={`${role}-pw`}
						name="password"
						type="password"
						autoComplete="current-password"
						defaultValue={DEMO_PASSWORD}
						className="h-12 w-full rounded-2xl border border-wv-line bg-white px-4 text-sm outline-none focus:border-wv-blue"
					/>
				</label>
				<p className="rounded-2xl bg-wv-blue-soft px-4 py-3 text-xs text-wv-blue">Demo account: {demo.hint}</p>
				{error && (
					<p role="alert" className="rounded-2xl bg-wv-red-soft px-4 py-3 text-xs text-wv-red">
						{error}
					</p>
				)}
				<PillButton type="submit" variant="primary" className="mt-4 w-full" disabled={busy}>
					{busy ? "Signing in…" : "Sign in"}
				</PillButton>
			</form>
		</Phone>
	);
}

export default function SignInPage() {
	return (
		<Suspense>
			<SignInForm />
		</Suspense>
	);
}
