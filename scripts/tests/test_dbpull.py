"""Isolated tests: fake MySQL/SSH, no real database or network access."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DbPullTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'scripts').mkdir()
        shutil.copy2(ROOT / 'dbpull', self.root / 'dbpull')
        helper = (ROOT / 'scripts/dbpull-helper.php').read_text()
        helper = '<?php\nfunction dbpullConfig(string $root): array { return [getenv("TEST_APP_ENV") ?: "local", ["driver" => "mysql", "host" => getenv("TEST_HOST") ?: "127.0.0.1", "database" => "test_db", "username" => "test", "password" => "secret"]]; }\n' + helper[helper.index('function dbpullOptions'):]
        (self.root / 'scripts/dbpull-helper.php').write_text(helper)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        fake = '''#!/usr/bin/env python3
import os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
mode = os.environ.get('FAIL_MODE', '')
if name == 'ssh':
    source = sys.stdin.read()
    if source.rstrip().endswith("'check'));"):
        print('{"database":"production", "version":"5.7"}')
    else:
        print('-- SQL from production')
        if mode == 'remote': sys.exit(1)
elif name == 'mysqldump':
    if '--help' in sys.argv:
        print('column-statistics')
    else:
        print('-- local backup')
        if mode == 'backup': sys.exit(1)
elif name == 'mysql':
    if '--execute=SELECT VERSION()' in sys.argv:
        print('8.4')
    else:
        Path(os.environ['TEST_IMPORT']).write_text(sys.stdin.read())
        if mode == 'import': sys.exit(1)
'''
        for name in ['ssh', 'mysql', 'mysqldump']:
            p = self.bin / name
            p.write_text(fake)
            p.chmod(0o755)
        self.env = {**os.environ, 'PATH': str(self.bin) + ':' + os.environ['PATH'], 'TEST_IMPORT': str(self.root / 'imported')}

    def tearDown(self):
        self.tmp.cleanup()

    def run_pull(self, *args, answer='yes\n', **env):
        return subprocess.run(['php', str(self.root / 'dbpull'), *args], input=answer, text=True, capture_output=True, env={**self.env, **env})

    def test_check_does_not_import(self):
        r = self.run_pull('--check')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse((self.root / 'imported').exists())

    def test_success_keeps_backup_and_removes_incoming(self):
        r = self.run_pull()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual((self.root / 'imported').read_text(), '-- SQL from production\n')
        self.assertEqual(len(list(self.root.glob('storage/**/local_*.sql'))), 1)
        self.assertEqual(list(self.root.glob('storage/**/production_*.sql')), [])

    def test_remote_failure_never_imports(self):
        r = self.run_pull(FAIL_MODE='remote')
        self.assertEqual(r.returncode, 1)
        self.assertFalse((self.root / 'imported').exists())
        self.assertEqual(list(self.root.glob('storage/**/production_*.sql')), [])

    def test_backup_failure_never_imports(self):
        r = self.run_pull(FAIL_MODE='backup')
        self.assertEqual(list(self.root.glob('storage/**/local_*.sql')), [])
        self.assertEqual(r.returncode, 1)
        self.assertFalse((self.root / 'imported').exists())

    def test_import_failure_preserves_backup_and_reports_partial_update(self):
        r = self.run_pull(FAIL_MODE='import')
        self.assertEqual(r.returncode, 1)
        self.assertEqual(len(list(self.root.glob('storage/**/local_*.sql'))), 1)
        self.assertIn('一部更新', r.stderr)

    def test_cancel(self):
        r = self.run_pull(answer='no\n')
        self.assertEqual(r.returncode, 0)
        self.assertFalse((self.root / 'imported').exists())
        self.assertEqual(list(self.root.glob('storage/**/*.sql')), [])

    def test_reject_production_and_remote_targets(self):
        for env in [{'TEST_APP_ENV': 'production'}, {'TEST_HOST': 'db.example.com'}]:
            with self.subTest(env=env):
                self.assertEqual(self.run_pull(**env).returncode, 1)
                self.assertFalse((self.root / 'imported').exists())


if __name__ == '__main__':
    unittest.main()
