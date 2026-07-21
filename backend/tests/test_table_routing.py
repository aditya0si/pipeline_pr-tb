import sys
from pathlib import Path
from unittest.mock import patch
import pytest

_root = Path(__file__).parent.parent
sys.path.insert(0, str(_root))

from services.ocr_service import AutoOCRProvider


def test_table_routing_hint():
    ocr_tabular = AutoOCRProvider(doc_type_hint="tabular")
    assert ocr_tabular._doc_type_hint == "TABLE", f"Expected TABLE, got {ocr_tabular._doc_type_hint}"

    ocr_table = AutoOCRProvider(doc_type_hint="table")
    assert ocr_table._doc_type_hint == "TABLE", f"Expected TABLE, got {ocr_table._doc_type_hint}"

    ocr_printed = AutoOCRProvider(doc_type_hint="printed")
    assert ocr_printed._doc_type_hint == "PRINTED_TEXT", f"Expected PRINTED_TEXT, got {ocr_printed._doc_type_hint}"


def test_no_hint_auto_raises_value_error():
    ocr_auto = AutoOCRProvider()  # defaults to doc_type_hint="" -> "auto"
    with pytest.raises(ValueError, match="doc_type must be explicitly provided"):
        ocr_auto._route("dummy.png", "image")


def test_extract_text_table_granite_unavailable_raises_runtime_error():
    ocr_table = AutoOCRProvider(doc_type_hint="tabular")
    with patch("services.ocr_service._get_granite_wrapper", return_value=None):
        with pytest.raises(RuntimeError, match="Granite Vision OCR provider is unavailable for TABLE document"):
            ocr_table.extract_text("dummy.png", "image")


def test_extract_text_table_granite_error_does_not_fallback_to_paddle():
    ocr_table = AutoOCRProvider(doc_type_hint="tabular")
    mock_granite = patch("services.ocr_service.GraniteVisionProviderWrapper").start()
    mock_paddle = patch("services.ocr_service.PaddleOCRProviderWrapper").start()
    
    mock_granite_instance = mock_granite.return_value
    mock_granite_instance.extract_text.side_effect = RuntimeError("GPU OOM during table inference")
    
    with patch("services.ocr_service._get_granite_wrapper", return_value=mock_granite_instance):
        with patch("services.ocr_service._get_paddle_wrapper", return_value=mock_paddle.return_value):
            with pytest.raises(RuntimeError, match="GPU OOM during table inference"):
                ocr_table.extract_text("dummy.png", "image")
    
    mock_paddle.return_value.extract_text.assert_not_called()
    patch.stopall()


def test_run_pipeline_missing_doc_type_fails_loudly(tmp_path):
    from services.pipeline_service import run_pipeline
    sample_img = tmp_path / "table_sample.png"
    sample_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89")

    # Calling run_pipeline with no report_id and no doc_type_hint forces hint_doc_type = "auto"
    res = run_pipeline(sample_img.read_bytes())
    # ocr_text should be empty because AutoOCRProvider threw ValueError (doc_type must be explicitly provided)
    assert res.to_dict()["ocr"]["raw_output"] == ""


def test_async_pipeline_job_registry(tmp_path):
    from services.pipeline_service import run_pipeline_async, get_job_state
    sample_img = tmp_path / "table_sample.png"
    sample_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89")

    job_id = "test_job_123"
    run_pipeline_async(job_id, sample_img.read_bytes(), doc_type_hint="printed")
    state = get_job_state(job_id)
    assert state is not None
    assert state["status"] in ("done", "failed")


if __name__ == "__main__":
    test_table_routing_hint()
    test_no_hint_auto_raises_value_error()
    test_table_granite_unavailable_raises_runtime_error()
    test_extract_text_table_granite_unavailable_raises_runtime_error()
    test_extract_text_table_granite_error_does_not_fallback_to_paddle()
    test_run_pipeline_missing_doc_type_fails_loudly(tmp_path=Path("."))
    print("OK: All table routing test assertions passed!")

