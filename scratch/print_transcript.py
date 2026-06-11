import json
import os

transcript_path = r"C:\Users\User\.gemini\antigravity\brain\c1bd7fe0-1c8b-4c21-bdfb-543f11ef3bfa\.system_generated\logs\transcript.jsonl"

if os.path.exists(transcript_path):
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                idx = data.get('step_index', 0)
                if 130 <= idx <= 187:
                    print(f"=== STEP {idx} (Source: {data.get('source')}, Type: {data.get('type')}) ===")
                    if data.get('content'):
                        print(data.get('content')[:800])
                    if data.get('tool_calls'):
                        print("Tool Calls:", data.get('tool_calls'))
                    print("\n" + "="*40 + "\n")
            except Exception as e:
                print("Error parsing line:", e)
else:
    print("File not found:", transcript_path)
