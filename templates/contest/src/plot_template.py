from pathlib import Path

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
FIGURES = ROOT / "figures"


def apply_paper_style() -> None:
    plt.rcParams.update(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Arial", "DejaVu Sans"],
            "svg.fonttype": "none",
            "font.size": 12,
            "axes.spines.right": False,
            "axes.spines.top": False,
            "axes.linewidth": 1.2,
            "legend.frameon": False,
            "figure.dpi": 150,
            "savefig.dpi": 300,
            "savefig.bbox": "tight",
        }
    )


def main() -> None:
    apply_paper_style()
    FIGURES.mkdir(parents=True, exist_ok=True)

    x = [0, 1, 2, 3, 4]
    baseline = [10, 9, 8, 7, 6]
    proposed = [10, 8.2, 6.9, 5.8, 4.9]

    fig, ax = plt.subplots(figsize=(4.8, 3.2))
    ax.plot(x, baseline, marker="o", linewidth=2, label="Baseline")
    ax.plot(x, proposed, marker="s", linewidth=2, label="Proposed")
    ax.set_xlabel("Scenario index")
    ax.set_ylabel("Objective value")
    ax.set_title("Replace with evidence-focused title")
    ax.legend()

    fig.savefig(FIGURES / "template-comparison.pdf")
    fig.savefig(FIGURES / "template-comparison.png")


if __name__ == "__main__":
    main()
