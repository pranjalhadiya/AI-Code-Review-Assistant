from app.schemas.ai_schema import AIReview, AIFinding  # The models from Step 3.
from app.services.ai_service import parse_ai_findings, get_ai_score  # The functions we just wrote.


def make_finding(title="Sample issue", line_number=5, suggestion="Fix it", category="bug", severity="High"):
    # A small helper that builds a valid AIFinding, letting us override just the fields we care about.
    return AIFinding(
        category=category, severity=severity, title=title,
        explanation="Because reasons.", suggestion=suggestion, line_number=line_number,
    )


# A deliberately nasty fake review: an out-of-range score, an overlong title/suggestion, a "whole file" line (0), and too many findings.
review = AIReview(
    quality_score=105,
    summary="Test summary.",
    findings=[
        make_finding(),
        make_finding(line_number=0, category="security", title="X" * 300, suggestion="S" * 2000),
        make_finding(suggestion="   "),
    ] + [make_finding(title=f"Extra {i}") for i in range(20)],
)

findings = parse_ai_findings(review, "uploads/user_1/demo.py")

print("Count:", len(findings))                       # Expect 15 (capped from 23)
print("First:", findings[0])                          # Expect issue "AI Bug: Sample issue", line_number 5
print("Whole-file line_number:", findings[1]["line_number"])   # Expect None
print("Long issue length:", len(findings[1]["issue"]))          # Expect 255 or less
print("Long suggestion length:", len(findings[1]["suggestion"])) # Expect 1000 or less
print("Blank suggestion:", findings[2]["suggestion"])            # Expect None

print("Score 105 ->", get_ai_score(review))                                              # Expect 100.0
print("Score -3  ->", get_ai_score(AIReview(quality_score=-3, summary="s", findings=[])))  # Expect 0.0
print("Score 72  ->", get_ai_score(AIReview(quality_score=72, summary="s", findings=[])))   # Expect 72.0