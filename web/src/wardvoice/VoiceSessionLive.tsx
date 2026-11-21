"use client";

/**
 * Browser-only Agora session for the round screen: joins RTC, publishes the mic,
 * plays the agent's (Murf Falcon) audio and streams the transcript back up.
 * Loaded through next/dynamic with ssr:false from VoiceControl.
 */

import {
	type AgentTranscription,
	AgoraVoiceAI,
	AgoraVoiceAIEvents,
	type TranscriptHelperItem,
	TranscriptHelperMode,
	type UserTranscription,
} from "agora-agent-client-toolkit";
import AgoraRTC, { AgoraRTCProvider, RemoteUser, useJoin, useLocalMicrophoneTrack, usePublish, useRTCClient, useRemoteUsers } from "agora-rtc-react";
import type { RTMClient } from "agora-rtm";
import { useEffect, useRef } from "react";

import { normalizeTranscriptSpacing } from "@/lib/conversation";
import type { TranscriptLine } from "./types";

export type VoiceAgentState = "idle" | "listening" | "thinking" | "speaking" | "silent";

export interface LiveSessionProps {
	appId: string;
	channel: string;
	token: string;
	uid: string;
	agentUid: string;
	rtm: RTMClient;
	muted: boolean;
	onTranscript: (lines: TranscriptLine[]) => void;
	onAgentState: (s: VoiceAgentState) => void;
	onAgentPresent: (present: boolean) => void;
	onError: (msg: string) => void;
}

type RawItem = TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>;

function toLines(items: RawItem[], agentUid: string): TranscriptLine[] {
	return items
		.filter((i) => typeof i.text === "string" && i.text.trim())
		.map((i) => ({
			who: String(i.uid) === agentUid ? "agent" : "doctor",
			text: normalizeTranscriptSpacing(i.text as string),
			ts: `${i.turn_id}-${String(i.uid) === agentUid ? "a" : "d"}`,
		}));
}

function Session(p: LiveSessionProps) {
	const client = useRTCClient();
	const remoteUsers = useRemoteUsers();
	const cb = useRef(p);
	cb.current = p;

	const { isConnected } = useJoin({ appid: p.appId, channel: p.channel, token: p.token, uid: Number.parseInt(p.uid, 10) }, true);
	const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(true);
	usePublish([localMicrophoneTrack]);

	useEffect(() => {
		if (micError) cb.current.onError("Microphone unavailable. Allow mic access and try again.");
	}, [micError]);

	useEffect(() => {
		localMicrophoneTrack?.setEnabled(!p.muted).catch(() => {});
	}, [localMicrophoneTrack, p.muted]);

	useEffect(() => {
		cb.current.onAgentPresent(remoteUsers.some((u) => String(u.uid) === p.agentUid));
	}, [remoteUsers, p.agentUid]);

	// Transcript + agent state over RTM via the Conversational AI toolkit.
	useEffect(() => {
		if (!isConnected) return;
		let cancelled = false;
		(async () => {
			try {
				const ai = await AgoraVoiceAI.init({
					rtcEngine: client,
					rtmConfig: { rtmEngine: p.rtm },
					renderMode: TranscriptHelperMode.TEXT,
					enableLog: false,
				});
				if (cancelled) {
					ai.unsubscribe();
					ai.destroy();
					return;
				}
				ai.on(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, (t) => cb.current.onTranscript(toLines([...t] as RawItem[], cb.current.agentUid)));
				ai.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (_, e) => cb.current.onAgentState(e.state as VoiceAgentState));
				ai.on(AgoraVoiceAIEvents.AGENT_ERROR, (_, e) => cb.current.onError(`${e.type}: ${e.message}`));
				ai.subscribeMessage(p.channel);
			} catch (e) {
				if (!cancelled) console.error("[WardVoice] voice toolkit init failed", e);
			}
		})();
		return () => {
			cancelled = true;
			try {
				const ai = AgoraVoiceAI.getInstance();
				ai?.unsubscribe();
				ai?.destroy();
			} catch {}
		};
	}, [isConnected, client, p.rtm, p.channel]);

	// Release the mic when the session ends.
	useEffect(
		() => () => {
			try {
				localMicrophoneTrack?.stop();
				localMicrophoneTrack?.close();
			} catch {}
		},
		[localMicrophoneTrack],
	);

	return (
		<div className="hidden">
			{remoteUsers.map((u) => (
				<RemoteUser key={u.uid} user={u} playAudio />
			))}
		</div>
	);
}

export default function VoiceSessionLive(props: LiveSessionProps) {
	const clientRef = useRef<ReturnType<typeof AgoraRTC.createClient> | null>(null);
	if (!clientRef.current) clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
	return (
		<AgoraRTCProvider client={clientRef.current}>
			<Session {...props} />
		</AgoraRTCProvider>
	);
}
