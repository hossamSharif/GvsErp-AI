"""Offline unit tests — no LLM, no ERP API, no Supabase.

Verifies the small bits of pure logic that Phase 7 introduced:
  * ``confirmation_key`` is deterministic and order-independent in args.
  * ``loop._confirmation_key`` agrees with ``graph.confirmation_key``.
"""

from __future__ import annotations

from src.agent.graph import confirmation_key
from src.agent.loop import _confirmation_key


def test_confirmation_key_is_deterministic() -> None:
    a = confirmation_key("send_email", {"to": "x@y.com", "body": "hi"})
    b = confirmation_key("send_email", {"to": "x@y.com", "body": "hi"})
    assert a == b


def test_confirmation_key_ignores_arg_order() -> None:
    a = confirmation_key("send_email", {"to": "x@y.com", "body": "hi"})
    b = confirmation_key("send_email", {"body": "hi", "to": "x@y.com"})
    assert a == b


def test_confirmation_key_changes_with_value() -> None:
    a = confirmation_key("send_email", {"to": "x@y.com"})
    b = confirmation_key("send_email", {"to": "z@y.com"})
    assert a != b


def test_loop_and_graph_keys_match() -> None:
    args = {"to": "ops@acme.com", "subject": "Q2"}
    assert _confirmation_key("send_email", args) == confirmation_key("send_email", args)


def test_keys_are_namespaced_by_tool() -> None:
    args = {"id": "abc"}
    assert confirmation_key("send_email", args) != confirmation_key("send_whatsapp", args)
