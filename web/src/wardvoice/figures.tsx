"use client";

/**
 * WardVoice illustration fragments: hand-built SVG figures in the style of the
 * design reference (soft grey 3D organs, glossy red heart, white DNA on blue).
 * No raster assets; every figure scales and inherits nothing from the page.
 */

import { useId } from "react";

import { cn } from "@/lib/utils";

const useSvgId = (name: string) => `${name}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

type FigProps = { className?: string; title?: string };

/** Pulsing white hotspot, as on the reference organs. */
function Hotspot({ x, y, r = 4.5, tone = "#FFFFFF", pulse = true }: { x: number; y: number; r?: number; tone?: string; pulse?: boolean }) {
	return (
		<g>
			<circle cx={x} cy={y} r={r * 2.3} fill={tone} opacity="0.28">
				{pulse && <animate attributeName="r" values={`${r * 1.6};${r * 2.6};${r * 1.6}`} dur="2.4s" repeatCount="indefinite" />}
			</circle>
			<circle cx={x} cy={y} r={r} fill={tone} />
		</g>
	);
}

function Svg({ viewBox, title, className, children }: { viewBox: string; title?: string; className?: string; children: React.ReactNode }) {
	return (
		<svg viewBox={viewBox} className={cn("block", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} xmlns="http://www.w3.org/2000/svg">
			{title && <title>{title}</title>}
			{children}
		</svg>
	);
}

// ------------------------------------------------------------------ DNA helix (splash, on blue)

export function DnaHelix({ className, title }: FigProps) {
	const id = useSvgId("dna");
	const N = 72;
	const turns = 2.1;
	const top = 18;
	const height = 300;
	const amp = 58;
	const cx = 120;
	type Seg = { x1: number; y1: number; x2: number; y2: number; z: number; kind: "a" | "b" | "rung" };
	const segs: Seg[] = [];
	const pt = (i: number, phase: number) => {
		const t = (i / N) * turns * Math.PI * 2 + phase;
		// Rounded so server and client render identical markup (no hydration mismatch).
		const r2 = (n: number) => Math.round(n * 100) / 100;
		return { x: r2(cx + amp * Math.sin(t)), y: r2(top + (i / N) * height), z: r2(Math.cos(t)) };
	};
	for (let i = 0; i < N; i++) {
		for (const [kind, phase] of [
			["a", 0],
			["b", Math.PI],
		] as const) {
			const p = pt(i, phase);
			const q = pt(i + 1, phase);
			segs.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, z: (p.z + q.z) / 2, kind });
		}
		if (i % 4 === 2) {
			const a = pt(i, 0);
			const b = pt(i, Math.PI);
			segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, z: -0.05, kind: "rung" });
		}
	}
	segs.sort((s, t) => s.z - t.z);
	const nodes = [pt(9, 0), pt(26, Math.PI), pt(44, 0), pt(61, Math.PI)];
	return (
		<Svg viewBox="0 0 240 340" title={title} className={className}>
			<defs>
				<linearGradient id={`${id}-tube`} x1="0" x2="1">
					<stop offset="0" stopColor="#FFFFFF" />
					<stop offset="1" stopColor="#C9D2E1" />
				</linearGradient>
				<radialGradient id={`${id}-glow`}>
					<stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
					<stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
				</radialGradient>
			</defs>
			<circle cx="120" cy="170" r="128" fill={`url(#${id}-glow)`} />
			<g transform="rotate(-18 120 170)" strokeLinecap="round">
				{segs.map((s, i) => {
					const depth = (s.z + 1) / 2; // 0 back … 1 front
					if (s.kind === "rung") {
						return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#DCE3EF" strokeWidth="6" opacity="0.85" />;
					}
					return (
						<g key={i} opacity={0.55 + depth * 0.45}>
							<line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={`url(#${id}-tube)`} strokeWidth={11 + depth * 5} />
							{depth > 0.55 && <line x1={s.x1 - 3} y1={s.y1} x2={s.x2 - 3} y2={s.y2} stroke="#FFFFFF" strokeWidth="3" opacity="0.7" />}
						</g>
					);
				})}
				{nodes.map((n) => (
					<Hotspot key={n.y} x={n.x} y={n.y} r={6} />
				))}
			</g>
		</Svg>
	);
}

// ------------------------------------------------------------------ glossy heart

export function HeartFigure({ className, title }: FigProps) {
	const id = useSvgId("heart");
	return (
		<Svg viewBox="0 0 200 210" title={title} className={className}>
			<defs>
				<radialGradient id={`${id}-body`} cx="0.35" cy="0.3" r="0.8">
					<stop offset="0" stopColor="#FF8593" />
					<stop offset="0.45" stopColor="#E5243B" />
					<stop offset="1" stopColor="#8E0B1E" />
				</radialGradient>
				<linearGradient id={`${id}-vessel`} x1="0" x2="1">
					<stop offset="0" stopColor="#F04A5D" />
					<stop offset="1" stopColor="#B0142B" />
				</linearGradient>
				<filter id={`${id}-blur`}>
					<feGaussianBlur stdDeviation="3" />
				</filter>
			</defs>
			<ellipse cx="104" cy="200" rx="48" ry="6" fill="#0E1116" opacity="0.10" />
			<g fill="none" strokeLinecap="round">
				<path d="M84 80 C80 52 64 46 54 60" stroke="#C81E33" strokeWidth="15" />
				<path d="M98 74 C96 32 140 26 148 60" stroke={`url(#${id}-vessel)`} strokeWidth="17" />
				<path d="M106 44 L103 16" stroke={`url(#${id}-vessel)`} strokeWidth="9" />
				<path d="M120 35 L120 11" stroke={`url(#${id}-vessel)`} strokeWidth="9" />
				<path d="M134 38 L139 15" stroke={`url(#${id}-vessel)`} strokeWidth="9" />
				<path d="M100 40 C104 30 116 26 126 30" stroke="#FFFFFF" strokeWidth="3" opacity="0.35" />
			</g>
			<path d="M100 66 C126 52 162 62 163 98 C164 134 130 166 104 190 C94 182 54 152 44 118 C34 84 64 58 100 66 Z" fill={`url(#${id}-body)`} />
			<g fill="none" stroke="#9E0F22" strokeLinecap="round" opacity="0.55">
				<path d="M106 80 C98 110 101 142 106 176" strokeWidth="3" />
				<path d="M104 112 C90 118 78 120 66 116" strokeWidth="2" />
				<path d="M130 78 C142 102 138 132 122 158" strokeWidth="2.5" />
			</g>
			<ellipse cx="72" cy="98" rx="11" ry="22" transform="rotate(-28 72 98)" fill="#FFFFFF" opacity="0.4" filter={`url(#${id}-blur)`} />
			<Hotspot x={128} y={104} />
			<Hotspot x={74} y={134} r={4} />
			<Hotspot x={140} y={48} r={3.5} />
		</Svg>
	);
}

// ------------------------------------------------------------------ lungs (pneumonia focus)

export function LungsFigure({ className, title, focus = true }: FigProps & { focus?: boolean }) {
	const id = useSvgId("lungs");
	return (
		<Svg viewBox="0 0 200 186" title={title} className={className}>
			<defs>
				<radialGradient id={`${id}-lobe`} cx="0.35" cy="0.25" r="0.85">
					<stop offset="0" stopColor="#FFFFFF" />
					<stop offset="0.55" stopColor="#D9DDE4" />
					<stop offset="1" stopColor="#9CA3AF" />
				</radialGradient>
				<linearGradient id={`${id}-trachea`} x1="0" x2="1">
					<stop offset="0" stopColor="#E5E7EB" />
					<stop offset="1" stopColor="#A3AAB6" />
				</linearGradient>
				<radialGradient id={`${id}-focus`}>
					<stop offset="0" stopColor="#F59E0B" stopOpacity="0.75" />
					<stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
				</radialGradient>
			</defs>
			<ellipse cx="100" cy="178" rx="70" ry="6" fill="#0E1116" opacity="0.08" />
			<rect x="93" y="6" width="14" height="58" rx="7" fill={`url(#${id}-trachea)`} />
			{[16, 26, 36, 46].map((y) => (
				<line key={y} x1="94" x2="106" y1={y} y2={y} stroke="#8B93A1" strokeWidth="1.5" opacity="0.5" />
			))}
			<path d="M92 64 C80 50 56 50 42 68 C25 90 19 122 22 150 C24 166 38 170 54 164 C72 157 88 150 92 136 Z" fill={`url(#${id}-lobe)`} />
			<path d="M108 64 C120 50 144 50 158 68 C175 90 181 122 178 150 C176 166 162 170 146 164 C130 158 118 154 114 140 C122 128 116 116 108 112 Z" fill={`url(#${id}-lobe)`} />
			{focus && <circle cx="50" cy="132" r="26" fill={`url(#${id}-focus)`} />}
			<g fill="none" stroke="#0B5FFF" strokeLinecap="round" opacity="0.55">
				<path d="M100 62 C94 70 88 74 80 80 M80 80 C70 86 62 96 56 110 M80 80 C76 94 76 108 72 124 M68 92 C58 94 50 96 42 102" strokeWidth="3" />
				<path d="M100 62 C106 70 112 74 120 80 M120 80 C130 86 138 96 144 110 M120 80 C124 94 126 106 130 120 M132 92 C142 94 150 96 158 102" strokeWidth="3" />
			</g>
			<ellipse cx="50" cy="86" rx="7" ry="16" transform="rotate(20 50 86)" fill="#FFFFFF" opacity="0.7" />
			<ellipse cx="150" cy="86" rx="7" ry="16" transform="rotate(-20 150 86)" fill="#FFFFFF" opacity="0.7" />
			{focus && <Hotspot x={50} y={132} tone="#F59E0B" />}
			<Hotspot x={150} y={124} r={3.5} tone="#0B5FFF" pulse={false} />
		</Svg>
	);
}

// ------------------------------------------------------------------ hip / femur (post-op ortho)

export function BoneFigure({ className, title }: FigProps) {
	const id = useSvgId("bone");
	return (
		<Svg viewBox="0 0 200 186" title={title} className={className}>
			<defs>
				<linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="160" y2="150">
					<stop offset="0" stopColor="#FFFFFF" />
					<stop offset="0.5" stopColor="#DDE1E7" />
					<stop offset="1" stopColor="#9CA3AF" />
				</linearGradient>
			</defs>
			<ellipse cx="100" cy="176" rx="64" ry="6" fill="#0E1116" opacity="0.08" />
			<g transform="rotate(-38 100 96)" fill={`url(#${id}-g)`}>
				<rect x="46" y="86" width="108" height="20" rx="10" />
				<circle cx="44" cy="84" r="17" />
				<circle cx="46" cy="108" r="14" />
				<circle cx="156" cy="84" r="14" />
				<circle cx="158" cy="108" r="17" />
			</g>
			<circle cx="58" cy="132" r="24" fill="none" stroke="#0B5FFF" strokeWidth="3" strokeDasharray="5 6" opacity="0.7" />
			<path d="M78 82 C92 72 112 70 124 76" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
			<Hotspot x={58} y={132} tone="#0B5FFF" />
		</Svg>
	);
}

// ------------------------------------------------------------------ red blood cells (metabolic)

export function BloodCellsFigure({ className, title }: FigProps) {
	const id = useSvgId("cells");
	const Cell = ({ cx, cy, r, rot }: { cx: number; cy: number; r: number; rot: number }) => (
		<g transform={`rotate(${rot} ${cx} ${cy})`}>
			<ellipse cx={cx} cy={cy} rx={r} ry={r * 0.82} fill={`url(#${id}-cell)`} />
			<ellipse cx={cx + r * 0.05} cy={cy + r * 0.04} rx={r * 0.48} ry={r * 0.36} fill={`url(#${id}-dip)`} />
			<ellipse cx={cx - r * 0.45} cy={cy - r * 0.42} rx={r * 0.22} ry={r * 0.1} transform={`rotate(-30 ${cx - r * 0.45} ${cy - r * 0.42})`} fill="#FFFFFF" opacity="0.6" />
		</g>
	);
	return (
		<Svg viewBox="0 0 200 186" title={title} className={className}>
			<defs>
				<radialGradient id={`${id}-cell`} cx="0.35" cy="0.3" r="0.8">
					<stop offset="0" stopColor="#FF8A97" />
					<stop offset="0.6" stopColor="#E5243B" />
					<stop offset="1" stopColor="#9E0F22" />
				</radialGradient>
				<radialGradient id={`${id}-dip`} cx="0.6" cy="0.6">
					<stop offset="0" stopColor="#A8101F" />
					<stop offset="1" stopColor="#E5243B" stopOpacity="0" />
				</radialGradient>
			</defs>
			<ellipse cx="100" cy="176" rx="64" ry="6" fill="#0E1116" opacity="0.08" />
			<Cell cx={78} cy={112} r={46} rot={-14} />
			<Cell cx={138} cy={66} r={34} rot={22} />
			<Hotspot x={156} y={130} r={4} tone="#0B5FFF" />
		</Svg>
	);
}

// ------------------------------------------------------------------ stethoscope (doctor home)

export function StethoscopeFigure({ className, title }: FigProps) {
	const id = useSvgId("steth");
	return (
		<Svg viewBox="0 0 170 170" title={title} className={className}>
			<defs>
				<radialGradient id={`${id}-metal`} cx="0.35" cy="0.3" r="0.8">
					<stop offset="0" stopColor="#FFFFFF" />
					<stop offset="0.5" stopColor="#CBD2DC" />
					<stop offset="1" stopColor="#7C8594" />
				</radialGradient>
				<linearGradient id={`${id}-tube`} x1="0" x2="1">
					<stop offset="0" stopColor="#3B82FF" />
					<stop offset="1" stopColor="#0B4FD6" />
				</linearGradient>
			</defs>
			<ellipse cx="118" cy="160" rx="34" ry="5" fill="#0E1116" opacity="0.08" />
			<g fill="none" strokeLinecap="round">
				<path d="M48 20 C42 46 54 64 70 76" stroke="#AEB6C2" strokeWidth="6" />
				<path d="M92 20 C98 46 86 64 70 76" stroke="#AEB6C2" strokeWidth="6" />
				<path d="M70 76 C68 118 76 150 112 140" stroke={`url(#${id}-tube)`} strokeWidth="9" />
				<path d="M68 90 C67 112 72 132 92 140" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.4" />
			</g>
			<circle cx="48" cy="18" r="6" fill="#0E1116" />
			<circle cx="92" cy="18" r="6" fill="#0E1116" />
			<circle cx="70" cy="76" r="5" fill="#AEB6C2" />
			<circle cx="124" cy="132" r="22" fill={`url(#${id}-metal)`} />
			<circle cx="124" cy="132" r="14" fill="#E9EBEE" stroke="#9CA3AF" strokeWidth="2" />
			<path d="M116 132 h4 l2 -6 l4 12 l2 -6 h4" fill="none" stroke="#E5243B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</Svg>
	);
}

// ------------------------------------------------------------------ ECG trace (animated)

export function EcgLine({ className, color = "currentColor" }: { className?: string; color?: string }) {
	const d = "M0 30 H40 L48 30 L54 18 L60 30 H70 L76 4 L84 54 L90 30 H104 L112 22 L120 30 H170 L178 30 L184 18 L190 30 H200 L206 4 L214 54 L220 30 H234 L242 22 L250 30 H300";
	return (
		<svg viewBox="0 0 300 60" className={cn("block w-full", className)} aria-hidden preserveAspectRatio="none">
			<path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.25" />
			<path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="90 600" className="motion-safe:animate-[wv-ecg_2.6s_linear_infinite]" />
		</svg>
	);
}

// ------------------------------------------------------------------ care badge (heart + cross, family)

export function CareBadge({ className, title }: FigProps) {
	const id = useSvgId("care");
	return (
		<Svg viewBox="0 0 120 120" title={title} className={className}>
			<defs>
				<radialGradient id={`${id}-h`} cx="0.35" cy="0.3" r="0.85">
					<stop offset="0" stopColor="#FF8593" />
					<stop offset="0.55" stopColor="#E5243B" />
					<stop offset="1" stopColor="#9E0F22" />
				</radialGradient>
			</defs>
			<circle cx="60" cy="60" r="56" fill="#FFFFFF" />
			<circle cx="60" cy="60" r="44" fill="#EEF4FF" />
			<path d="M60 92 C38 76 26 64 26 48 C26 36 35 28 45 28 C52 28 57 32 60 37 C63 32 68 28 75 28 C85 28 94 36 94 48 C94 64 82 76 60 92 Z" fill={`url(#${id}-h)`} />
			<path d="M30 58 H46 L51 48 L57 68 L62 54 H90" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx="92" cy="30" r="13" fill="#0B5FFF" />
			<path d="M92 24 V36 M86 30 H98" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
			<ellipse cx="42" cy="40" rx="5" ry="8" transform="rotate(-35 42 40)" fill="#FFFFFF" opacity="0.5" />
		</Svg>
	);
}

// ------------------------------------------------------------------ organ for a diagnosis

export type OrganKind = "lungs" | "bone" | "cells" | "heart";

export function organFor(diagnosis: string): { kind: OrganKind; label: string } {
	const d = diagnosis.toLowerCase();
	if (/pneumon|lung|copd|asthma|respir/.test(d)) return { kind: "lungs", label: "Lungs" };
	if (/hip|knee|fractur|ortho|bone/.test(d)) return { kind: "bone", label: "Hip" };
	if (/diabet|dka|anaem|blood|sepsis/.test(d)) return { kind: "cells", label: "Blood sugar" };
	return { kind: "heart", label: "Heart" };
}

export function OrganFigure({ diagnosis, className }: { diagnosis: string; className?: string }) {
	const { kind, label } = organFor(diagnosis);
	const title = `${label}: focus of care`;
	if (kind === "lungs") return <LungsFigure className={className} title={title} />;
	if (kind === "bone") return <BoneFigure className={className} title={title} />;
	if (kind === "cells") return <BloodCellsFigure className={className} title={title} />;
	return <HeartFigure className={className} title={title} />;
}
