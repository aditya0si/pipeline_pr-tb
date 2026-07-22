"""
test_chandra_provider.py — Unit tests for Chandra OCR provider.
"""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from backend.ocr.providers.chandra_provider import (
    ChandraOCRProvider,
    detect_attn_implementation,
    get_compute_dtype,
    resize_image,
)
from PIL import Image


class TestChandraProvider(unittest.TestCase):

    def test_resize_image_under_max(self):
        img = Image.new("RGB", (500, 500))
        res, info = resize_image(img, max_megapixels=1.0)
        self.assertEqual(res.size, (500, 500))
        self.assertIn("0.25 MP", info)

    def test_resize_image_over_max(self):
        img = Image.new("RGB", (2000, 2000)) # 4 MP
        res, info = resize_image(img, max_megapixels=1.0)
        self.assertLessEqual(res.size[0] * res.size[1], 1_050_000)
        self.assertIn("Resized image", info)

    def test_detect_attn_implementation(self):
        impl, desc = detect_attn_implementation()
        self.assertIn(impl, ["flash_attention_2", "sdpa"])
        self.assertTrue(len(desc) > 0)

    @patch("backend.ocr.providers.chandra_provider._load_chandra_model")
    def test_chandra_provider_extract_text(self, mock_load):
        mock_model = MagicMock()
        mock_processor = MagicMock()
        mock_load.return_value = (mock_model, mock_processor)

        provider = ChandraOCRProvider(max_megapixels=1.0)

        # Mock chandra generate_hf and parse_markdown
        with patch.dict("sys.modules", {
            "chandra": MagicMock(),
            "chandra.model.schema": MagicMock(),
            "chandra.model.hf": MagicMock(),
            "chandra.output": MagicMock(),
        }):
            import sys
            mock_hf = sys.modules["chandra.model.hf"]
            mock_out = sys.modules["chandra.output"]

            mock_item = MagicMock()
            mock_item.error = None
            mock_item.raw = "# Lab Report"
            mock_hf.generate_hf.return_value = [mock_item]
            mock_out.parse_markdown.return_value = "# Lab Report"

            with patch("PIL.Image.open") as mock_open:
                mock_img = Image.new("RGB", (100, 100))
                mock_open.return_value.__enter__.return_value = mock_img

                with patch("pathlib.Path.exists", return_value=True):
                    text = provider.extract_text("fake_path.png")
                    self.assertEqual(text, "# Lab Report")


if __name__ == "__main__":
    unittest.main()
