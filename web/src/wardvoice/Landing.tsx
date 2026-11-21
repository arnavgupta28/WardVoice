"use client";

import { DnaHelix, EcgLine } from "./figures";
import { Phone } from "./Phone";
import { PillButton } from "./ui";

/** Splash hero: 3D-style DNA helix with a live ECG trace and a voice chip. */
export function HeroVisual() {
	return (
		<div className="relative mx-auto w-full max-w-[300px]" aria-hidden>
			<DnaHelix className="mx-auto h-[300px] w-auto motion-safe:animate-[wv-bob_5s_ease-in-out_infinite]" />
			<EcgLine className="absolute inset-x-0 -bottom-6 h-10 text-white" />
			<span className="absolute left-0 top-10 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-wv-blue shadow-wv-sm">
				<span className="h-1.5 w-1.5 rounded-full bg-wv-green" /> "Bed 12, pulse 88…"
			</span>
			<span className="absolute bottom-20 right-0 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-wv-ink shadow-wv-sm">
				<span className="grid h-4 w-4 place-items-center rounded-full bg-wv-red text-[10px] font-bold leading-none text-white">+</span> Family updated
			</span>
		</div>
	);
}

/** Splash / onboarding screen, mirrors reference screen 1. */
export function Landing() {
	return (
		<Phone tone="blue" caption="WardVoice · hands-free ward rounds with automatic family updates">
			<div className="flex min-h-full flex-col text-white">
				<div className="flex justify-end pt-2">
					<span className="text-2xl font-semibold tracking-tight">
						W<sup className="text-base">+</sup>
					</span>
				</div>
				<h1 className="mt-4 text-right text-[40px] font-medium leading-[1.05] tracking-[-0.03em]">
					Hands-free
					<br />
					rounds.
					<br />
					Calmer families.
				</h1>
				<div className="my-6 flex flex-1 items-center">
					<HeroVisual />
				</div>
				<p className="mb-4 text-center text-sm text-white/80">
					Speak vitals and decisions with gloves on. Families get a signed daily update.
				</p>
				<div className="mb-3 flex justify-center gap-1.5" aria-hidden>
					<span className="h-1.5 w-1.5 rounded-full bg-white/50" />
					<span className="h-1.5 w-5 rounded-full bg-white" />
					<span className="h-1.5 w-1.5 rounded-full bg-white/50" />
				</div>
				<div className="flex gap-2 rounded-full bg-white/15 p-1.5">
					<PillButton variant="light" href="/signin?role=doctor" className="h-12 flex-1 pl-4 text-sm">
						Doctor
					</PillButton>
					<PillButton variant="light" href="/signin?role=family" className="h-12 flex-1 pl-4 text-sm">
						Family
					</PillButton>
				</div>
			</div>
		</Phone>
	);
}
