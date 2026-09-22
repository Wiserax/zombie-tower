import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('wiki',Path(__file__).parents[1]/'scripts/wiki-export.py')
wiki=importlib.util.module_from_spec(spec);spec.loader.exec_module(wiki)

class ExportTest(unittest.TestCase):
    def test_continuation_resume_and_metadata(self):
        calls=[]
        def fetch(api,p):
            calls.append(p)
            if 'meta' in p:return {'query':{'namespaces':{'0':{'id':0}}, 'rightsinfo':{'text':'Example license'}}}
            if not p.get('gapcontinue'):return {'query':{'pages':[{'pageid':1,'title':'One','revisions':[{'revid':3,'slots':{'main':{'content':'text'}}}]}]},'continue':{'gapcontinue':'Two','continue':'gapcontinue||'}}
            return {'query':{'pages':[{'pageid':2,'title':'Two','fullurl':'https://example.test/Two'}]}}
        with tempfile.TemporaryDirectory() as d:
            state=wiki.export('https://example.test/api.php',d,fetch=fetch,sleep=lambda _:None)
            self.assertTrue(state['complete']);self.assertEqual(state['pages'],2)
            self.assertEqual(json.loads((Path(d)/'pages/1.json').read_text())['revisions'][0]['revid'],3)
            self.assertEqual(calls[-1]['gapcontinue'],'Two')
            wiki.export('https://example.test/api.php',d,fetch=lambda *_:self.fail('Completed export must not fetch again'))
    def test_denial_retains_checkpoint_and_does_not_retry(self):
        with tempfile.TemporaryDirectory() as d:
            def fetch(api,p):
                if 'meta' in p:return {'query':{'namespaces':[{'id':0}]}}
                raise RuntimeError('Access denied (403)')
            with self.assertRaisesRegex(RuntimeError,'403'):wiki.export('https://example.test/api.php',d,fetch=fetch,sleep=lambda _:None)
            self.assertFalse(json.loads((Path(d)/'state.json').read_text())['complete'])
if __name__=='__main__':unittest.main()
