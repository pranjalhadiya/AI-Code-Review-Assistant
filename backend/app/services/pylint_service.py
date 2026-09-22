import json  
from io import StringIO 

from pylint.lint import Run  
from pylint.reporters.json_reporter import JSONReporter 


def run_pylint(file_path: str) -> tuple[list[dict], float]:
   
    output_stream = StringIO()
    reporter = JSONReporter(output_stream)

    results = Run(
        [
            file_path,
            "--disable=C0114,C0115,C0116",
        ],
        reporter=reporter,
        exit=False,
    )
 

    output_stream.seek(0)
    raw_output = output_stream.getvalue()

    if not raw_output.strip():
        findings = []
    else:
        findings = json.loads(raw_output)

    raw_score = results.linter.stats.global_note


    return findings, raw_score

def convert_score_to_100(pylint_score: float) -> float:

    scaled = pylint_score * 10

    clamped = max(0, min(scaled, 100))


    return round(clamped, 1)


PYLINT_SEVERITY_MAP = {
    "fatal": "High",
    "error": "High",
    "warning": "Medium",
    "refactor": "Medium",
    "convention": "Low",
}


def parse_pylint_findings(raw_findings: list[dict]) -> list[dict]:
   
    parsed = []
   
    for finding in raw_findings:
        

        pylint_type = finding.get("type", "convention")


        severity = PYLINT_SEVERITY_MAP.get(pylint_type, "Low")
 
        symbol = finding.get("symbol", "unknown-issue")
       

        issue_title = symbol.replace("-", " ").capitalize()
      

        parsed_finding = {
            "severity": severity,
            "issue": issue_title,
            "explanation": finding.get("message", "No additional details provided."),
            
            "suggestion": None,
          
            "file_name": finding.get("path", "unknown_file"),
            "line_number": finding.get("line"),
         
        }

        parsed.append(parsed_finding)

    return parsed