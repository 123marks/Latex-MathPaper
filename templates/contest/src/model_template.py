from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"


def main() -> None:
    RUNS.mkdir(parents=True, exist_ok=True)
    output = RUNS / "template-result.txt"
    output.write_text(
        "Replace this with reproducible model output.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
