#!/usr/bin/env python3
"""Resumable public MediaWiki text export. Never bypasses an access denial."""
import argparse
import json
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError

def atomic_json(path, data):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.replace(path)

def request_json(api, params):
    url = api + '?' + urlencode({'format': 'json', 'formatversion': 2, **params})
    req = Request(url, headers={'User-Agent': 'TowerResearchExport/0.1 (personal reference archive)'})
    try:
        with urlopen(req, timeout=30) as response:
            data = json.load(response)
    except HTTPError as e:
        if e.code in (401, 403):
            raise RuntimeError(f'Access denied ({e.code}); stopped. Use an authorized wiki export or supplied dump.') from e
        if e.code == 429:
            raise RuntimeError('Rate limited (429); checkpoint retained. Retry later; no automatic repeated requests.') from e
        raise
    if 'error' in data:
        raise RuntimeError(f"API error: {data['error']}")
    return data

def export(api, out, namespaces=None, delay=1.1, fetch=request_json, sleep=time.sleep):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    (out/'pages').mkdir(exist_ok=True)
    state_path = out/'state.json'
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state['api'] != api:
            raise ValueError('Checkpoint belongs to a different wiki.')
    else:
        info = fetch(api, {'action':'query','meta':'siteinfo','siprop':'general|namespaces|rightsinfo'})
        atomic_json(out/'siteinfo.json', info)
        if namespaces is None:
            registered = info['query']['namespaces']
            registered = registered.values() if isinstance(registered, dict) else registered
            namespaces = [int(n['id']) for n in registered if int(n['id']) >= 0]
        state = {'api':api,'namespaces':namespaces,'namespace_index':0,'continue':{},'pages':0,'complete':False}
        atomic_json(state_path, state)
        sleep(delay)
    while state['namespace_index'] < len(state['namespaces']):
        ns = state['namespaces'][state['namespace_index']]
        params = {'action':'query','generator':'allpages','gapnamespace':ns,'gaplimit':20,
                  'prop':'revisions|info','inprop':'url','rvprop':'ids|timestamp|content','rvslots':'main',
                  **state['continue']}
        data = fetch(api, params)
        for page in data.get('query', {}).get('pages', []):
            atomic_json(out/'pages'/f"{page['pageid']}.json", page)
        state['pages'] += len(data.get('query', {}).get('pages', []))
        if 'continue' in data:
            state['continue'] = data['continue']
        else:
            state['namespace_index'] += 1
            state['continue'] = {}
        state['complete'] = state['namespace_index'] == len(state['namespaces'])
        atomic_json(state_path, state)
        print(f"Saved {state['pages']} pages; namespace {ns}; complete={state['complete']}", flush=True)
        if not state['complete']:
            sleep(delay)
    return state

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--api', default='https://the-tower-idle-tower-defense.fandom.com/api.php')
    p.add_argument('--out', default='research/wiki-export')
    p.add_argument('--namespaces', help='Comma-separated IDs; omitted exports all nonnegative text namespaces.')
    args = p.parse_args()
    try:
        export(args.api, args.out, None if args.namespaces is None else [int(x) for x in args.namespaces.split(',')])
    except Exception as e:
        raise SystemExit(str(e))
