"""Tool: run_evaluation — LLM-as-Judge eval on the agent's own review output."""

import os

_EVAL_PROMPT = """You are an expert evaluator assessing the quality of an AI code review.

## Original Code
```
{original_code}
```

## Review Output
{review_output}

## Evaluation Criteria

Score each criterion from 0.0 to 1.0:

1. **completeness** — Did the review cover all 4 dimensions: performance, accessibility, best_practices, security?
   - 1.0 = all 4 dimensions with multiple findings each
   - 0.5 = some dimensions missing or superficial
   - 0.0 = only 1-2 dimensions covered

2. **accuracy** — Are the findings real issues in the code? Are the suggested fixes correct?
   - 1.0 = all findings are valid, suggestions are implementable
   - 0.5 = mix of valid and questionable findings
   - 0.0 = mostly false positives or incorrect suggestions

3. **actionability** — Are suggestions specific enough to implement without guessing?
   - 1.0 = each suggestion includes the exact code change or pattern to apply
   - 0.5 = suggestions are directional but vague
   - 0.0 = suggestions are generic ("improve performance", "fix accessibility")

4. **calibration** — Are severity levels appropriate? Critical issues marked as errors, minor issues as info?
   - 1.0 = severity levels match industry standards
   - 0.5 = some miscalibration (over or under-flagging)
   - 0.0 = severity levels are wrong or missing

Respond ONLY with valid JSON:
{{
  "scores": {{
    "completeness": <0.0-1.0>,
    "accuracy": <0.0-1.0>,
    "actionability": <0.0-1.0>,
    "calibration": <0.0-1.0>
  }},
  "reasoning": "<one paragraph explaining the scores>",
  "suggestions": "<what the reviewer should improve next time>"
}}
"""


def run_evaluation(review_output: str, original_code: str, eval_criteria: list[str] | None = None) -> dict:
    """
    Run LLM-as-Judge evaluation on this agent's own review output.
    Scores completeness, accuracy, actionability, and calibration (0.0–1.0 each).
    Call this after generate_report to assess review quality.
    """
    import json

    from google import genai
    from google.genai import types

    model = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")

    client = genai.Client(
        vertexai=True,
        project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
    )
    prompt = _EVAL_PROMPT.format(
        original_code=original_code[:3000],
        review_output=review_output[:3000],
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        result = json.loads(response.text)
        return result
    except (json.JSONDecodeError, Exception) as e:
        return {
            "scores": {"completeness": 0.0, "accuracy": 0.0, "actionability": 0.0, "calibration": 0.0},
            "reasoning": f"Evaluation failed: {e}",
            "suggestions": "",
        }
