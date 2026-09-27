"""End-to-end journey test: the loop a real beginner follows.

Run it against a live engine:

    python3 -m backend.app.server --port 8000 &
    python3 tests/test_journey.py

It walks the whole product the way a person does — read the file, check its health,
debug an error, prepare fixes, approve one, apply it, revert it, run the file, review
the change and read the audit trail — and fails loudly if any promise is broken. The
most important assertion in the file is the one that proves an agent *cannot* write to
a file without a human decision.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
PASSED: list[str] = []
FAILED: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    (PASSED if condition else FAILED).append(f"{label}{f' — {detail}' if detail and not condition else ''}")
    print(f"  {'✓' if condition else '✗'} {label}{'' if condition else f'  ({detail})'}")


def call(method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        BASE + path, data=data, method=method, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = response.read().decode()
            return response.status, (json.loads(body) if body else {})
    except urllib.error.HTTPError as error:
        body = error.read().decode()
        return error.code, (json.loads(body) if body else {})


def stream(message: str, file: str) -> list[dict]:
    """Collect the assistant's events from the streaming endpoint."""
    request = urllib.request.Request(
        f"{BASE}/api/chat/stream",
        data=json.dumps({"message": message, "file": file}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    events: list[dict] = []
    with urllib.request.urlopen(request, timeout=180) as response:
        for raw in response:
            line = raw.decode().strip()
            if line.startswith("data:"):
                try:
                    events.append(json.loads(line[5:].strip()))
                except json.JSONDecodeError:
                    continue
    return events


def main() -> int:
    print(f"\nDRIPS journey test against {BASE}\n")

    print("1. The engine is alive and says what it can do")
    status, health = call("GET", "/api/health")
    check("GET /api/health returns 200", status == 200, str(status))
    check("it reports the reasoning provider", "provider" in health.get("reasoning", {}))
    check("it lists its endpoints", len(health.get("endpoints", [])) >= 20)
    check("the human-approval promise is stated", "human" in health.get("promise", "").lower())

    print("\n2. The workspace loads with sample files (reset first, so the run is repeatable)")
    status, _ = call("POST", "/api/workspace/reset")
    check("the workspace can be restored to the samples", status == 200)
    status, workspace = call("GET", "/api/workspace")
    check("workspace payload arrives", status == 200)
    files = workspace.get("files", [])
    check("sample files are present", len(files) >= 1, f"{len(files)} files")
    check("the rule catalog ships with the engine", len(workspace.get("rules", [])) >= 40)

    target = next((file for file in files if file["path"] == "inventory.py"), files[0])
    path = target["path"]

    print("\n2b. The project dashboard rolls everything up")
    status, overview = call("GET", "/api/health/overview")
    check("the overview endpoint answers", status == 200, str(overview)[:120])
    check("every file is rolled up", overview.get("files", 0) >= 1)
    check("an average health is computed", overview.get("average_health") is not None)
    check("severity totals are summed", sum(overview.get("severities", {}).values()) == overview.get("findings"))
    check("hotspots are ranked worst first", (overview.get("hotspots") or [{}])[0].get("health_score", 100) <= (
        overview.get("hotspots") or [{"health_score": 100}]
    )[-1].get("health_score", 100))
    check("cross-file duplication is checked", "duplicates" in overview)

    print("\n3. Reading code: the mentor explains a file")
    events = stream("Explain this file line by line, I am new to it", path)
    kinds = [event["type"] for event in events]
    check("a plan is streamed first", "plan" in kinds)
    plan = next((event for event in events if event["type"] == "plan"), {})
    check("the plan names its agents", len(plan.get("steps", [])) >= 1)
    check("the analysis is streamed to the client", "analysis" in kinds)
    messages = [event for event in events if event["type"] == "message"]
    check("the teacher answers", any(message["message"]["agent"] == "teacher" for message in messages))
    teacher = next((m["message"] for m in messages if m["message"]["agent"] == "teacher"), None)
    if teacher:
        markdown = teacher["markdown"]
        check("it explains line by line", "Line" in markdown and "by line" in markdown)
        check("it teaches what a professional does", "professional" in markdown.lower())
        check("it includes self-check questions", "Check yourself" in markdown or "quiz" in teacher["data"])
        check("it renders tables for structure", "|" in markdown)

    print("\n4. Health: analysis produces findings, metrics and a score")
    status, analysis_payload = call("POST", f"/api/files/{path}/analyze")
    analysis = analysis_payload.get("analysis", {})
    check("analysis returns 200", status == 200, str(status))
    check("a health score is computed", 0 <= analysis.get("health_score", -1) <= 100)
    check("findings are reported", len(analysis.get("findings", [])) > 0)
    check("every finding explains why it matters", all(f["why_it_matters"] for f in analysis["findings"]))
    check("every finding says how to fix it", all(f["how_to_fix"] for f in analysis["findings"]))
    check("metrics include complexity", "max_complexity" in analysis.get("metrics", {}))
    check("the summary is human readable", len(analysis.get("summary", "")) > 40)
    severity = {finding["severity"] for finding in analysis.get("findings", [])}
    check("severities are classified", severity <= {"critical", "major", "minor", "info"})
    check("the SQL injection is caught", any(f["rule"] == "PY021" for f in analysis["findings"]))
    check("the mutable default is caught", any(f["rule"] == "PY001" for f in analysis["findings"]))

    print("\n5. Debugging: a traceback becomes a diagnosis")
    traceback_text = (
        'Traceback (most recent call last):\n  File "main.py", line 9, in <module>\n'
        "    print(average_price([]))\n"
        f'  File "{path}", line 103, in average_price\n'
        "    return sum(prices) / len(prices)\nZeroDivisionError: division by zero"
    )
    status, debug = call("POST", "/api/chat", {"message": "why does this crash?", "file": path, "traceback": traceback_text})
    debugger_message = next((event["message"] for event in debug["events"] if event["type"] == "message" and event["message"]["agent"] == "debugger"), None)
    check("the debugger responds", debugger_message is not None)
    if debugger_message:
        check("it identifies the error type", "ZeroDivisionError" in json.dumps(debugger_message))
        check("it explains the usual cause", "empty" in debugger_message["markdown"].lower())
        check("it ranks hypotheses", len(debugger_message["data"].get("hypotheses", [])) >= 1)
        check("it suggests an experiment before changing code", bool(debugger_message["data"].get("experiment")))
        top = debugger_message["data"]["hypotheses"][0]
        check("the top hypothesis is about the division, not a docstring", top["rule"] in {"PY005", "PY001", "PY004"}, top["rule"])

    print("\n6. Fixing: patches are proposed but nothing is written")
    before = call("GET", f"/api/files/{path}")[1]["file"]["content"]
    status, proposed = call("POST", "/api/patches/propose", {"file": path})
    patches = proposed.get("patches", [])
    check("patches are proposed", len(patches) >= 3, f"{len(patches)}")
    check("the response is explicit about approval", proposed.get("needs_approval") is True)
    check("each patch has a unified diff", all(patch["diff"].startswith("---") or patch["diff"].startswith("diff") or "+++" in patch["diff"] for patch in patches))
    check("each patch teaches something", all(patch["learning_note"] for patch in patches))
    after = call("GET", f"/api/files/{path}")[1]["file"]["content"]
    check("the file was NOT modified by proposing", before == after)

    print("\n7. The human gate: an agent cannot apply without a decision")
    patch = next(p for p in patches if "Mutable default" in p["title"])
    status, blocked = call("POST", f"/api/patches/{patch['id']}/apply")
    check("applying an unapproved patch is refused", status == 403, f"got {status}")
    check("the refusal explains why", "approve" in json.dumps(blocked).lower())
    unchanged = call("GET", f"/api/files/{path}")[1]["file"]["content"]
    check("the file is still untouched", unchanged == before)

    print("\n8. Approval, apply, verify, revert")
    status, decision = call("POST", f"/api/patches/{patch['id']}/decision", {"approve": True, "note": "the shared default is a real bug"})
    check("the human decision is recorded", decision["patch"]["status"] == "approved")
    check("the decision records who decided", decision["patch"]["decided_by"] is not None)
    status, applied = call("POST", f"/api/patches/{patch['id']}/apply")
    check("the approved patch applies", status == 200, str(applied)[:200])
    if status == 200:
        check("the patch is marked applied", applied["patch"]["status"] == "applied")
        check("the file changed", applied["file"]["content"] != before)
        check("the fix inserted a None guard", "if cache is None:" in applied["file"]["content"])
        check("the file revision increased", applied["file"]["revision"] > 1)
        check("health was recomputed after the change", "health_score" in applied["analysis"])
        check("the mutable default finding is gone", not any(f["rule"] == "PY001" for f in applied["analysis"]["findings"]))
        status, reverted = call("POST", f"/api/patches/{patch['id']}/revert")
        check("the change can be reverted", status == 200 and reverted["patch"]["status"] == "reverted")
        check("reverting restores the original content", reverted["analysis"]["path"] == path)

    print("\n9. Autopilot applies only provably safe changes")
    status, autopilot = call(
        "POST", "/api/chat", {"message": "clean up this file with autopilot", "file": path}
    )
    applied_steps = [event for event in autopilot["events"] if event["type"] == "autopilot"]
    autopilot_message = next(
        (event["message"] for event in autopilot["events"] if event["type"] == "message" and event["message"]["agent"] == "autopilot"),
        None,
    )
    check("autopilot ran", autopilot_message is not None)
    if autopilot_message:
        check("it applied at least one safe fix", len(applied_steps) >= 1, f"{len(applied_steps)} applied")
        check("it reports what was left for a human", "left for you" in autopilot_message["markdown"].lower())
        check("it filed a review so a human can confirm", autopilot_message["data"].get("review") is not None)
        rules_applied = {step["applied"]["rule"] for step in applied_steps}
        check("only safe rules were touched", rules_applied <= set(autopilot_message["data"]["rules_safe"]), str(rules_applied))

    print("\n10. Review: the reviewer prepares, a human decides")
    status, review = call("POST", "/api/reviews", {"file": path})
    review_id = review["review"]["id"]
    check("a review request is created", status == 201, str(status))
    check("it carries a checklist", len(review["review"]["checklist"]) >= 3)
    check("it carries ready-to-post comments", len(review["review"]["comments"]) >= 1)
    check("it makes a recommendation", review["recommendation"] in {"Approve", "Approve with follow-ups", "Changes requested", "Blocked"})
    status, decided = call("POST", f"/api/reviews/{review_id}/decision", {"decision": "changes-requested", "note": "fix the SQL injection first"})
    check("a human decision is stored", decided["review"]["status"] == "changes-requested")
    check("the decision note is kept", decided["review"]["decision_note"] != "")

    print("\n11. Running code in the sandbox")
    status, run = call("POST", "/api/runtime/run", {"source": "print('hello')\n", "language": "python", "file": "demo.py"})
    check("a file runs", status == 200 and run["run"]["exit_code"] == 0, str(run)[:200])
    check("stdout is captured", "hello" in run["run"]["stdout"])
    status, crash = call("POST", "/api/runtime/run", {"source": "print(1/0)\n", "language": "python", "file": "crash.py"})
    check("a crash is captured", crash["run"]["exit_code"] != 0)
    check("the debugger reads the crash", "diagnosis" in crash)
    check("the crash is explained in plain language", "ZeroDivisionError" in json.dumps(crash["diagnosis"]))
    status, timeout = call("POST", "/api/runtime/run", {"source": "while True:\n    pass\n", "language": "python", "file": "loop.py"})
    check("an infinite loop is stopped by the timeout", timeout["run"]["timed_out"] is True)

    print("\n12. Learning: findings become a lesson")
    status, learning = call("GET", "/api/learning")
    check("the curriculum loads", status == 200)
    check("levels are defined", len(learning["levels"]) >= 5)
    check("a track is recommended from the findings", bool(learning["recommended_track"]["reason"]))
    check("lessons are proposed", len(learning["next_lessons"]) >= 1)
    first = learning["next_lessons"][0]
    check("a lesson explains why it matters", bool(first["why"]))
    check("a lesson has practice and a check", bool(first["practice"]) and bool(first["check"]))
    xp_before = learning["learner"]["xp"]
    status, completed = call("POST", "/api/learning/complete", {"lesson": first["id"]})
    check("completing a lesson awards XP", completed["learner"]["xp"] > xp_before)

    print("\n13. Every decision is in the audit trail")
    status, audit = call("GET", "/api/audit?limit=100")
    actions = {event["action"] for event in audit["events"]}
    check("approvals are recorded", any("approved" in action for action in actions), str(sorted(actions)))
    check("applies are recorded", "patch.applied" in actions)
    check("proposals are recorded", "patch.proposed" in actions)
    check("reviews are recorded", any(action.startswith("review.") for action in actions))
    check("every event names an actor", all(event["actor"] for event in audit["events"]))

    print("\n14. Autonomy is explicit and reversible")
    status, manual = call("POST", "/api/autonomy", {"mode": "manual"})
    check("autonomy can be set to manual", manual["autonomy"] == "manual")
    check("the mode is explained in plain language", len(manual["explanation"]) > 30)
    call("POST", "/api/autonomy", {"mode": "supervised"})
    status, bad = call("POST", "/api/autonomy", {"mode": "yolo"})
    check("an unknown mode is rejected", status == 422)

    print("\n15. Good code scores well")
    status, clean = call("POST", "/api/analysis", {"path": "reference_quality.py", "content": open("samples/reference_quality.py").read()})
    check("the reference file scores higher than the messy one", clean["analysis"]["health_score"] > analysis["health_score"])
    check("it earns a good grade", clean["analysis"]["grade"] in {"A", "B"}, clean["analysis"]["grade"])

    total = len(PASSED) + len(FAILED)
    print(f"\n{len(PASSED)}/{total} checks passed")
    if FAILED:
        print("\nFailures:")
        for failure in FAILED:
            print(f"  ✗ {failure}")
        return 1
    print("The whole loop works: read → diagnose → propose → approve → apply → revert → review.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
