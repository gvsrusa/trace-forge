"""Unit tests for TraceForge agent tools."""

import pytest
from tools.analyze_code import analyze_code, _analyze
from tools.generate_report import generate_report


PRODUCT_CARD_CODE = """
import React, { useState } from 'react';

function ProductCard({ product, onAddToCart, onWishlist, onShare }) {
  const [count, setCount] = useState(0);

  const filtered = product.tags.filter(t => t.active);

  return (
    <div>
      <img src={product.image} />
      <h2>{product.name}</h2>
      <p dangerouslySetInnerHTML={{ __html: product.description }} />
      <button onClick={() => onAddToCart(product)}>Add to cart</button>
    </div>
  );
}

export default ProductCard;
"""


class TestAnalyzeCode:
    def test_detects_dangerous_html(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx", filename="ProductCard.jsx")
        assert result["patterns"]["has_dangerous_html"] is True

    def test_detects_missing_memo(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx", filename="ProductCard.jsx")
        assert result["patterns"]["has_memo"] is False

    def test_detects_missing_use_memo(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx", filename="ProductCard.jsx")
        assert result["patterns"]["has_use_memo"] is False

    def test_extracts_hooks(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx")
        assert "useState" in result["hook_usage"]

    def test_extracts_component_name(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx", filename="ProductCard.jsx")
        assert result["component_name"] == "ProductCard"

    def test_extracts_imports(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx")
        assert "react" in result["imports"]

    def test_detects_prop_count(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx")
        assert result["prop_count"] >= 3

    def test_returns_ast_summary(self):
        result = analyze_code(code=PRODUCT_CARD_CODE, language="jsx")
        assert isinstance(result["ast_summary"], str)
        assert len(result["ast_summary"]) > 0


class TestGenerateReport:
    def test_empty_findings(self):
        result = generate_report(findings=[], code=PRODUCT_CARD_CODE)
        assert result["summary"]["total"] == 0
        assert "clean" in result["report"].lower()

    def test_counts_severities(self):
        findings = [
            {"dimension": "security", "severity": "error", "message": "XSS risk", "suggestion": "Sanitize"},
            {"dimension": "performance", "severity": "warning", "message": "Missing memo", "suggestion": "Add memo"},
            {"dimension": "accessibility", "severity": "info", "message": "Alt text", "suggestion": "Add alt"},
        ]
        result = generate_report(findings=findings, code=PRODUCT_CARD_CODE)
        assert result["summary"]["errors"] == 1
        assert result["summary"]["warnings"] == 1
        assert result["summary"]["info"] == 1
        assert result["summary"]["total"] == 3

    def test_invalid_dimension_defaults(self):
        findings = [{"dimension": "INVALID", "severity": "warning", "message": "test", "suggestion": ""}]
        result = generate_report(findings=findings, code=PRODUCT_CARD_CODE)
        assert result["findings"][0]["dimension"] == "best_practices"

    def test_invalid_severity_defaults(self):
        findings = [{"dimension": "performance", "severity": "INVALID", "message": "test", "suggestion": ""}]
        result = generate_report(findings=findings, code=PRODUCT_CARD_CODE)
        assert result["findings"][0]["severity"] == "warning"

    def test_annotations_only_include_lined_findings(self):
        findings = [
            {"dimension": "security", "severity": "error", "line": 10, "message": "XSS", "suggestion": ""},
            {"dimension": "performance", "severity": "warning", "message": "Missing memo", "suggestion": ""},
        ]
        result = generate_report(findings=findings, code=PRODUCT_CARD_CODE)
        assert len(result["annotations"]) == 1
        assert result["annotations"][0]["line"] == 10
