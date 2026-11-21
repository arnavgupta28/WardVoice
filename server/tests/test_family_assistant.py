"""Family assistant: read-only (no MCP tools), speaks the chosen language, grounded in the signed update."""
import asyncio
import sys


def _fresh_agent_module():
    sys.modules.pop("agent", None)
    import agent
    return agent


def _start_family(agent, monkeypatch, language):
    captured = {}

    class FakeSession:
        async def start(self):
            return "fam-agent"

    def fake_create_async_session(self, **kwargs):
        captured["llm"] = self.llm
        captured["tts"] = self.tts
        captured["stt"] = self.stt
        return FakeSession()

    from agora_agent.agentkit import Agent as AgoraAgent
    monkeypatch.setattr(AgoraAgent, "create_async_session", fake_create_async_session)
    instance = agent.Agent()
    asyncio.run(instance.start(channel_name="ch", agent_uid=111, user_uid=222, persona="family",
                               language=language, family_context="Overall condition: Getting better."))
    return captured


def test_family_agent_has_no_tools_and_uses_language_voice(fake_env, monkeypatch):
    monkeypatch.setenv("MURF_API_KEY", "murf-test-key")
    agent = _fresh_agent_module()
    cap = _start_family(agent, monkeypatch, "kn")
    assert not cap["llm"].get("mcp_servers")
    system = cap["llm"]["system_messages"][0]["content"]
    assert "Reply ONLY in Kannada" in system
    assert "Getting better" in system
    assert cap["tts"]["params"]["voiceId"] == "kn-IN-harshitha"
    assert cap["stt"]["params"]["language"] == "multi"


def test_family_agent_hindi_listens_in_hindi(fake_env, monkeypatch):
    monkeypatch.setenv("MURF_API_KEY", "murf-test-key")
    agent = _fresh_agent_module()
    cap = _start_family(agent, monkeypatch, "hi")
    assert cap["stt"]["params"]["language"] == "hi"
    assert cap["tts"]["params"]["voiceId"] == "hi-IN-khyati"


def test_family_context_uses_latest_signed_report_only():
    import ward
    import server

    ward.reset()
    text = server.family_context("P1")
    assert "Ramesh Kumar" in text
    assert "signed by" in text
    assert server.family_context("NOPE").startswith("There is no signed update")
