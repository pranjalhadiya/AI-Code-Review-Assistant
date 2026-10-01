import subprocess  
import xml.etree.ElementTree as ET  

from app.config import settings


CPPCHECK_SEVERITY_MAP = {
    "error": "High",
    "warning": "Medium",
    "performance": "Medium",
    "portability": "Low",
    "style": "Low",
    "information": "Low",
}

CPPCHECK_SECURITY_KEYWORDS = (
    "null", "leak", "free", "overflow", "outofbounds", "uninit", "dangling",
    "buffer", "strcpy", "sprintf", "gets", "format",
)

def _cppcheck_category(raw_severity: str, finding_id: str) -> str:
   
    if raw_severity == "performance":
        return "performance"

    lowered_id = finding_id.lower()
    if any(keyword in lowered_id for keyword in CPPCHECK_SECURITY_KEYWORDS):
        return "security"

    return "quality"



def run_cppcheck(file_path: str) -> list[dict]:
    
    try:
        result = subprocess.run(
            [
                "cppcheck",              
                "--enable=all",            
                "--inconclusive",          
                "--xml",                  
                "--xml-version=2",        
                "--language=c",            
                file_path,
            ],
            capture_output=True,           
            text=True,                     
            timeout=settings.CPPCHECK_TIMEOUT_SECONDS,  
        )
    except FileNotFoundError as e:
       
        raise Exception("Cppcheck is not installed or not found on PATH.") from e
    except subprocess.TimeoutExpired as e:
        raise Exception(f"Cppcheck timed out after {settings.CPPCHECK_TIMEOUT_SECONDS} seconds.") from e

   
    xml_output = result.stderr

    if not xml_output.strip():
        return []  
    
    root = ET.fromstring(xml_output)  
    findings = []
    for error_element in root.findall(".//error"):
       
        location = error_element.find("location")
       
        findings.append({
            "id": error_element.get("id", "unknown"),
            "severity": error_element.get("severity", "style"),
            "message": error_element.get("verbose") or error_element.get("msg", "No details provided."),

            "line": int(location.get("line", 0)) if location is not None else 0,
            "file": location.get("file", file_path) if location is not None else file_path,
        })

    return findings


def parse_cppcheck_findings(raw_findings: list[dict]) -> list[dict]:
    
    parsed = []

    for finding in raw_findings:
        severity = CPPCHECK_SEVERITY_MAP.get(finding["severity"], "Low")
       
        line_number = finding["line"] if finding["line"] > 0 else None
        
        parsed.append({
            "severity": severity,
            "issue": f"C: {finding['id']}",
           
            "explanation": finding["message"],
            "suggestion": None,
            
            "file_name": finding["file"],
            "line_number": line_number,
            "category": _cppcheck_category(finding["severity"], finding["id"]),
        })

    return parsed