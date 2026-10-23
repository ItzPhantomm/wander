#!/usr/bin/env python3
"""
Example: Invoking Wander MCP tools from a Python AI agent / coding harness.
"""
import subprocess
import json
import sys

def main():
    # Launch Wander MCP server as a subprocess over stdio
    proc = subprocess.Popen(
        ["wander", "mcp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    def send_rpc(msg):
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()
        line = proc.stdout.readline()
        return json.loads(line)

    # 1. Initialize
    init_res = send_rpc({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": { "name": "python-agent", "version": "1.0.0" }
        }
    })
    print("MCP Initialized:", init_res.get("result", {}).get("serverInfo", {}))

    # Send initialized notification
    proc.stdin.write(json.dumps({ "jsonrpc": "2.0", "method": "notifications/initialized" }) + "\n")
    proc.stdin.flush()

    # 2. List tools
    tools_res = send_rpc({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    })
    tools = [t["name"] for t in tools_res.get("result", {}).get("tools", [])]
    print("Available Wander MCP Tools:", tools)

    # 3. Call search tool
    query = "Vector database consensus"
    print(f"\nSearching for '{query}'...")
    call_res = send_rpc({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "wander_search",
            "arguments": { "query": query, "limit": 2 }
        }
    })
    content = call_res.get("result", {}).get("content", [{}])[0].get("text", "")
    print("Results returned from Wander:\n", content[:400] + "...")

    proc.terminate()

if __name__ == "__main__":
    main()
