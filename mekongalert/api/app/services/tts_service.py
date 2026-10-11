import tempfile

import edge_tts

# §2: edge-tts voices for th-TH, zh-CN, vi-VN, lo-LA, en-US.
VOICE_MAP = {
    "th": "th-TH-PremwadeeNeural",
    "zh-CN": "zh-CN-XiaoxiaoNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "lo": "lo-LA-KeomanyNeural",
    "en": "en-US-AriaNeural",
}


async def synthesize(text: str, lang: str) -> bytes:
    voice = VOICE_MAP.get(lang, VOICE_MAP["en"])
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(f.name)
        f.seek(0)
        return f.read()
