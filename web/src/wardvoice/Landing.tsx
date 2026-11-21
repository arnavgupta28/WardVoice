"use client";

import { Phone } from "./Phone";
import { PillButton } from "./ui";

/** Concentric "listening" rings + waveform — stands in for the 3D DNA hero. */
export function HeroVisual() {
	const bars = [18, 34, 52, 30, 64, 44, 72, 40, 58, 26, 46, 20];
	return (
		<div className="relative mx-auto aspect-square w-full max-w-[300px]" aria-hidden>
			<div className="absolute inset-0 rounded-full bg-white/10" />
			<div className="absolute inset-[13%] rounded-full bg-white/10" />
			<div className="absolute inset-[27%] rounded-full bg-white/15" />
			<div className="absolute inset-0 flex items-center justify-center gap-[5px]">
				{bars.map((h, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars
						key={i}
						className="w-[6px] animate-pulse rounded-full bg-white"
						style={{ height: `${h * 0.55}%`, animationDelay: `${i * 90}ms`, opacity: 0.55 + (h / 72) * 0.45 }}
					/>
				))}
			</div>
			{[
				{ top: "12%", left: "20%" },
				{ top: "72%", left: "12%" },
				{ top: "22%", left: "82%" },
				{ top: "80%", left: "74%" },
			].map((p) => (
				<span key={p.top + p.left} className="absolute h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_0_7px_rgba(255,255,255,0.18)]" style={p} />
			))}
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
