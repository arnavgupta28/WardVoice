"use client";

import { Bell, BatteryFull, FileText, History, Home, LogOut, Mic, Signal, Wifi } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { type Role, signOut, useRequireRole } from "./session";
import { Avatar, IconButton, greeting } from "./ui";

function StatusBar({ light }: { light?: boolean }) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-0 z-30 hidden h-12 items-center justify-between px-8 text-[13px] font-semibold md:flex", light ? "text-white" : "text-wv-ink")}>
			<span>9:41</span>
			<span className={cn("h-[30px] w-[110px] rounded-full", light ? "bg-white" : "bg-wv-ink")} />
			<span className="flex items-center gap-1">
				<Signal className="h-3.5 w-3.5" />
				<Wifi className="h-3.5 w-3.5" />
				<BatteryFull className="h-4 w-4" />
			</span>
		</div>
	);
}

/**
 * The app always renders as a phone. On a laptop it's a centred device frame (like the
 * design references); on a real phone it fills the screen.
 */
export function Phone({
	children,
	nav,
	overlay,
	tone = "light",
	caption,
}: {
	children: ReactNode;
	nav?: ReactNode;
	overlay?: ReactNode;
	tone?: "light" | "blue";
	caption?: ReactNode;
}) {
	return (
		<div style={{ colorScheme: "light" }} className="min-h-[100dvh] bg-wv-page font-sans text-wv-ink antialiased md:flex md:flex-col md:items-center md:justify-center md:gap-5 md:py-8">
			<div
				className={cn(
					"relative mx-auto h-[100dvh] w-full overflow-hidden md:h-[844px] md:w-[390px] md:rounded-[56px] md:border-[10px] md:border-white md:shadow-[0_40px_80px_-30px_rgba(16,24,40,0.45)]",
					tone === "blue" ? "bg-wv-blue" : "bg-wv-page",
				)}
			>
				<StatusBar light={tone === "blue"} />
				<div className={cn("no-scrollbar h-full overflow-y-auto px-5 pt-5 md:pt-14", nav ? "pb-28" : "pb-8")}>{children}</div>
				{nav && <div className="absolute inset-x-4 bottom-4 z-20">{nav}</div>}
				{overlay}
			</div>
			{caption && <div className="hidden max-w-[390px] text-center text-xs text-wv-muted md:block">{caption}</div>}
		</div>
	);
}

/** Bottom tab bar from the reference: active tab is a wide blue pill, others round icons. */
export function TabBar({ tabs }: { tabs: { href: string; label: string; icon: ReactNode; match?: (p: string) => boolean }[] }) {
	const pathname = usePathname();
	return (
		<nav className="flex items-center gap-2 rounded-full bg-wv-card/95 p-2 shadow-wv backdrop-blur">
			{tabs.map((t) => {
				const active = t.match ? t.match(pathname) : pathname === t.href;
				return (
					<Link
						key={t.href}
						href={t.href}
						aria-label={t.label}
						className={cn(
							"flex h-12 items-center justify-center gap-2 rounded-full text-sm font-medium transition",
							active ? "flex-1 bg-wv-blue text-white shadow-wv-blue" : "w-12 bg-white text-wv-ink shadow-wv-sm",
						)}
					>
						{t.icon}
						{active && t.label}
					</Link>
				);
			})}
		</nav>
	);
}

export const DOCTOR_TABS = [
	{ href: "/doctor", label: "Home", icon: <Home className="h-5 w-5" /> },
	{ href: "/doctor/round/P1", label: "Round", icon: <Mic className="h-5 w-5" />, match: (p: string) => p.startsWith("/doctor/round") },
	{ href: "/doctor/reports", label: "Reports", icon: <FileText className="h-5 w-5" /> },
];

export const FAMILY_TABS = [
	{ href: "/family", label: "Home", icon: <Home className="h-5 w-5" /> },
	{ href: "/family/updates", label: "Updates", icon: <History className="h-5 w-5" /> },
];

/** Signed-in app screen: role guard + greeting header + bottom tabs. */
export function AppScreen({
	role,
	name,
	subtitle,
	children,
	overlay,
	header = true,
}: {
	role: Role;
	name: string;
	subtitle?: string;
	children: ReactNode;
	overlay?: ReactNode;
	header?: boolean;
}) {
	const ready = useRequireRole(role);
	const router = useRouter();
	const nav = <TabBar tabs={role === "doctor" ? DOCTOR_TABS : FAMILY_TABS} />;
	if (!ready) return <Phone>{null}</Phone>;
	return (
		<Phone nav={nav} overlay={overlay} caption={role === "doctor" ? "Doctor app · WardVoice" : "Family app · WardVoice"}>
			{header && (
				<header className="mb-6 flex items-center gap-3">
					<Avatar name={name} />
					<div className="mr-auto min-w-0">
						<p className="text-xs text-wv-muted">{subtitle ?? `${greeting()},`}</p>
						<p className="truncate font-medium">{name}</p>
					</div>
					<IconButton label="Notifications">
						<Bell className="h-5 w-5" />
					</IconButton>
					<IconButton
						label="Sign out"
						onClick={() => {
							signOut();
							router.push("/");
						}}
					>
						<LogOut className="h-4 w-4" />
					</IconButton>
				</header>
			)}
			{children}
		</Phone>
	);
}

/** Bottom sheet that stays inside the phone frame. */
export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
	return (
		<div className="absolute inset-0 z-40 flex flex-col justify-end bg-wv-ink/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={label}>
			<button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
			<div className="no-scrollbar max-h-[85%] overflow-y-auto rounded-t-[32px] bg-wv-page p-4 pb-8">
				<div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-wv-line" />
				{children}
			</div>
		</div>
	);
}
