#!/usr/bin/env python3
"""Export MemoryAgentBench chunks + QA pairs as JSON for mini-harness bench runner."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Export MAB dataset for mini-harness bench")
    parser.add_argument("--mab-root", required=True, help="Path to MemoryAgentBench repo")
    parser.add_argument("--agent-config", required=True, help="Agent yaml path (relative to mab-root or absolute)")
    parser.add_argument("--dataset-config", required=True, help="Dataset yaml path (relative to mab-root or absolute)")
    args = parser.parse_args()

    mab_root = os.path.abspath(args.mab_root)
    sys.path.insert(0, mab_root)
    os.chdir(mab_root)

    import yaml
    from conversation_creator import ConversationCreator

    def resolve_config(path: str) -> dict:
        full = path if os.path.isabs(path) else os.path.join(mab_root, path)
        with open(full, "r", encoding="utf-8") as handle:
            return yaml.safe_load(handle)

    agent_config = resolve_config(args.agent_config)
    dataset_config = resolve_config(args.dataset_config)

    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        creator = ConversationCreator(agent_config, dataset_config)
        chunks = creator.get_chunks()
        qa_pairs = creator.get_query_and_answers()

    serialized_qa = []
    for context_pairs in qa_pairs:
        context_items = []
        for query, answer, qa_pair_id in context_pairs:
            if isinstance(answer, list):
                answers = [str(item) for item in answer]
            else:
                answers = [str(answer)]
            context_items.append(
                {
                    "query": query,
                    "answers": answers,
                    "qa_pair_id": qa_pair_id,
                }
            )
        serialized_qa.append(context_items)

    payload = {
        "agent_config": agent_config,
        "dataset_config": dataset_config,
        "contexts": chunks,
        "query_answer_pairs": serialized_qa,
    }
    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
