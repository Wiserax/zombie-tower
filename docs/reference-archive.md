# Reference archive

The research directory is local-only and excluded from the public game repository. User videos, extracted frames, workbook contents and downloaded wiki text are not included in the deployed game.

## Supplied materials inspected

- The Tower gameplay video, approximately 35m37s, sampled into a contact sheet and selected frames.
- Three distinct They Are Billions short clips, approximately 30s, 27s and 52.5s. The two Rite of Passage files duplicate one clip.
- `Copy of Tower Static Data Collection.xlsx`, opened read-only. A local sheet inventory records descriptions, labs, ultimate weapons, bots, substats, enemy immunities, wave duration and stat-finder sheets.
- The user subsequently supplied `/Users/mac/Desktop/the-tower-first-100-days-transcript.txt`. Its 694 lines are archived locally as `research/the-tower-first-100-days-transcript.txt`; the opening overview was checked. Full gameplay analysis is deferred until the visual direction is chosen.
- Three additional Megabonk/weapon references were sampled for the 0.2.0 retro study; see `retro-visual-study.md`.

## Wiki export

The first access attempts received HTTP 403. A later ordinary MediaWiki API request succeeded. The local archive contains **825 pages**: 527 main articles plus file-description pages, templates, categories and modules. It retains page IDs, titles, source URLs, revision IDs, timestamps and raw wikitext. File-description text is included; binary artwork and full revision histories are not. User pages and discussions are not needed for the game-design corpus and were excluded.

`research/wiki-export/siteinfo.json` records the site's declared CC-BY-SA license and licensing URL. Preserve attribution and check page-specific exceptions when reusing content. The archive is for research; shipped models/textures are original.

The exporter uses the documented [MediaWiki allpages generator](https://www.mediawiki.org/wiki/API:Allpages) and [site licensing metadata](https://www.mediawiki.org/wiki/API:Licensing). It follows continuation tokens, waits between calls, saves atomically, resumes from a checkpoint, and stops on access denial or rate limiting.

```sh
# New article/template/category/module archive
python3 scripts/wiki-export.py --namespaces 0,6,10,14,828

# Resume an existing archive
python3 scripts/wiki-export.py
```

On a new output directory, omitting `--namespaces` exports all nonnegative text namespaces, including discussion pages. An existing checkpoint determines the remaining namespace list. Prefer the focused corpus above for this project.

Raw wikitext includes transclusions. Supporting pages are saved for later resolution, but this exporter does not claim to render a complete offline copy of the website.
