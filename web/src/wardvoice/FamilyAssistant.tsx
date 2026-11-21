'use client'

import { Languages, MessageCircleQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { useVoiceRound } from './VoiceControl'

/** Languages the family assistant speaks (Murf Falcon voices); keep in sync with FAMILY_LANGS in server/src/agent.py. */
export const FAMILY_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', hint: 'Ask in English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', hint: 'हिन्दी में पूछें' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', hint: 'Ask in English or Hindi · replies in ಕನ್ನಡ' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', hint: 'Ask in English or Hindi · replies in தமிழ்' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', hint: 'Ask in English or Hindi · replies in বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', hint: 'Ask in English or Hindi · replies in मराठी' },
] as const

const KEY = 'wv-family-lang'

function readLang(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** First-visit language picker; the choice is remembered and can be changed on the assistant card. */
export function useFamilyLanguage() {
  const [lang, setLangState] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLangState(readLang())
    setLoaded(true)
  }, [])
  const setLang = (code: string) => {
    setLangState(code)
    try {
      localStorage.setItem(KEY, code)
    } catch {}
  }
  return { lang, setLang, needsChoice: loaded && !lang }
}

export function LanguagePicker({ onPick }: { onPick: (code: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/30 sm:place-items-center">
      <div className="w-full max-w-[420px] rounded-t-[28px] bg-wv-page p-6 shadow-wv sm:rounded-[28px]">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-wv-blue text-white">
          <Languages className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-2xl font-medium tracking-[-0.02em]">Choose your language</h2>
        <p className="mt-1 text-sm text-wv-muted">
          The voice assistant will explain today's update in this language. You can change it any time.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {FAMILY_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onPick(l.code)}
              className="rounded-[20px] bg-wv-card px-4 py-3 text-left shadow-wv-sm transition hover:ring-2 hover:ring-wv-blue"
            >
              <span className="block text-lg font-medium">{l.native}</span>
              <span className="text-xs text-wv-muted">{l.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Voice helper that explains the signed update (terms, numbers, plan) in the family's language. Read-only: no tools. */
export function FamilyAssistant({
  patientId,
  lang,
  onChangeLang,
}: { patientId: string; lang: string; onChangeLang: (c: string) => void }) {
  const meta = FAMILY_LANGUAGES.find((l) => l.code === lang) ?? FAMILY_LANGUAGES[0]
  const voice = useVoiceRound({
    persona: 'family',
    language: meta.code,
    patientId,
    startLabel: "Ask about today's update",
  })
  const recent = voice.transcript.slice(-3)

  return (
    <div className="mt-4 rounded-[28px] bg-wv-blue p-4 text-white shadow-wv-blue">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
          <MessageCircleQuestion className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Questions about these words?</p>
          <p className="text-xs leading-snug text-white/80">
            {voice.phase === 'live'
              ? voice.statusLabel
              : `Ask what "SpO2", "oral antibiotics" or any term means. ${meta.hint}.`}
          </p>
        </div>
      </div>

      {voice.phase !== 'live' && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {FAMILY_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onChangeLang(l.code)}
              aria-pressed={l.code === meta.code}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium',
                l.code === meta.code ? 'bg-white text-wv-blue' : 'bg-white/15 text-white',
              )}
            >
              {l.native}
            </button>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {recent.map((t) => (
            <p
              key={`${t.ts}-${t.who}-${t.text.slice(0, 12)}`}
              className={cn(
                'rounded-2xl px-3 py-2 text-xs leading-snug',
                t.who === 'agent' ? 'bg-white/15' : 'bg-white text-wv-ink',
              )}
            >
              {t.text}
            </p>
          ))}
        </div>
      )}

      {voice.slot}
      <p className="mt-2 text-[10px] leading-snug text-white/70">
        Explains only what your doctor signed. For medical decisions, call the ward desk.
      </p>
    </div>
  )
}
