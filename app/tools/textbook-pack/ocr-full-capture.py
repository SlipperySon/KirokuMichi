#!/usr/bin/env python3
import argparse
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = PROJECT_ROOT / "app"
os.environ["HOME"] = str(PROJECT_ROOT / ".paddle-home")
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

import pypdfium2 as pdfium
from paddleocr import PaddleOCR


def main() -> None:
    args = parse_args()
    manifest = read_json(args.manifest)
    entry = find_source(manifest, args.source_id)
    source_path = resolve_path(entry["relativePath"])
    output_root = resolve_path(args.out) / entry["id"]
    pages_dir = output_root / "pages"
    raw_dir = output_root / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    if args.save_page_images:
        pages_dir.mkdir(parents=True, exist_ok=True)

    page_numbers = resolve_page_numbers(args, entry["pageCount"])
    start_page = page_numbers[0]
    end_page = page_numbers[-1]

    capture_meta = {
        "sourceId": entry["id"],
        "fileName": entry["fileName"],
        "relativePath": entry["relativePath"],
        "textbookKey": entry["textbookKey"],
        "curriculumRole": entry.get("curriculumRole"),
        "cefrPhase": entry.get("cefrPhase"),
        "role": entry["role"],
        "fingerprint": entry["fingerprint"],
        "pageCount": entry["pageCount"],
        "capture": {
            "dpi": args.dpi,
            "lang": args.lang,
            "ocrVersion": args.ocr_version,
            "startPage": start_page,
            "endPage": end_page,
            "pages": page_numbers,
            "fullSource": args.pages is None and args.max_pages is None and start_page == 1,
            "createdAt": now_iso(),
        },
        "pages": [],
    }

    print(f"OCR capture: {entry['id']} pages {start_page}-{end_page} of {entry['pageCount']}")
    document = pdfium.PdfDocument(str(source_path))
    ocr = PaddleOCR(
        lang=args.lang,
        ocr_version=args.ocr_version,
        text_detection_model_name=args.text_detection_model,
        text_recognition_model_name=args.text_recognition_model,
        use_doc_orientation_classify=args.use_doc_orientation,
        use_doc_unwarping=args.use_doc_unwarping,
        use_textline_orientation=args.use_textline_orientation,
        device=args.device,
        return_word_box=args.return_word_box,
    )

    with tempfile.TemporaryDirectory(prefix="kiroku-ocr-") as temp_dir:
        temp_root = Path(temp_dir)
        for page_number in page_numbers:
            started = time.time()
            image_path, image_size = render_page(
                document=document,
                page_number=page_number,
                dpi=args.dpi,
                temp_root=temp_root,
                pages_dir=pages_dir if args.save_page_images else None,
            )
            results = list(ocr.predict(str(image_path)))
            raw_results = [result.json["res"] for result in results]
            combined_texts = []
            for result in raw_results:
                combined_texts.extend(result.get("rec_texts", []))
            page_payload = {
                "sourceId": entry["id"],
                "pageNumber": page_number,
                "image": {
                    "width": image_size[0],
                    "height": image_size[1],
                    "dpi": args.dpi,
                    "path": str((pages_dir / image_path.name).relative_to(APP_ROOT)) if args.save_page_images else None,
                },
                "text": "\n".join(combined_texts),
                "lineCount": len(combined_texts),
                "rawResults": raw_results,
                "elapsedSeconds": round(time.time() - started, 3),
            }
            page_file = raw_dir / f"page-{page_number:04d}.json"
            write_json(page_file, page_payload)
            capture_meta["pages"].append(
                {
                    "pageNumber": page_number,
                    "lineCount": page_payload["lineCount"],
                    "elapsedSeconds": page_payload["elapsedSeconds"],
                    "rawFile": str(page_file.relative_to(APP_ROOT)),
                    "imageFile": page_payload["image"]["path"],
                }
            )
            print(f"page {page_number}: {page_payload['lineCount']} lines in {page_payload['elapsedSeconds']}s")

    if hasattr(ocr, "close"):
        ocr.close()
    write_json(output_root / "capture-manifest.json", capture_meta)
    print(f"Wrote {output_root.relative_to(APP_ROOT)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture full-source PaddleOCR output for a textbook source.")
    parser.add_argument("--manifest", default="tools/textbook-pack/out/source-manifest.json")
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--out", default="tools/textbook-pack/out/ocr")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--lang", default="japan")
    parser.add_argument("--ocr-version", default="PP-OCRv5")
    parser.add_argument("--text-detection-model", default="PP-OCRv5_mobile_det")
    parser.add_argument("--text-recognition-model", default="PP-OCRv5_mobile_rec")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--pages", help="Comma-separated 1-based page numbers. Overrides --start-page/--max-pages.")
    parser.add_argument("--save-page-images", action="store_true")
    parser.add_argument("--use-doc-orientation", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--use-doc-unwarping", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--use-textline-orientation", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--return-word-box", action=argparse.BooleanOptionalAction, default=False)
    return parser.parse_args()


def resolve_page_numbers(args: argparse.Namespace, page_count: int) -> list:
    if args.pages:
        pages = []
        for raw in args.pages.split(","):
            raw = raw.strip()
            if not raw:
                continue
            page = int(raw)
            if page < 1 or page > page_count:
                raise SystemExit(f"Page {page} is outside source page range 1-{page_count}")
            pages.append(page)
        if not pages:
            raise SystemExit("--pages was provided but no valid pages were found")
        return sorted(dict.fromkeys(pages))

    start_page = max(args.start_page, 1)
    end_page = page_count if args.max_pages is None else min(page_count, start_page + args.max_pages - 1)
    return list(range(start_page, end_page + 1))


def read_json(path_value: str) -> dict:
    return json.loads(resolve_path(path_value).read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    app_path = APP_ROOT / path
    if app_path.exists() or path.parts[:1] == ("tools",):
        return app_path
    return PROJECT_ROOT / path


def find_source(manifest: dict, source_id: str) -> dict:
    for entry in manifest["entries"]:
        if entry["id"] == source_id:
            return entry
    raise SystemExit(f"Unknown source id: {source_id}")


def render_page(document: pdfium.PdfDocument, page_number: int, dpi: int, temp_root: Path, pages_dir: Optional[Path]) -> Tuple[Path, Tuple[int, int]]:
    page = document[page_number - 1]
    bitmap = page.render(scale=dpi / 72)
    image = bitmap.to_pil()
    file_name = f"page-{page_number:04d}.png"
    image_path = temp_root / file_name
    image.save(image_path)
    if pages_dir is not None:
        image.save(pages_dir / file_name)
    return image_path, image.size


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


if __name__ == "__main__":
    main()
