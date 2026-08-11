import json
import tempfile
import unittest
from argparse import Namespace
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import paperctl


class PaperctlRuntimeTests(unittest.TestCase):
    def test_parse_key_values(self):
        self.assertEqual(
            paperctl.parse_key_values("a=1.0;b=2|c=hello"),
            {"a": "1.0", "b": "2", "c": "hello"},
        )

    def test_values_match_numeric(self):
        self.assertTrue(paperctl.values_match("1.0", "1"))
        self.assertFalse(paperctl.values_match("1.1", "1"))

    def test_build_stage_prompt_includes_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            (target / "problem").mkdir()
            (target / "state").mkdir()
            (target / "contest-rules.md").write_text("Rules here", encoding="utf-8")
            (target / "problem" / "problem.md").write_text("Problem here", encoding="utf-8")
            (target / "state" / "problem-map.md").write_text("Map here", encoding="utf-8")
            (target / "state" / "modeling-plan.md").write_text("Plan here", encoding="utf-8")
            (target / "state" / "source-ledger.csv").write_text(
                "source_id,title,url,retrieved_date,used_for,notes\n",
                encoding="utf-8",
            )

            prompt = paperctl.build_stage_prompt(target, "intake")

        self.assertIn("# Stage: intake", prompt)
        self.assertIn("Rules here", prompt)
        self.assertIn("Problem here", prompt)
        self.assertIn("Recommended skills:", prompt)

    def test_parse_file_blocks(self):
        response = """Notes
BEGIN_FILE: state/problem-map.md
content here
END_FILE
"""
        blocks = paperctl.parse_file_blocks(response)

        self.assertEqual(blocks, [("state/problem-map.md", "content here\n")])

    def test_rejects_out_of_workspace_file_block(self):
        response = """BEGIN_FILE: ../outside.txt
bad
END_FILE
"""

        with self.assertRaises(ValueError):
            paperctl.parse_file_blocks(response)

    def test_preview_file_blocks_does_not_write(self):
        response = """BEGIN_FILE: state/problem-map.md
new content
END_FILE
"""
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            (target / "state").mkdir()
            path = target / "state" / "problem-map.md"
            path.write_text("old content", encoding="utf-8")

            summary = paperctl.preview_or_apply_file_blocks(target, response, apply=False)

            self.assertIn("PREVIEW state/problem-map.md", summary)
            self.assertEqual(path.read_text(encoding="utf-8"), "old content")

    def test_apply_file_blocks_writes_inside_workspace(self):
        response = """BEGIN_FILE: state/problem-map.md
new content
END_FILE
"""
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            (target / "state").mkdir()
            path = target / "state" / "problem-map.md"
            path.write_text("old content", encoding="utf-8")

            summary = paperctl.preview_or_apply_file_blocks(target, response, apply=True)

            self.assertIn("APPLY state/problem-map.md", summary)
            self.assertEqual(path.read_text(encoding="utf-8"), "new content\n")

    def test_load_knowledge_base_has_skill_candidates(self):
        kb = paperctl.load_knowledge_base()

        self.assertIn("skill_candidates", kb)
        self.assertTrue(any(item["id"] == "math-modeling-paper-excellence" for item in kb["skill_candidates"]))

    def test_recommend_skills_for_figure_stage(self):
        output = StringIO()

        with redirect_stdout(output):
            exit_code = paperctl.recommend_skills(Namespace(stage="figure"))

        self.assertEqual(exit_code, 0)
        self.assertIn("scientific", output.getvalue().lower())

    def test_load_competition_blueprint_has_product_lanes(self):
        blueprint = paperctl.load_competition_blueprint()

        lane_ids = {lane["id"] for lane in blueprint["lanes"]}
        self.assertIn("contest-intake", lane_ids)
        self.assertIn("latex-writing", lane_ids)
        self.assertIn("submission-verification", lane_ids)

    def test_blueprint_report_can_filter_lane(self):
        output = StringIO()

        with redirect_stdout(output):
            exit_code = paperctl.blueprint_report(Namespace(lane="scientific-figures"))

        text = output.getvalue()
        self.assertEqual(exit_code, 0)
        self.assertIn("Scientific Figures", text)
        self.assertIn("figure-ledger", text)
        self.assertNotIn("Contest Intake", text)

    def test_stage_status_identifies_next_work(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            (target / "problem").mkdir()
            (target / "state").mkdir()
            (target / "src").mkdir()
            (target / "runs").mkdir()
            (target / "figures").mkdir()
            (target / "paper" / "sections").mkdir(parents=True)
            (target / "contest-rules.md").write_text("rules", encoding="utf-8")
            (target / "problem" / "problem.md").write_text("problem", encoding="utf-8")
            (target / "state" / "problem-map.md").write_text("map", encoding="utf-8")
            (target / "state" / "modeling-plan.md").write_text("plan", encoding="utf-8")
            (target / "state" / "result-ledger.csv").write_text(
                "run_id,question,metric,value,unit,script,source_data\n",
                encoding="utf-8",
            )
            (target / "state" / "figure-ledger.csv").write_text(
                "figure_id,path,purpose,caption_claim,script,source_data,question,status\n",
                encoding="utf-8",
            )
            (target / "state" / "claim-ledger.csv").write_text(
                "claim_id,question,section,claim_text,result_ids,figure_ids,source_ids,expected_values,status\n",
                encoding="utf-8",
            )
            (target / "paper" / "main.tex").write_text("TODO", encoding="utf-8")

            statuses = paperctl.stage_status(target)

        self.assertEqual(statuses["intake"][0], "done")
        self.assertEqual(statuses["modeling"][0], "todo")
        self.assertEqual(statuses["writing"][0], "in_progress")
        self.assertEqual(statuses["verification"][0], "todo")

    def test_render_pipeline_report_includes_next_stage(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            (target / "problem").mkdir()
            (target / "state").mkdir()
            (target / "src").mkdir()
            (target / "runs").mkdir()
            (target / "figures").mkdir()
            (target / "paper").mkdir()
            (target / "contest-rules.md").write_text("rules", encoding="utf-8")
            (target / "problem" / "problem.md").write_text("problem", encoding="utf-8")
            (target / "state" / "problem-map.md").write_text("map", encoding="utf-8")
            (target / "state" / "modeling-plan.md").write_text("plan", encoding="utf-8")
            (target / "state" / "result-ledger.csv").write_text(
                "run_id,question,metric,value,unit,script,source_data\n",
                encoding="utf-8",
            )
            (target / "state" / "figure-ledger.csv").write_text(
                "figure_id,path,purpose,caption_claim,script,source_data,question,status\n",
                encoding="utf-8",
            )
            (target / "state" / "claim-ledger.csv").write_text(
                "claim_id,question,section,claim_text,result_ids,figure_ids,source_ids,expected_values,status\n",
                encoding="utf-8",
            )
            (target / "paper" / "main.tex").write_text("TODO", encoding="utf-8")

            report = paperctl.render_pipeline_report("demo", target)

        self.assertIn("# Pipeline Report", report)
        self.assertIn("Next stage: modeling", report)
        self.assertIn("Non-Negotiable Gates", report)

    def test_skill_id_to_name_handles_external_skill_ids(self):
        self.assertEqual(
            paperctl.skill_id_to_name("owner/repo@latex-paper-en"),
            "latex-paper-en",
        )
        self.assertEqual(
            paperctl.skill_id_to_name("math-modeling-paper-excellence"),
            "math-modeling-paper-excellence",
        )

    def test_advance_no_ai_creates_prompt_for_next_stage(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            paperctl.CONTESTS = Path(tmp)
            try:
                target = paperctl.CONTESTS / "demo"
                (target / "problem").mkdir(parents=True)
                (target / "state").mkdir()
                (target / "contest-rules.md").write_text("rules", encoding="utf-8")
                (target / "problem" / "problem.md").write_text("problem", encoding="utf-8")
                (target / "state" / "problem-map.md").write_text("map", encoding="utf-8")
                (target / "state" / "modeling-plan.md").write_text("plan", encoding="utf-8")
                (target / "state" / "source-ledger.csv").write_text(
                    "source_id,title,url,retrieved_date,used_for,notes\n",
                    encoding="utf-8",
                )

                args = Namespace(
                    contest_id="demo",
                    no_ai=True,
                    provider_config=str(paperctl.DEFAULT_PROVIDER_CONFIG),
                    provider="default",
                    dry_run=True,
                )
                output = StringIO()
                with redirect_stdout(output):
                    exit_code = paperctl.advance_contest(args)

                self.assertEqual(exit_code, 0)
                self.assertTrue((target / "ai-runs").exists())
                self.assertTrue((target / "state" / "ai-run-ledger.csv").exists())
            finally:
                paperctl.CONTESTS = original_contests

    def test_provider_set_writes_local_openai_compatible_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "providers.local.json"
            args = Namespace(
                provider_config=str(config_path),
                provider="local",
                base_url="http://127.0.0.1:8000/v1",
                api_key_env="LOCAL_LLM_API_KEY",
                model="local-model",
                temperature=0.3,
                timeout=90,
            )

            output = StringIO()
            with redirect_stdout(output):
                exit_code = paperctl.provider_set(args)

            config = json.loads(config_path.read_text(encoding="utf-8"))
            provider = config["providers"]["local"]
            self.assertEqual(exit_code, 0)
            self.assertEqual(provider["kind"], "openai-compatible")
            self.assertEqual(provider["base_url"], "http://127.0.0.1:8000/v1")
            self.assertEqual(provider["api_key_env"], "LOCAL_LLM_API_KEY")
            self.assertEqual(provider["model"], "local-model")
            self.assertIn("Provider written", output.getvalue())

    def test_ingest_problem_text_syncs_problem_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            paperctl.CONTESTS = Path(tmp) / "contests"
            try:
                target = paperctl.CONTESTS / "demo"
                (target / "problem").mkdir(parents=True)
                source = Path(tmp) / "official-problem.txt"
                source.write_text("official problem text", encoding="utf-8")

                args = Namespace(contest_id="demo", source=str(source), kind="problem")
                output = StringIO()
                with redirect_stdout(output):
                    exit_code = paperctl.ingest(args)

                self.assertEqual(exit_code, 0)
                self.assertTrue((target / "problem" / "official-problem.txt").exists())
                self.assertEqual(
                    (target / "problem" / "problem.md").read_text(encoding="utf-8"),
                    "official problem text\n",
                )
                self.assertIn("Problem text synchronized", output.getvalue())
            finally:
                paperctl.CONTESTS = original_contests

    def test_ingest_problem_pdf_syncs_extracted_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            original_extract = paperctl.extract_pdf_text
            paperctl.CONTESTS = Path(tmp) / "contests"
            paperctl.extract_pdf_text = lambda path: "extracted pdf problem"
            try:
                target = paperctl.CONTESTS / "demo"
                (target / "problem").mkdir(parents=True)
                source = Path(tmp) / "official-problem.pdf"
                source.write_bytes(b"%PDF-1.4 fake")

                args = Namespace(contest_id="demo", source=str(source), kind="problem")
                output = StringIO()
                with redirect_stdout(output):
                    exit_code = paperctl.ingest(args)

                self.assertEqual(exit_code, 0)
                self.assertEqual(
                    (target / "problem" / "problem.md").read_text(encoding="utf-8"),
                    "extracted pdf problem\n",
                )
                self.assertIn("PDF text extraction", output.getvalue())
            finally:
                paperctl.CONTESTS = original_contests
                paperctl.extract_pdf_text = original_extract

    def test_ingest_problem_pdf_writes_placeholder_when_extraction_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            original_extract = paperctl.extract_pdf_text
            paperctl.CONTESTS = Path(tmp) / "contests"

            def fail_extract(path):
                raise ValueError("no extractable text")

            paperctl.extract_pdf_text = fail_extract
            try:
                target = paperctl.CONTESTS / "demo"
                (target / "problem").mkdir(parents=True)
                source = Path(tmp) / "official-problem.pdf"
                source.write_bytes(b"%PDF-1.4 fake")

                args = Namespace(contest_id="demo", source=str(source), kind="problem")
                output = StringIO()
                with redirect_stdout(output):
                    exit_code = paperctl.ingest(args)

                problem = (target / "problem" / "problem.md").read_text(encoding="utf-8")
                self.assertEqual(exit_code, 0)
                self.assertIn("Problem Statement Placeholder", problem)
                self.assertIn("no extractable text", problem)
                self.assertIn("PDF placeholder", output.getvalue())
            finally:
                paperctl.CONTESTS = original_contests
                paperctl.extract_pdf_text = original_extract

    def test_ingest_routes_material_kinds_to_expected_folders(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            paperctl.CONTESTS = Path(tmp) / "contests"
            try:
                target = paperctl.CONTESTS / "demo"
                target.mkdir(parents=True)
                cases = [
                    ("data", "dataset.csv", "data/raw/dataset.csv"),
                    ("reference", "paper.pdf", "references/paper.pdf"),
                    ("skill", "custom-skill.md", "skills/custom-skill.md"),
                ]
                for kind, filename, expected in cases:
                    source = Path(tmp) / filename
                    source.write_text(f"{kind} content", encoding="utf-8")

                    args = Namespace(contest_id="demo", source=str(source), kind=kind)
                    with redirect_stdout(StringIO()):
                        exit_code = paperctl.ingest(args)

                    self.assertEqual(exit_code, 0)
                    self.assertTrue((target / expected).exists())
            finally:
                paperctl.CONTESTS = original_contests

    def test_onboard_creates_workspace_imports_materials_and_prompt(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            paperctl.CONTESTS = Path(tmp) / "contests"
            try:
                problem = Path(tmp) / "problem.txt"
                data = Path(tmp) / "data.csv"
                reference = Path(tmp) / "rules.md"
                problem.write_text("official contest problem", encoding="utf-8")
                data.write_text("x,y\n1,2\n", encoding="utf-8")
                reference.write_text("contest rules", encoding="utf-8")

                args = Namespace(
                    contest_id="demo",
                    problem=[str(problem)],
                    data=[str(data)],
                    reference=[str(reference)],
                    skill=[],
                    force=False,
                    provider_config=str(paperctl.DEFAULT_PROVIDER_CONFIG),
                    provider="default",
                )
                with redirect_stdout(StringIO()):
                    exit_code = paperctl.onboard_contest(args)

                target = paperctl.CONTESTS / "demo"
                self.assertEqual(exit_code, 0)
                self.assertEqual(
                    (target / "problem" / "problem.md").read_text(encoding="utf-8"),
                    "official contest problem\n",
                )
                self.assertTrue((target / "data" / "raw" / "data.csv").exists())
                self.assertTrue((target / "references" / "rules.md").exists())
                self.assertTrue((target / "state" / "pipeline-report.md").exists())
                self.assertTrue((target / "ai-runs").exists())
                self.assertTrue(any(path.name.endswith("-intake") for path in (target / "ai-runs").iterdir()))
            finally:
                paperctl.CONTESTS = original_contests

    def test_skill_review_writes_review_artifact(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_reviews = paperctl.SKILL_REVIEWS
            paperctl.SKILL_REVIEWS = Path(tmp) / "reviews"
            try:
                args = Namespace(skill_id="math-modeling-paper-excellence", force=False)
                output = StringIO()
                with redirect_stdout(output):
                    exit_code = paperctl.skill_review(args)

                review_path = paperctl.skill_review_path("math-modeling-paper-excellence")
                review = review_path.read_text(encoding="utf-8")
                self.assertEqual(exit_code, 0)
                self.assertIn("Skill Review: math-modeling-paper-excellence", review)
                self.assertIn("Review Checklist", review)
                self.assertIn("Status: pending", review)
            finally:
                paperctl.SKILL_REVIEWS = original_reviews

    def test_package_app_excludes_contest_workspaces(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "portable"
            args = Namespace(output=str(output_dir), force=False)
            with redirect_stdout(StringIO()):
                exit_code = paperctl.package_app(args)

            self.assertEqual(exit_code, 0)
            self.assertTrue((output_dir / "build-launcher.ps1").exists())
            if (paperctl.ROOT / "PaperOS.exe").exists():
                self.assertTrue((output_dir / "PaperOS.exe").exists())
                self.assertTrue((output_dir / "PaperOS.dll").exists())
                self.assertTrue((output_dir / "PaperOS.deps.json").exists())
                self.assertTrue((output_dir / "PaperOS.runtimeconfig.json").exists())
            self.assertFalse((output_dir / "MathModelingPaperOS.cmd").exists())
            self.assertFalse((output_dir / "MathModelingPaperOS.exe").exists())
            self.assertTrue((output_dir / "app" / "server.mjs").exists())
            self.assertTrue((output_dir / "product" / "knowledge-base.json").exists())
            self.assertTrue((output_dir / "templates" / "contest").exists())
            self.assertTrue((output_dir / ".impeccable.md").exists())
            self.assertFalse((output_dir / "launcher" / "bin").exists())
            self.assertFalse((output_dir / "launcher" / "obj").exists())
            self.assertFalse((output_dir / "contests").exists())
            self.assertTrue((output_dir / "PORTABLE_README.md").exists())

    def test_package_app_rejects_file_output_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "not-a-directory"
            output_path.write_text("occupied", encoding="utf-8")
            args = Namespace(output=str(output_path), force=False)

            output = StringIO()
            with redirect_stdout(output):
                exit_code = paperctl.package_app(args)

            self.assertEqual(exit_code, 2)
            self.assertIn("not a directory", output.getvalue())

    def test_package_submission_collects_final_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            original_contests = paperctl.CONTESTS
            paperctl.CONTESTS = Path(tmp) / "contests"
            try:
                with redirect_stdout(StringIO()):
                    init_code = paperctl.init_contest(Namespace(contest_id="demo", force=False))
                target = paperctl.CONTESTS / "demo"
                (target / "paper" / "main.pdf").write_bytes(b"%PDF-1.4 fake\n")
                (target / "figures" / "demo.pdf").write_bytes(b"%PDF-1.4 fake figure\n")
                (target / "runs" / "demo-output.csv").write_text("x,y\n1,2\n", encoding="utf-8")

                args = Namespace(
                    contest_id="demo",
                    output=None,
                    skip_build=True,
                    allow_warnings=True,
                    force=False,
                )
                output = StringIO()
                with redirect_stdout(output):
                    exit_code = paperctl.package_submission(args)

                package = target / "submission-package"
                manifest = (package / "SUBMISSION_MANIFEST.md").read_text(encoding="utf-8")
                self.assertEqual(init_code, 0)
                self.assertEqual(exit_code, 0)
                self.assertTrue((package / "paper" / "main.pdf").exists())
                self.assertTrue((package / "paper" / "main.tex").exists())
                self.assertTrue((package / "paper" / "sections" / "00-abstract.tex").exists())
                self.assertTrue((package / "paper" / "refs.bib").exists())
                self.assertTrue((package / "state" / "result-ledger.csv").exists())
                self.assertTrue((package / "state" / "verification-report.md").exists())
                self.assertTrue((package / "figures" / "demo.pdf").exists())
                self.assertTrue((package / "runs" / "demo-output.csv").exists())
                self.assertIn("Submission Package Manifest", manifest)
                self.assertIn("Build skipped: yes", manifest)
                self.assertIn("Warnings allowed: yes", manifest)
                self.assertIn("paper/main.pdf", manifest)
                self.assertNotIn(".gitkeep", manifest)
                self.assertIn("Package written", output.getvalue())
            finally:
                paperctl.CONTESTS = original_contests


if __name__ == "__main__":
    unittest.main()
