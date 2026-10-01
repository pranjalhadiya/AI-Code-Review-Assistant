import subprocess  
import tempfile     
import os
import xml.etree.ElementTree as ET

from app.config import settings


PMD_PRIORITY_MAP = {
    1: "High",
    2: "High",
    3: "Medium",
    4: "Low",
    5: "Low",
}

PMD_RULESET_CATEGORY_MAP = {
    "Security": "security",
    "Best Practices": "best_practice",
}

def _pmd_category(rule: str, ruleset: str) -> str:
   
    if "name" in rule.lower():
        return "naming"
    return PMD_RULESET_CATEGORY_MAP.get(ruleset, "quality")


def run_pmd(file_path: str) -> list[dict]:

    report_file = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)

    report_path = report_file.name
    report_file.close()

    try:
        result = subprocess.run(
            [
                "pmd",                             
                "check",                            
                "-f", "xml",                       
                "-R", "rulesets/java/quickstart.xml",  
                "--report-file", report_path,       
                "--no-fail-on-violation",           
                file_path,
            ],
            shell=True,
            capture_output=True,
            text=True,
            timeout=settings.PMD_TIMEOUT_SECONDS,
        )

        if result.returncode not in (0,):
        
            raise Exception(f"PMD exited with code {result.returncode}: {result.stderr.strip()[:300]}")


        if not os.path.exists(report_path) or os.path.getsize(report_path) == 0:
            return [] 

        tree = ET.parse(report_path)
        root = tree.getroot()

        namespace = {"pmd": "http://pmd.sourceforge.net/report/2.0.0"}

        findings = []
        for file_element in root.findall("pmd:file", namespace):
            reported_file = file_element.get("name", file_path)
            for violation in file_element.findall("pmd:violation", namespace):
                findings.append({
                    "rule": violation.get("rule", "UnknownRule"),
                    "priority": int(violation.get("priority", 3)),
                    "message": (violation.text or "No details provided.").strip(),
                    "line": int(violation.get("beginline", 0)),
                    "file": reported_file,
                    "ruleset": violation.get("ruleset", ""),
                })

        return findings

    except FileNotFoundError as e:
        raise Exception("PMD is not installed or not found on PATH.") from e
    except subprocess.TimeoutExpired as e:
        raise Exception(f"PMD timed out after {settings.PMD_TIMEOUT_SECONDS} seconds.") from e
    finally:
        if os.path.exists(report_path):
            os.remove(report_path)
            


def parse_pmd_findings(raw_findings: list[dict]) -> list[dict]:
    
    parsed = []

    for finding in raw_findings:
        severity = PMD_PRIORITY_MAP.get(finding["priority"], "Medium")
       

        line_number = finding["line"] if finding["line"] > 0 else None

        parsed.append({
            "severity": severity,
            "issue": f"Java: {finding['rule']}",
            
            "explanation": finding["message"],
            "suggestion": None,
           
            "file_name": finding["file"],
            "line_number": line_number,
            "category": _pmd_category(finding["rule"], finding.get("ruleset", "")), 
        })

    return parsed