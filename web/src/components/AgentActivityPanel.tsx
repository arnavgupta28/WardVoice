"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Activity = {
	id: number;
	ts: string;
	tool: string;
	args: Record<string, unknown>;
	status: "ok" | "error" | "info";
	summary: string;
};

type Appointment = {
	id: string;
	doctor: string;
	clinic: string;
	area: string;
	date: string;
	time: string;
	status: string;
	reminders: string[];
	calendar_event_id: string | null;
};

type CalendarEvent = { id: string; title: string; date: string; start: string; end: string };
type Notification = { id: string; channel: string; to: string; body: string; ts: string };

type DemoState = {
	today: string;
	activity: Activity[];
	appointments: Appointment[];
	calendar: CalendarEvent[];
	notifications: Notification[];
};

const TOOL_LABELS: Record<string, string> = {
	search_doctors: "Search doctors",
	get_doctor_slots: "Check doctor slots",
	get_my_calendar: "Read your calendar",
	book_appointment: "Book appointment",
	add_to_calendar: "Add to calendar",
	send_confirmation: "Send confirmation",
	set_reminder: "Set reminder",
	list_my_appointments: "List appointments",
	reschedule_appointment: "Reschedule",
	cancel_appointment: "Cancel",
};

function dayLabel(iso: string) {
	return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

export function AgentActivityPanel() {
	const [state, setState] = useState<DemoState | null>(null);
	const [offline, setOffline] = useState(false);
	const listRef = useRef<HTMLOListElement>(null);
	const lastCount = useRef(0);

	const refresh = useCallback(async () => {
		try {
			const res = await fetch("/api/demo/state", { cache: "no-store" });
			if (!res.ok) throw new Error(String(res.status));
			setState(await res.json());
			setOffline(false);
		} catch {
			setOffline(true);
		}
	}, []);

	useEffect(() => {
		refresh();
		const timer = setInterval(refresh, 1000);
		return () => clearInterval(timer);
	}, [refresh]);

	useEffect(() => {
		const count = state?.activity.length ?? 0;
		if (count !== lastCount.current && listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
		lastCount.current = count;
	}, [state]);

	const reset = async () => {
		await fetch("/api/demo/reset", { method: "POST" });
		refresh();
	};

	const activity = state?.activity ?? [];
	const appointments = (state?.appointments ?? []).filter((a) => a.status !== "cancelled");
	const upcoming = (state?.calendar ?? []).filter((e) => !state || e.date >= state.today).slice(0, 5);
	const messages = state?.notifications ?? [];

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 text-sm">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold text-foreground">Agent actions</h2>
				<button
					type="button"
					onClick={reset}
					className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
				>
					Reset demo
				</button>
			</div>

			{offline && (
				<p className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">
					Can't reach the backend. Is <code>bun run dev</code> running?
				</p>
			)}

			<ol
				ref={listRef}
				className="min-h-[8rem] flex-1 space-y-2 overflow-y-auto pr-1"
				aria-live="polite"
				aria-label="Tool calls made by the agent"
			>
				{activity.length === 0 && (
					<li className="text-xs text-muted-foreground">
						Tool calls appear here as the agent plans and acts.
					</li>
				)}
				{activity.map((a) => (
					<li
						key={a.id}
						className={`rounded-md border px-3 py-2 ${
							a.status === "error" ? "border-amber-500/50 bg-amber-500/5" : "border-border"
						}`}
					>
						<div className="flex items-center justify-between gap-2">
							<span className="font-medium text-foreground">
								<span aria-hidden>{a.status === "error" ? "⚠︎ " : "✓ "}</span>
								{TOOL_LABELS[a.tool] ?? a.tool}
							</span>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground">{a.ts}</span>
						</div>
						<p className="mt-0.5 break-words text-xs text-muted-foreground">{a.summary}</p>
					</li>
				))}
			</ol>

			<section aria-label="Booked appointments" className="shrink-0">
				<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Appointments
				</h3>
				{appointments.length === 0 ? (
					<p className="text-xs text-muted-foreground">None yet</p>
				) : (
					appointments.map((a) => (
						<div key={a.id} className="mb-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
							<div className="font-medium text-foreground">
								{a.doctor} · {dayLabel(a.date)} {a.time}
							</div>
							<div className="text-xs text-muted-foreground">
								{a.clinic}, {a.area} · {a.status}
								{a.calendar_event_id ? " · in calendar" : ""}
								{a.reminders.length ? ` · reminder ${a.reminders[a.reminders.length - 1]}` : ""}
							</div>
						</div>
					))
				)}
			</section>

			<div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
				<section aria-label="Your calendar">
					<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Your calendar
					</h3>
					<ul className="space-y-0.5 text-xs">
						{upcoming.map((e) => (
							<li key={e.id} className="text-foreground">
								<span className="text-muted-foreground">
									{dayLabel(e.date)} {e.start}
								</span>{" "}
								{e.title}
							</li>
						))}
					</ul>
				</section>
				<section aria-label="Messages sent">
					<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Messages sent
					</h3>
					{messages.length === 0 ? (
						<p className="text-xs text-muted-foreground">None yet</p>
					) : (
						<ul className="space-y-1 text-xs">
							{messages.slice(-2).map((m) => (
								<li key={m.id} className="text-foreground">
									<span className="font-medium uppercase text-muted-foreground">
										{m.channel} → {m.to}:
									</span>{" "}
									{m.body}
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}
