"use client";

import { ArrowLeft, Stethoscope, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { cn } from "@/lib/utils";
import { DOCTOR, FAMILY_USER, patientById } from "@/wardvoice/data";
import { Phone } from "@/wardvoice/Phone";
import { type Role, signIn } from "@/wardvoice/session";
import { IconButton, Logo, PillButton } from "@/wardvoice/ui";

function SignInForm() {
	const params = useSearchParams();
	const router = useRouter();
	const [role, setRole] = useState<Role>(params.get("role") === "family" ? "family" : "doctor");

	const demo =
		role === "doctor"
			? { id: "kavya.rao@ward4b.demo", hint: `${DOCTOR.name} · ${DOCTOR.ward}` }
			: {
					id: "anita.kumar@example.com",
					hint: `${FAMILY_USER.name} · ${FAMILY_USER.relation} of ${patientById(FAMILY_USER.patient_id)?.name}`,
				};

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		signIn(role);
		router.push(role === "doctor" ? "/doctor" : "/family");
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

			<h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em]">
				Welcome
				<br />
				back
			</h1>
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
						onClick={() => setRole(t.r)}
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
					<span className="mb-1 block text-xs font-medium text-wv-muted">{role === "doctor" ? "Hospital ID" : "Email"}</span>
					<input key={role} defaultValue={demo.id} className="h-12 w-full rounded-2xl border border-wv-line bg-white px-4 text-sm outline-none focus:border-wv-blue" />
				</label>
				<label className="block">
					<span className="mb-1 block text-xs font-medium text-wv-muted">Password</span>
					<input type="password" defaultValue="demo-password" className="h-12 w-full rounded-2xl border border-wv-line bg-white px-4 text-sm outline-none focus:border-wv-blue" />
				</label>
				<p className="rounded-2xl bg-wv-blue-soft px-4 py-3 text-xs text-wv-blue">Demo account: {demo.hint}</p>
				<PillButton type="submit" variant="primary" className="mt-4 w-full">
					Sign in
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
