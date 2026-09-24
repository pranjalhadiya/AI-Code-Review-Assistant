from bandit.core import manager, config as bandit_config 



BANDIT_SEVERITY_MAP = {
    "LOW": "Low",
    "MEDIUM": "Medium",
    "HIGH": "High",
}


def run_bandit(file_path: str) -> list[dict]:
    
    b_config = bandit_config.BanditConfig()


    b_manager = manager.BanditManager(b_config, "file")


    b_manager.discover_files([file_path])


    b_manager.run_tests()


    raw_issues = b_manager.get_issue_list()

    findings = []
    for issue in raw_issues:
        findings.append({
            "severity": issue.severity,    
            "confidence": issue.confidence,   
            "text": issue.text,                
            "test_id": issue.test_id,          
            "line_number": issue.lineno,         
            "file_name": issue.fname,             
        })

    return findings


def parse_bandit_findings(raw_findings: list[dict]) -> list[dict]:
  
    parsed = []

    for finding in raw_findings:
        severity = BANDIT_SEVERITY_MAP.get(finding["severity"], "Medium")
     

        parsed_finding = {
            "severity": severity,
            "issue": f"Security: {finding['test_id']}",
       

            "explanation": f"{finding['text']} (confidence: {finding['confidence'].capitalize()})",
       

            "suggestion": None,
        

            "file_name": finding["file_name"],
            "line_number": finding["line_number"],
        }

        parsed.append(parsed_finding)

    return parsed