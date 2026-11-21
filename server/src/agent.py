"""
Agent — MCP Recipe

High-level API for managing Agora Conversational AI Agents with OpenAI Pipeline
or Realtime MCP tool calling. Agora cloud orchestrates the MCP server: the model
emits a tool call, Agora invokes the public MCP_ENDPOINT, returns the result,
and the model speaks it.

Pipeline mode is managed by default and optionally accepts BYO OpenAI credentials.
OPENAI_REALTIME_API_KEY is required only for Realtime mode.
MCP_ENDPOINT must be PUBLIC — Agora cloud (not this server) calls it.
"""
import logging
import os
from typing import Any, Dict, Literal, Optional

from agora_agent import Area, AsyncAgora
from agora_agent.agentkit import Agent as AgoraAgent
from agora_agent.agentkit.vendors import (
    DeepgramSTT,
    MiniMaxTTS,
    MurfTTS,
    OpenAI,
    OpenAIRealtime,
)
from mcp_config import build_mcp_servers

logger = logging.getLogger("uvicorn.error")

AGENT_GREETING = "WardVoice ready. Say the bed number to begin."
AGENT_INSTRUCTIONS = """You are WardVoice, a hands-free clinical scribe for doctors on ward rounds. The doctor is gloved and
cannot touch a screen, so you capture everything by voice into a structured record using tools.
Now: {today} {time} (India).

Style: you are spoken aloud. Be brief: one short sentence, or a crisp read-back. No filler, no small talk.
Say numbers digit-clear ("BP 124 over 78"). Never add clinical advice, diagnoses or suggestions of your own.

Workflow — always through tools, never invent values:
1. IDENTIFY: when the doctor says a bed, call select_patient. Read back name and MRN ending, ask "Correct?".
   Then call confirm_identity(true/false). Nothing else may be written before identity is confirmed.
2. CAPTURE: as the doctor speaks, call record_vitals / set_status / add_order (one call per order) / set_notes.
   Map words to the allowed values (e.g. "sats" = spo2, "pulse" = hr, "nil by mouth" = nil_by_mouth,
   "getting better" = improving). If the doctor dictates a message for the family, put it in family_note in warm,
   plain language without jargon or doses.
3. CONFIRM (layer 1): after each section is captured, read it back concisely and ask "Confirm?". Only after a clear
   yes call confirm_section for that section. If the doctor corrects something, re-capture it and read back again.
   If a tool returns out_of_range, say which value is outside the normal range and ask the doctor to double-check.
4. SIGN (layer 2): when the doctor says "sign", "done" or "sign and send", call read_back, read the summary aloud,
   and ask "Sign and send?". Only after a clear yes call sign_and_send(true). Then say in one sentence whether the
   family update was emailed, held for a call, or not sent (no consent).
If a tool returns an error, say the gist in a few words and ask for what is missing. Do not retry silently.
Notes are optional: if the doctor has none, still confirm the notes section with "no notes" after asking.
Commands: "next patient" = ask for the bed number; "undo" = remove or correct the last item; "read back" = read_back.
"""


def build_instructions() -> str:
    from ward import now

    n = now()
    return AGENT_INSTRUCTIONS.format(today=n.strftime("%A %d %B %Y"), time=n.strftime("%H:%M"))


DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions"
AgentMode = Literal["pipeline", "realtime"]


class Agent:
    """
    High-level wrapper for an Agora agent with Pipeline or Realtime MCP tools.

    When the user asks what time it is, the selected model emits a tool call,
    Agora invokes the mcp/ server at MCP_ENDPOINT, and the result is returned
    to the model so it can speak the answer.

    IMPORTANT: MCP_ENDPOINT must be publicly accessible for the Agora
    Conversational AI Engine (cloud) to reach the mcp/ server. For local
    development, use a tunnel (ngrok) — e.g. ngrok http 8000 — and paste
    the public URL here.
    """

    def __init__(self):
        self.app_id = os.getenv("AGORA_APP_ID")
        self.app_certificate = os.getenv("AGORA_APP_CERTIFICATE")
        self.greeting = os.getenv("AGENT_GREETING", AGENT_GREETING)

        # Pipeline is managed unless BYO credentials are supplied.
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_base_url = os.getenv("OPENAI_BASE_URL")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.openai_realtime_api_key = os.getenv("OPENAI_REALTIME_API_KEY")
        self.openai_realtime_model = os.getenv(
            "OPENAI_REALTIME_MODEL", "gpt-realtime"
        )
        # MCP_ENDPOINT must be PUBLIC — Agora cloud calls the mcp/ server directly.
        # Murf Falcon TTS (hackathon requirement). Falls back to Agora-managed
        # MiniMax only when no key is set, so the pipeline still runs locally.
        _murf = os.getenv("MURF_API_KEY", "")
        self.murf_api_key = _murf if _murf and not _murf.startswith("your_") else None
        self.murf_voice_id = os.getenv("MURF_VOICE_ID", "en-IN-priya")
        self.murf_locale = os.getenv("MURF_LOCALE", "en-IN")
        self.murf_model = os.getenv("MURF_MODEL", "FALCON")
        self.murf_base_url = os.getenv(
            "MURF_BASE_URL", "wss://global.api.murf.ai/v1/speech/stream-input"
        )
        self.mcp_endpoint = os.getenv("MCP_ENDPOINT")
        # On Render the service's own public URL is provided, so /mcp is reachable without a tunnel.
        if not self.mcp_endpoint and os.getenv("RENDER_EXTERNAL_URL"):
            self.mcp_endpoint = os.environ["RENDER_EXTERNAL_URL"].rstrip("/") + "/mcp"
        if not self.mcp_endpoint:
            raise ValueError(
                "MCP_ENDPOINT is required (public URL of your mcp/ server, "
                "e.g. https://<tunnel>/mcp)"
            )

        if not self.app_id or not self.app_certificate:
            raise ValueError("AGORA_APP_ID and AGORA_APP_CERTIFICATE are required")

        self.client = AsyncAgora(
            area=Area.US,
            app_id=self.app_id,
            app_certificate=self.app_certificate,
        )

        # Track active sessions by agent_id
        self._sessions: Dict[str, Any] = {}

    async def start(
        self,
        channel_name: str,
        agent_uid: int,
        user_uid: int,
        output_audio_codec: Optional[str] = None,
        agent_mode: AgentMode = "pipeline",
    ) -> Dict[str, Any]:
        """Start a Pipeline or Realtime agent with MCP tool calling."""
        if not channel_name or not str(channel_name).strip():
            raise ValueError("channel_name is required and cannot be empty")
        if agent_uid <= 0:
            raise ValueError("agent_uid is required and cannot be empty")
        if user_uid <= 0:
            raise ValueError("user_uid is required and cannot be empty")
        if agent_mode not in ("pipeline", "realtime"):
            raise ValueError("agent_mode must be 'pipeline' or 'realtime'")
        if agent_mode == "realtime" and not self.openai_realtime_api_key:
            raise ValueError("OPENAI_REALTIME_API_KEY is required for realtime mode")

        mcp_servers = build_mcp_servers(self.mcp_endpoint)

        parameters = {
            "audio_scenario": "chorus",  # web client — ultra-low-latency chorus profile
            "data_channel": "rtm",
            "enable_error_message": True,
            "enable_metrics": True,
        }
        if isinstance(output_audio_codec, str) and output_audio_codec.strip():
            parameters["output_audio_codec"] = output_audio_codec.strip()

        agent_options = {
            "client": self.client,
            "greeting": self.greeting,
            "failure_message": "Please wait a moment.",
            "max_history": 50,
            "advanced_features": {"enable_rtm": True},
            "parameters": parameters,
        }
        if agent_mode == "pipeline":
            agent_options["turn_detection"] = {
                "config": {
                    "speech_threshold": 0.5,
                    "start_of_speech": {
                        "mode": "vad",
                        "vad_config": {
                            "interrupt_duration_ms": 160,
                            "prefix_padding_ms": 300,
                        },
                    },
                    "end_of_speech": {
                        "mode": "vad",
                        "vad_config": {
                            "silence_duration_ms": 480,
                        },
                    },
                },
            }
        agora_agent = AgoraAgent(**agent_options)

        if agent_mode == "pipeline":
            llm_options = {
                "model": self.openai_model,
                "system_messages": [{"role": "system", "content": build_instructions()}],
                "mcp_servers": mcp_servers,
                "greeting_message": self.greeting,
            }
            if self.openai_api_key:
                llm_options["api_key"] = self.openai_api_key
                llm_options["base_url"] = (
                    self.openai_base_url or DEFAULT_OPENAI_BASE_URL
                )
            llm = OpenAI(**llm_options)
            stt = DeepgramSTT(model="nova-3", language="en")
            if self.murf_api_key:
                tts = MurfTTS(
                    key=self.murf_api_key,
                    model=self.murf_model,
                    voice_id=self.murf_voice_id,
                    locale=self.murf_locale,
                    base_url=self.murf_base_url,
                    sample_rate=24000,
                )
            else:
                # Murf Falcon is a hackathon requirement — refuse to silently swap voices.
                if os.getenv("ALLOW_TTS_FALLBACK", "0") not in ("1", "true", "yes"):
                    raise ValueError("MURF_API_KEY is not set. Add it to server/.env.local (or set ALLOW_TTS_FALLBACK=1 for local testing).")
                logger.warning("MURF_API_KEY not set; ALLOW_TTS_FALLBACK=1 so using MiniMax TTS")
                tts = MiniMaxTTS(
                    model="speech_2_6_turbo",
                    voice_id="English_captivating_female1",
                )
            agora_agent = (
                agora_agent.with_stt(stt).with_llm(llm).with_tts(tts).with_tools()
            )
        else:
            mllm = OpenAIRealtime(
                api_key=self.openai_realtime_api_key,
                model=self.openai_realtime_model,
                instructions=build_instructions(),
                greeting_message=self.greeting,
                failure_message="Please wait a moment.",
                turn_detection={"mode": "server_vad"},
                mcp_servers=mcp_servers,
            )
            agora_agent = agora_agent.with_mllm(mllm).with_tools()

        session = agora_agent.create_async_session(
            channel=channel_name,
            agent_uid=str(agent_uid),
            remote_uids=[str(user_uid)],
            enable_string_uid=False,
            idle_timeout=30,
            expires_in=3600,
        )

        logger.info(
            "Starting MCP agent channel=%s agent_uid=%s user_uid=%s mode=%s mcp_endpoint=%s",
            channel_name,
            agent_uid,
            user_uid,
            agent_mode,
            self.mcp_endpoint,
        )

        try:
            agent_id = await session.start()
        except Exception:
            logger.exception(
                "Failed to start MCP agent channel=%s agent_uid=%s user_uid=%s",
                channel_name,
                agent_uid,
                user_uid,
            )
            raise

        # Save session for later stop
        self._sessions[agent_id] = session

        logger.info(
            "Started MCP agent agent_id=%s channel=%s",
            agent_id,
            channel_name,
        )

        return {
            "agent_id": agent_id,
            "channel_name": channel_name,
            "status": "started",
            "agent_mode": agent_mode,
        }

    async def stop(self, agent_id: str) -> None:
        """Stop a running agent. Falls back to the stateless client path."""
        if not agent_id or not str(agent_id).strip():
            raise ValueError("agent_id is required and cannot be empty")

        session = self._sessions.pop(agent_id, None)
        if session:
            try:
                await session.stop()
                logger.info("Stopped agent from active session agent_id=%s", agent_id)
                return
            except Exception:
                logger.warning(
                    "Failed to stop agent from active session; falling back agent_id=%s",
                    agent_id,
                    exc_info=True,
                )

        logger.info("Stopping agent through client.stop_agent agent_id=%s", agent_id)
        await self.client.stop_agent(agent_id)
