"use client";

import { ArrowUpRight, Check, Mic } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Condition, FieldState } from "./types";

/** Light neumorphic page shell. The rest of the app is forced dark, so we scope light here. */
export function WvPage({ children, className }: { children?: ReactNode; className?: string }) {
	return (
		<div
			style={{ colorScheme: "light" }}
			className={cn("min-h-screen bg-wv-page font-sans text-wv-ink antialiased", className)}
		>
			{children}
		</div>
	);
}

export function Card({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("rounded-wv bg-wv-card shadow-wv", className)} {...props} />;
}

export function Logo({ light = false }: { light?: boolean }) {
	return (
		<span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", light ? "text-white" : "text-wv-ink")}>
			<span
				className={cn(
					"grid h-9 w-9 place-items-center rounded-full",
					light ? "bg-white text-wv-blue" : "bg-wv-blue text-white shadow-wv-blue",
				)}
			>
				<Mic className="h-4 w-4" aria-hidden />
			</span>
			<span className="text-lg">
				Ward<span className={light ? "text-white/70" : "text-wv-blue"}>Voice</span>
			</span>
		</span>
	);
}

type PillProps = {
	children: ReactNode;
	variant?: "primary" | "ghost" | "light";
	href?: string;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
	type?: "button" | "submit";
	icon?: ReactNode;
};

/** Pill with a round arrow badge — the signature control from the reference designs. */
export function PillButton({ children, variant = "ghost", href, onClick, disabled, className, type = "button", icon }: PillProps) {
	const base =
		"group inline-flex h-14 items-center justify-between gap-4 rounded-full pl-6 pr-1.5 text-[15px] font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
	const styles = {
		primary: "bg-wv-blue text-white shadow-wv-blue hover:brightness-110",
		ghost: "bg-wv-card text-wv-ink shadow-wv-sm hover:bg-white",
		light: "bg-white/95 text-wv-ink shadow-wv-sm hover:bg-white",
	}[variant];
	const badge = {
		primary: "bg-white/20 text-white",
		ghost: "bg-wv-blue text-white",
		light: "bg-wv-blue text-white",
	}[variant];
	const inner = (
		<>
			<span>{children}</span>
			<span className={cn("grid h-11 w-11 place-items-center rounded-full transition group-hover:rotate-45", badge)}>
				{icon ?? <ArrowUpRight className="h-5 w-5" aria-hidden />}
			</span>
		</>
	);
	if (href && !disabled) {
		return (
			<Link href={href} className={cn(base, styles, className)}>
				{inner}
			</Link>
		);
	}
	return (
		<button type={type} onClick={onClick} disabled={disabled} className={cn(base, styles, className)}>
			{inner}
		</button>
	);
}

export function Chip({
	children,
	tone = "neutral",
	dot = false,
	className,
}: {
	children: ReactNode;
	tone?: "neutral" | "blue" | "green" | "amber" | "red";
	dot?: boolean;
	className?: string;
}) {
	const tones = {
		neutral: "bg-white text-wv-muted",
		blue: "bg-wv-blue-soft text-wv-blue",
		green: "bg-wv-green-soft text-[#0B7A47]",
		amber: "bg-wv-amber-soft text-[#9A5B00]",
		red: "bg-wv-red-soft text-wv-red",
	}[tone];
	const dots = { neutral: "bg-wv-muted", blue: "bg-wv-blue", green: "bg-wv-green", amber: "bg-wv-amber", red: "bg-wv-red" }[tone];
	return (
		<span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium", tones, className)}>
			{dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots)} aria-hidden />}
			{children}
		</span>
	);
}

export function conditionTone(c: Condition | null): "green" | "blue" | "amber" | "red" | "neutral" {
	if (c === "improving") return "green";
	if (c === "stable") return "blue";
	if (c === "deteriorating") return "amber";
	if (c === "critical") return "red";
	return "neutral";
}

/** Captured (amber) vs confirmed (green) — the core trust signal of the voice round. */
export function FieldStateBadge({ state }: { state: FieldState }) {
	if (state === "confirmed")
		return (
			<Chip tone="green">
				<Check className="h-3 w-3" aria-hidden /> Confirmed
			</Chip>
		);
	if (state === "captured")
		return (
			<Chip tone="amber" dot>
				Captured · confirm
			</Chip>
		);
	return <Chip>Waiting</Chip>;
}

export function Sparkline({
	points,
	className,
	stroke = "#0B5FFF",
}: {
	points?: number[];
	className?: string;
	stroke?: string;
}) {
	if (!points || points.length < 2) return <span className={cn("h-7 w-20", className)} aria-hidden />;
	const w = 80;
	const h = 28;
	const min = Math.min(...points);
	const max = Math.max(...points);
	const span = max - min || 1;
	const d = points
		.map((p, i) => `${(i / (points.length - 1)) * w},${h - 3 - ((p - min) / span) * (h - 6)}`)
		.join(" ");
	return (
		<svg viewBox={`0 0 ${w} ${h}`} className={cn("h-7 w-20", className)} aria-hidden>
			<polyline points={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/** Vital row from the "Your condition" reference: icon tile, label/value, sparkline, Now chip. */
export function VitalRow({
	icon,
	label,
	value,
	unit,
	trend,
	highlight = false,
	outOfRange = false,
	trailing,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	unit: string;
	trend?: number[];
	highlight?: boolean;
	outOfRange?: boolean;
	trailing?: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3 rounded-[22px] bg-wv-card p-2 pr-3 shadow-wv-sm">
			<span
				className={cn(
					"grid h-14 w-14 shrink-0 place-items-center rounded-[18px]",
					highlight ? "bg-wv-blue text-white shadow-wv-blue" : "bg-white text-wv-ink",
				)}
			>
				{icon}
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm text-wv-ink">{label}</p>
				<p className={cn("text-base font-semibold", outOfRange ? "text-wv-red" : highlight ? "text-wv-blue" : "text-wv-ink")}>
					{value}
					{value !== "—" && <span className="ml-1 text-xs font-normal text-wv-muted">{unit}</span>}
				</p>
			</div>
			<Sparkline points={trend} stroke={outOfRange ? "#E5243B" : highlight ? "#0B5FFF" : "#9AA3AF"} className="hidden sm:block" />
			{trailing ?? (
				<Chip tone={highlight ? "blue" : "neutral"} dot={highlight}>
					Now
				</Chip>
			)}
		</div>
	);
}

export function IconButton({
	label,
	children,
	onClick,
	href,
	className,
}: {
	label: string;
	children: ReactNode;
	onClick?: () => void;
	href?: string;
	className?: string;
}) {
	const cls = cn(
		"grid h-11 w-11 place-items-center rounded-full bg-wv-card text-wv-ink shadow-wv-sm transition hover:bg-white",
		className,
	);
	if (href)
		return (
			<Link href={href} aria-label={label} title={label} className={cls}>
				{children}
			</Link>
		);
	return (
		<button type="button" aria-label={label} title={label} onClick={onClick} className={cls}>
			{children}
		</button>
	);
}

export function Avatar({ name, className }: { name: string; className?: string }) {
	const initials = name
		.replace(/^Dr\.\s*/, "")
		.split(" ")
		.map((s) => s[0])
		.slice(0, 2)
		.join("");
	return (
		<span
			className={cn(
				"grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-wv-blue shadow-wv-sm",
				className,
			)}
			aria-hidden
		>
			{initials}
		</span>
	);
}

export function greeting(date = new Date()) {
	const h = date.getHours();
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}
