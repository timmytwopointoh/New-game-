import unittest
from unittest.mock import patch
import tempfile
from pathlib import Path
import json
import prepare_realm_workspace as helper

class StagingSafety(unittest.TestCase):
    def test_inspect_does_not_create_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'new-realm'
            with patch('sys.argv',['prepare','--workspace',str(root)]),patch('builtins.print'):
                self.assertEqual(helper.main(),0)
            self.assertFalse(root.exists())

    def test_existing_project_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'keep.txt').write_text('original')
            with self.assertRaisesRegex(RuntimeError,'nonempty'):
                helper.validate_root(root)
            self.assertEqual((root/'keep.txt').read_text(),'original')

    def test_engine_child_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'.git').mkdir()
            with self.assertRaisesRegex(RuntimeError,'outside all existing Git'):
                helper.validate_root(root/'realm')

    def test_foreign_marker_is_not_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/helper.MARKER).write_text(json.dumps({'schema':1,'pins':{}}))
            with self.assertRaisesRegex(RuntimeError,'does not match'):
                helper.validate_root(root)

    def test_known_workspace_accepts_only_managed_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/helper.MARKER).write_text(json.dumps({'schema':1,'repository':helper.REPOSITORY,'pins':helper.PINS}))
            self.assertEqual(helper.validate_root(root),root.resolve())
            (root/'unrelated').mkdir()
            with self.assertRaisesRegex(RuntimeError,'outside the managed'):
                helper.validate_root(root)

    def test_wrong_remote_is_rejected_before_any_fetch(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)/'realm';root.mkdir();(root/helper.MARKER).write_text(json.dumps({'schema':1,'repository':helper.REPOSITORY,'pins':helper.PINS}));(root/'baseline-v0412'/'.git').mkdir(parents=True)
            with patch.object(helper.shutil,'which',return_value='git'),patch.object(helper,'checked_git',return_value='https://example.invalid/other') as git:
                with self.assertRaisesRegex(RuntimeError,'Unexpected source remote'):
                    helper.stage_sources(root)
                self.assertEqual(git.call_count,1)

if __name__=='__main__':unittest.main()
