import re


SEVERITY_RANK = {"High": 3, "Medium": 2, "Low": 1}



def _higher_severity(severity_a: str, severity_b: str) -> str:

    return severity_a if SEVERITY_RANK.get(severity_a, 0) >= SEVERITY_RANK.get(severity_b, 0) else severity_b


def _strip_known_prefix(issue_text: str) -> str:
    
    for prefix in ("Security: ", "High complexity: ", "C: ", "Java: "):
        if issue_text.startswith(prefix):
            return issue_text[len(prefix):]
    return issue_text


def _strip_ai_prefix(issue_text: str) -> str:
   
    return re.sub(r"^AI [A-Za-z ]+: ", "", issue_text)


def merge_static_and_ai_findings(tagged_static_findings: list[tuple[str, dict]], ai_findings: list[dict]) -> list[dict]:

   
    merged_results = []
    consumed_ai_indices = set()

    for tool_name, static_finding in tagged_static_findings:
        match_index = None

        for i, ai_finding in enumerate(ai_findings):
            if i in consumed_ai_indices:
                continue
            if (
                static_finding["line_number"] is not None
                and ai_finding["line_number"] == static_finding["line_number"]
                and ai_finding["category"] == static_finding["category"]
            ):
                match_index = i
                break

        if match_index is not None:
            ai_finding = ai_findings[match_index]
            consumed_ai_indices.add(match_index)

            ai_title = _strip_ai_prefix(ai_finding["issue"])
            static_label = _strip_known_prefix(static_finding["issue"])

            merged_results.append({
                "severity": _higher_severity(static_finding["severity"], ai_finding["severity"]),
                "issue": ai_title,
                
                "explanation": ai_finding["explanation"],
                "suggestion": ai_finding["suggestion"],
                "category": static_finding["category"], 
                "file_name": static_finding["file_name"],
                "line_number": static_finding["line_number"],
                "source": "static+ai",
                "technical_details": f"{tool_name}: {static_label}\nAI: {ai_title}",
            })
        else:
            merged_results.append({
                **static_finding,  
                "source": "static",
                "technical_details": None,
            })

    for i, ai_finding in enumerate(ai_findings):
        if i not in consumed_ai_indices:
            merged_results.append({
                **ai_finding,
                "source": "ai",
                "technical_details": None,
            })

    return merged_results