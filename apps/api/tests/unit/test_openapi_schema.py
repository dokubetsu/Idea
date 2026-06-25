from app.main import app

def test_openapi_schema_intake_payload():
    openapi = app.openapi()
    
    # Verify schemas exist in components
    schemas = openapi.get("components", {}).get("schemas", {})
    assert "IntakeSessionOut" in schemas
    assert "ExtractedFactsPayload" in schemas
    assert "ExtractedFact" in schemas
    assert "FactType" in schemas
    
    # Verify IntakeSessionOut.extracted_facts is linked to ExtractedFactsPayload
    intake_session_schema = schemas["IntakeSessionOut"]
    properties = intake_session_schema.get("properties", {})
    assert "extracted_facts" in properties
    
    # Check that it either references ExtractedFactsPayload directly or via $ref
    extracted_facts_prop = properties["extracted_facts"]
    assert "$ref" in extracted_facts_prop or "anyOf" in extracted_facts_prop
    ref_val = extracted_facts_prop.get("$ref") or str(extracted_facts_prop.get("anyOf", []))
    assert "ExtractedFactsPayload" in ref_val
