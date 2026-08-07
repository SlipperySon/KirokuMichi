#!/usr/bin/env python3
"""
Minimal HTTP sidecar for Sarashina2.2-TTS.

Install Sarashina per upstream docs, then:
  export SARASHINA_PROMPT_WAV=/path/to/prompt.wav
  export SARASHINA_PROMPT_TEXT='Prompt transcript ending with 。'
  python server.py

KirokuMichi Express proxies here via SARASHINA_TTS_URL=http://127.0.0.1:7861
Swap TTS_PROVIDER=elevenlabs later without changing the app client.
"""

from __future__ import annotations

import json
import os
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.environ.get("SARASHINA_SIDECAR_HOST", "127.0.0.1")
PORT = int(os.environ.get("SARASHINA_SIDECAR_PORT", "7861"))
PROMPT_WAV = os.environ.get("SARASHINA_PROMPT_WAV", "").strip()
PROMPT_TEXT = os.environ.get("SARASHINA_PROMPT_TEXT", "").strip()
MODEL_DIR = os.environ.get("SARASHINA_MODEL_DIR") or None
USE_VLLM = os.environ.get("SARASHINA_USE_VLLM", "").strip() in {"1", "true", "yes"}

_generator = None
_prompt_cache = None


def _load_generator():
    global _generator, _prompt_cache
    if _generator is not None:
        return _generator, _prompt_cache

    if not PROMPT_WAV or not Path(PROMPT_WAV).is_file():
        raise RuntimeError(
            "Set SARASHINA_PROMPT_WAV to a ~3–8s Japanese speech WAV "
            "(required for zero-shot voice cloning)."
        )
    if not PROMPT_TEXT:
        raise RuntimeError(
            "Set SARASHINA_PROMPT_TEXT to the exact transcript of the prompt WAV "
            "(end with 。 or appropriate punctuation)."
        )

    from sarashina_tts.generate.generate import SarashinaTTSGenerator

    gen = SarashinaTTSGenerator(model_dir=MODEL_DIR, use_vllm=USE_VLLM, watermark=True)
    flow_emb = gen._extract_zero_shot_embedding(PROMPT_WAV)
    tokens = gen._extract_audio_prompt_tokens(PROMPT_WAV)
    feat = gen._extract_audio_prompt_feat(PROMPT_WAV)
    _generator = gen
    _prompt_cache = (flow_emb, tokens, feat)
    return _generator, _prompt_cache


def synthesize_wav(text: str) -> bytes:
    text = (text or "").strip()
    if not text:
        raise ValueError("text is required")
    if len(text) > 500:
        raise ValueError("text too long (max 500 characters)")
    # Sarashina prompting guide: end with punctuation to avoid cutoffs.
    if text[-1] not in "。．.!？?":
        text = text + "。"

    gen, (flow_emb, tokens, feat) = _load_generator()
    wavs = gen.generate(
        texts=[text],
        flow_embedding=flow_emb,
        audio_prompt_path=PROMPT_WAV,
        audio_prompt_text=PROMPT_TEXT,
        audio_prompt_tokens=tokens,
        audio_prompt_feat=feat,
        watermark=True,
    )
    if not wavs:
        raise RuntimeError("Sarashina returned no audio")

    with tempfile.TemporaryDirectory() as tmp:
        paths = gen.save_audios(wavs, output_dir=tmp)
        return Path(paths[0]).read_bytes()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[sarashina-sidecar] {self.address_string()} - {fmt % args}")

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/health", "/"):
            ready = False
            detail = "not loaded"
            try:
                if PROMPT_WAV and PROMPT_TEXT and Path(PROMPT_WAV).is_file():
                    ready = True
                    detail = "prompt configured"
                else:
                    detail = "missing SARASHINA_PROMPT_WAV / SARASHINA_PROMPT_TEXT"
            except Exception as exc:  # noqa: BLE001
                detail = str(exc)
            self._send_json(200, {"ok": True, "ready": ready, "detail": detail})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/synthesize":
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
            text = str(payload.get("text") or "")
            audio = synthesize_wav(text)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._send_json(500, {"error": str(exc)})
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)


def main() -> None:
    print(f"[sarashina-sidecar] listening on http://{HOST}:{PORT}")
    print("[sarashina-sidecar] Non-commercial Sarashina license — do not use in paid products without a commercial grant.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[sarashina-sidecar] shutting down")


if __name__ == "__main__":
    main()
