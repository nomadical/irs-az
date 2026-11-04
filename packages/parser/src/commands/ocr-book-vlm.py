"""Transcribe page images with a local vision model (mlx-vlm), for `ocr-book --engine vlm`.

usage: ocr-book-vlm.py <model> <lang> <out.json> <page image>...
Writes {"<image>": "<text>"} as JSON. Loads the model once; prints progress to stderr.
Near-blank pages (only show-through from the other side) are skipped: the model invents text on them.
"""
import json
import sys
import time

from PIL import Image
from mlx_vlm import generate, load
from mlx_vlm.prompt_utils import apply_chat_template
from mlx_vlm.utils import load_config

model_id, lang, out, images = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]

LAYOUT = (
    "Verse: one printed line per line, a blank line between stanzas. Prose: each paragraph on ONE line "
    "(join its printed lines, rejoin words hyphenated at line ends), a blank line between paragraphs. "
    "Put each title on its own line starting with '# '. Skip the page number and any running head. "
    "If the page has footnotes, put them last, after a line '---'. Output only the transcription."
)
PROMPTS = {
    "aze_cyrl": "This is a page of an Azerbaijani book printed in the Azerbaijani Cyrillic alphabet (with ә ғ ҝ ҹ һ ө ү ј). "
    "Transcribe ALL the text exactly as printed, in Cyrillic. " + LAYOUT,
    "aze": "This is a page of an Azerbaijani book printed in the Latin alphabet (with ə ğ ı ö ü ç ş). "
    "Transcribe ALL the text exactly as printed. " + LAYOUT,
    "aze_yanalif": "This page is printed in the 1920s Azerbaijani Latin alphabet (Yanalif). Transcribe ALL the text exactly as printed, "
    "letter for letter, in Latin letters only (never switch to Cyrillic, whatever the words are); do NOT modernise the spelling. Write its special letters as: the letter like a Cyrillic з → 'ʒ'; the dotless i "
    "with a hook (ɩ/ь) → 'ı'; o with a bar (ɵ) → 'ɵ'; the q-like letter with a hook at the bottom (ƣ) → 'ƣ'; schwa → 'ə'. "
    + LAYOUT + " Skip the library footer.",
}


def blank(path: str) -> bool:
    im = Image.open(path).convert("L")
    im.thumbnail((600, 600))
    hist = im.histogram()
    return sum(hist[:100]) / sum(hist) < 0.003


def page_for_model(path: str, tmp: str) -> str:
    im = Image.open(path).convert("RGB")
    if im.height > 1500:
        im = im.resize((round(im.width * 1500 / im.height), 1500), Image.Resampling.LANCZOS)
    im.save(tmp, quality=90)
    return tmp


def looped(text: str) -> bool:
    lines = [l for l in text.split("\n") if l.strip()]
    return len(lines) > 8 and len(set(lines)) < len(lines) / 3


model, processor = load(model_id)
config = load_config(model_id)
prompt = apply_chat_template(processor, config, PROMPTS[lang], num_images=1)
result = {}
for i, path in enumerate(images, 1):
    if blank(path):
        result[path] = ""
        print(f"  page {i}/{len(images)} blank", file=sys.stderr, flush=True)
        continue
    t0 = time.time()
    r = generate(model, processor, prompt, [page_for_model(path, out + ".page.jpg")], max_tokens=2500, temperature=0.0, verbose=False)
    text = getattr(r, "text", r).strip()
    if looped(text):
        text = "[VLM LOOPED – check this page]"
    result[path] = text
    print(f"  page {i}/{len(images)} {time.time() - t0:.0f}s", file=sys.stderr, flush=True)
json.dump(result, open(out, "w", encoding="utf-8"), ensure_ascii=False)
