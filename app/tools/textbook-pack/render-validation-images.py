#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Optional

import pypdfium2 as pdfium

PROJECT_ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = PROJECT_ROOT / "app"


def main() -> None:
    args = parse_args()
    proof = read_json(resolve_path(args.proof))
    manifest = read_json(resolve_path(args.manifest))
    output_root = resolve_path(args.out)

    page_map = collect_pages(proof)
    source_by_id = {entry["id"]: entry for entry in manifest["entries"]}

    rendered = 0
    for source_id, page_numbers in sorted(page_map.items()):
        entry = source_by_id.get(source_id)
        if not entry:
            raise SystemExit(f"Source {source_id} is referenced by the proof but is missing from the manifest")

        source_pdf = resolve_path(entry["relativePath"])
        out_dir = output_root / "pages" / source_id
        out_dir.mkdir(parents=True, exist_ok=True)
        document = pdfium.PdfDocument(str(source_pdf))

        for page_number in sorted(page_numbers):
            out_file = out_dir / f"page-{page_number:04d}.png"
            if out_file.exists() and not args.force:
                continue
            page = document[page_number - 1]
            bitmap = page.render(scale=args.dpi / 72)
            image = bitmap.to_pil()
            image.save(out_file)
            rendered += 1

    print(f"rendered {rendered} validation page images into {output_root.relative_to(APP_ROOT)}")


def collect_pages(proof: dict) -> dict[str, set[int]]:
    pages: dict[str, set[int]] = {}
    for lesson in proof.get("lessons", []):
        for section in ("vocabulary", "grammar", "contentBlocks", "exercises"):
            for item in lesson.get(section, []):
                add_ref(pages, item.get("sourceRef"))
                add_ref(pages, item.get("answerKeyRef"))
                for answer_ref in item.get("answerKeyRefs") or []:
                    add_ref(pages, answer_ref)
                add_ref(pages, item.get("listeningScriptRef"))
    return pages


def add_ref(pages: dict[str, set[int]], ref: Optional[dict]) -> None:
    if not ref:
        return
    source_id = ref.get("sourceId")
    page_number = ref.get("pageNumber")
    if not source_id or not isinstance(page_number, int):
        return
    pages.setdefault(source_id, set()).add(page_number)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render proof source pages for the textbook validation viewer.")
    parser.add_argument("--proof", default="tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json")
    parser.add_argument("--manifest", default="tools/textbook-pack/out/source-manifest.json")
    parser.add_argument("--out", default="tools/textbook-pack/out/validation-viewer/genki_1_lesson_1")
    parser.add_argument("--dpi", type=int, default=120)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    app_path = APP_ROOT / path
    if app_path.exists() or path.parts[:1] == ("tools",):
        return app_path
    return PROJECT_ROOT / path


if __name__ == "__main__":
    main()
