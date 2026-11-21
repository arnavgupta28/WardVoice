'use client'

import type { RTMClient } from 'agora-rtm'
import { Loader2, Mic, MicOff, PhoneOff } from 'lucide-react'
import dynamic from 'next/dynamic'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { type GetConfigResponse, getConfig, startAgent, stopAgent } from '@/services/api'
import type { VoiceAgentState } from './VoiceSessionLive'
import type { TranscriptLine } from './types'

const VoiceSessionLive = dynamic(() => import('./VoiceSessionLive'), { ssr: false })

export type VoicePhase = 'idle' | 'starting' | 'live' | 'error'

interface Session {
  config: GetConfigResponse
  rtm: RTMClient
  agentId?: string
}

function waitForRtm(rtm: RTMClient, timeoutMs = 1500) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(t)
      rtm.removeEventListener('status', onStatus)
      resolve()
    }
    const onStatus = (s: { state?: string; newState?: string }) => {
      if ((s.newState ?? s.state) === 'CONNECTED') done()
    }
    const t = setTimeout(done, timeoutMs)
    rtm.addEventListener('status', onStatus as never)
  })
}

async function teardown(s: Session | null) {
  if (!s) return
  if (s.agentId) await stopAgent(s.agentId).catch(() => {})
  await s.rtm.logout().catch(() => {})
}

/**
 * Runs one Agora Conversational AI session (WardVoice scribe agent, Murf Falcon voice)
 * for the round screen. Returns the live transcript, a status label for the VoiceCard,
 * and `slot`: the start/mute/end controls plus the hidden RTC session.
 */
export function useVoiceRound({
  disabled,
  persona = 'doctor',
  language = 'en',
  patientId,
  startLabel = 'Start voice round',
}: {
  disabled?: boolean
  persona?: 'doctor' | 'family'
  language?: string
  patientId?: string
  startLabel?: string
} = {}) {
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [session, setSession] = useState<Session | null>(null)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [agentState, setAgentState] = useState<VoiceAgentState | null>(null)
  const [agentPresent, setAgentPresent] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<Session | null>(null)

  const start = useCallback(async () => {
    setPhase('starting')
    setError(null)
    setTranscript([])
    try {
      const config = await getConfig()
      const { default: AgoraRTM } = await import('agora-rtm')
      const rtm: RTMClient = new AgoraRTM.RTM(config.app_id, config.uid)
      const [agentId] = await Promise.all([
        startAgent(config.channel_name, Number(config.agent_uid), Number(config.uid), 'pipeline', {
          persona,
          language,
          patientId,
        }),
        (async () => {
          await rtm.login({ token: config.token })
          await waitForRtm(rtm)
          await rtm.subscribe(config.channel_name)
        })(),
      ])
      const s = { config, rtm, agentId }
      sessionRef.current = s
      setSession(s)
      setPhase('live')
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Could not start voice')
    }
  }, [persona, language, patientId])

  const stop = useCallback(async () => {
    const s = sessionRef.current
    sessionRef.current = null
    setSession(null)
    setAgentState(null)
    setAgentPresent(false)
    setMuted(false)
    setPhase('idle')
    await teardown(s)
  }, [])

  // Leaving the screen ends the session (and stops the cloud agent).
  useEffect(
    () => () => {
      teardown(sessionRef.current)
      sessionRef.current = null
    },
    [],
  )

  const statusLabel =
    phase === 'starting'
      ? 'Connecting to WardVoice…'
      : phase === 'live'
        ? !agentPresent
          ? 'Agent joining…'
          : muted
            ? 'Mic muted'
            : agentState === 'speaking'
              ? 'WardVoice speaking…'
              : agentState === 'thinking'
                ? 'Updating the record…'
                : 'Listening…'
        : phase === 'error'
          ? 'Voice unavailable'
          : 'Voice off'

  const onSessionError = useCallback((msg: string) => setError(msg), [])

  const slot: ReactNode = (
    <div className="mt-3">
      {phase === 'live' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
            className={cn(
              'flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium',
              muted ? 'bg-white text-wv-blue' : 'bg-white/15 text-white',
            )}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button
            type="button"
            onClick={stop}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-wv-red text-sm font-medium text-white"
          >
            <PhoneOff className="h-4 w-4" /> End voice
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled || phase === 'starting'}
          className="flex h-12 w-full items-center justify-between rounded-full bg-white pl-5 pr-1.5 text-sm font-medium text-wv-blue disabled:opacity-60"
        >
          {phase === 'starting' ? 'Connecting…' : phase === 'error' ? 'Retry voice' : startLabel}
          <span className="grid h-9 w-9 place-items-center rounded-full bg-wv-blue text-white">
            {phase === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </span>
        </button>
      )}
      {error && <p className="mt-2 rounded-2xl bg-white/15 px-3 py-2 text-xs leading-snug">{error}</p>}
      {session && (
        <VoiceSessionLive
          appId={session.config.app_id}
          channel={session.config.channel_name}
          token={session.config.token}
          uid={session.config.uid}
          agentUid={String(session.config.agent_uid)}
          rtm={session.rtm}
          muted={muted}
          onTranscript={setTranscript}
          onAgentState={setAgentState}
          onAgentPresent={setAgentPresent}
          onError={onSessionError}
        />
      )}
    </div>
  )

  return { phase, transcript, statusLabel, listening: phase === 'live' && !muted, slot }
}
