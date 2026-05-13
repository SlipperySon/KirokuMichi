#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any, Optional

import pypdfium2 as pdfium

PROJECT_ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = PROJECT_ROOT / "app"


def main() -> None:
    args = parse_args()
    pack = read_json(resolve_path(args.pack))
    manifest = read_json(resolve_path(args.manifest))
    source_by_id = {entry["id"]: entry for entry in manifest["entries"]}
    documents: dict[str, pdfium.PdfDocument] = {}

    cropped = 0
    for item in iter_image_items(pack):
        image_file = item.get("imageFile")
        image_ref = item.get("imageSourceRef") or item.get("sourceRef")
        if not image_file or not image_ref:
            continue

        source_id = image_ref.get("sourceId")
        page_number = image_ref.get("pageNumber")
        coordinates = image_ref.get("coordinates")
        if not source_id or not isinstance(page_number, int) or not valid_coordinates(coordinates):
            raise SystemExit(f"{item.get('id', '<unknown>')} has an imageFile but no usable imageSourceRef coordinates")

        source_entry = source_by_id.get(source_id)
        if not source_entry:
            raise SystemExit(f"Source {source_id} is referenced by an image item but is missing from the manifest")

        source_pdf = resolve_path(source_entry["relativePath"])
        document = documents.get(source_id)
        if document is None:
            document = pdfium.PdfDocument(str(source_pdf))
            documents[source_id] = document

        page = document[page_number - 1]
        bitmap = page.render(scale=args.dpi / 72)
        image = bitmap.to_pil()
        crop = image.crop(tuple(round(value) for value in coordinates))
        output_file = resolve_path(image_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        crop.save(output_file)
        cropped += 1

    print(f"cropped {cropped} reviewed image assets")


def iter_image_items(pack: dict[str, Any]):
    for lesson in pack.get("lessons", []):
        for section in ("contentBlocks", "exercises"):
            for item in lesson.get(section, []):
                if item.get("imageFile"):
                    yield item


def valid_coordinates(value: Any) -> bool:
    if not isinstance(value, list) or len(value) != 4:
        return False
    if not all(isinstance(number, (int, float)) for number in value):
        return False
    x1, y1, x2, y2 = value
    return x2 > x1 and y2 > y1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crop reviewed textbook image assets from their source PDFs.")
    parser.add_argument("--pack", default="tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1.json")
    parser.add_argument("--manifest", default="tools/textbook-pack/out/source-manifest.json")
    parser.add_argument("--dpi", type=int, default=120)
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
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
