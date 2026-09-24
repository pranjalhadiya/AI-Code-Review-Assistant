from radon.complexity import cc_visit  
from radon.metrics import mi_visit      
from radon.raw import analyze            



COMPLEXITY_FLAG_THRESHOLD = 11


def run_radon(file_path: str) -> dict:
 
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:

        source_code = f.read()

    complexity_results = cc_visit(source_code)
 

    try:
        maintainability_index = mi_visit(source_code, multi=True)

    except Exception:

        maintainability_index = None

    raw_metrics = analyze(source_code)


    return {
        "complexity_results": complexity_results,
        "maintainability_index": maintainability_index,
        "raw_metrics": raw_metrics,
    }


def parse_radon_findings(radon_output: dict, file_name: str) -> list[dict]:
   
    parsed = []

    for item in radon_output["complexity_results"]:
        if item.complexity >= COMPLEXITY_FLAG_THRESHOLD:
            severity = "High" if item.complexity >= 20 else "Medium"

            parsed_finding = {
                "severity": severity,
                "issue": f"High complexity: {item.name}",
                "explanation": f"Function '{item.name}' has a cyclomatic complexity of {item.complexity}, "
                                f"which may make it difficult to test and maintain.",
                "suggestion": "Consider breaking this function into smaller, more focused functions.",
                "file_name": file_name,
                "line_number": item.lineno,
            }
            parsed.append(parsed_finding)

    return parsed