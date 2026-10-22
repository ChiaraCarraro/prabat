# PraBat

A browser-based pragmatics battery for young children. Ella, an animated girl, asks the child
to choose one of three pictures; the parent (or the child on a tablet) clicks the choice. The
study runs in German, Swiss German, Turkish, Kiswahili and Kikuyu.

Online version: https://devpsy.web.leuphana.de/prabat

## Quick start

Requirements: [Bun](https://bun.sh) (or Node.js with npm).

```sh
git clone git@github.com:ChiaraCarraro/prabat.git
cd prabat
bun install
bun run dev        # local version at http://localhost:3000
bun run build      # production version in dist/
```

Upload the contents of `dist/` to any web server (the study also works in a sub folder).
For the optional server upload of data (see below) the server needs PHP.

Other commands:

| Command                              | What it does                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `bun run format`                     | Format all source files with Prettier                                             |
| `bun run generateAudioJSON <lang>`   | Rewrite `public/audio/audio-<lang>.json` from the files in `public/audio/<lang>/` |
| `bun run generateImageJSON <folder>` | Rewrite `public/images/images-<folder>.json` from `public/images/<folder>/`       |

## How a session works

```
index.html         choose the language
  -> id.html        enter a pseudonym (ID), choose webcam recording yes/no
  -> instructions.html
  -> prabat.html    sound test, then all trials
  -> goodbye.html   thank-you page with a short video
```

The choices (language, ID, webcam) are kept in the browser's `localStorage` under the key
`storedChoices` (see `src/js/studyChoices.js`). `instructions.html` can also be opened directly
with URL parameters, e.g. `instructions.html?lang=ger&ID=P001&webcam=true`.

At the end the participant's device downloads:

- **`prabat-<ID>-<date>-<time>.csv`** with one row per answered trial (date/time in UTC):

  | Column                          | Meaning                                                                          |
  | ------------------------------- | -------------------------------------------------------------------------------- |
  | `id`                            | pseudonym entered on id.html                                                     |
  | `trial`                         | trial number                                                                     |
  | `targetObject` / `chosenObject` | file name of the correct / chosen picture                                        |
  | `chosen_position`               | `left`, `center` or `right`                                                      |
  | `chosenCategory`                | `target`, `dist1`, `dist2` or `dist3`                                            |
  | `correct`                       | `true` if the target was chosen                                                  |
  | `analyze`                       | `true` for the trials used in the analysis (list in `src/js/studyOutput.js`)     |
  | `timestamp`                     | time of the choice                                                               |
  | `responsetime_ms`               | ms from the end of the prompt (or from the choice slide appearing) to the choice |
  | `repeated`                      | how often the speaker button was pressed in this trial                           |
  | `browser`, `OS`                 | participant's browser and operating system                                       |

- **`prabat-<ID>-<date>-<time>`** (WebM video), only if the webcam was switched on. Its sound
  track contains the microphone and the study's own audio.

**Server upload** is switched off: data is only saved on the participant's device. To switch it
on, uncomment the upload imports and the upload block in `src/prabat.js` (marked with
"Server upload is switched off"). The PHP receivers are in `public/data/`; rename
`public/data/htaccess` to `.htaccess` on the server so the saved files cannot be downloaded.

## Project structure

```
public/                    copied as-is into the build
  audio/<lang>/            recordings per language (ger, ch, tr, sw, ki)
  audio/audio-<lang>.json  list of the recordings, checked before the study starts
  images/<folder>/         pictures per language folder (ger, tr, ki); see languageSettings.js
  images/agents, objects   pictures used by all languages (Ella, objects)
  lang/<lang>.json         all texts per language
  data/                    PHP scripts for the (switched-off) server upload
src/
  index.html / .js         language choice
  id.html / .js            pseudonym and webcam choice
  instructions.html / .js  instructions
  prabat.html / .js        THE STUDY: all trials (HTML) and their logic (JS)
  goodbye.html / .js       end page
  css/                     styles (landingpages.css for the pages around the study, prabat.css for the study)
  js/                      helper modules, each with a short description at the top
  scripts/                 generateAssetList.js (asset lists); other scripts there are private
documentation/             item lists and stimulus overviews
```

The comment at the top of `src/prabat.html` explains how a trial is written (classes, audio,
pictures). The trial screen is a 16:9 stage that scales to any screen; phones held upright are
asked to turn to landscape.

## Common changes

**Switch a trial off/on:** in `src/prabat.html`, put the trial's `<div class="flex-sheet trials ...">`
inside an HTML comment (or remove the comment). Disabled trials are labelled
`DISABLED: not used in the current version of the study`. For a transition block, also update
`BLOCK_NAMES` and `SLIDES_TO_SKIP` at the top of `src/prabat.js`.

**Change the trials used in the analysis:** edit `ANALYZE_TARGETS` in `src/js/studyOutput.js`.

**Add a language** (example code `xx`):

1. Add `public/lang/xx.json` (copy `ger.json` and translate every value).
2. Add the recordings to `public/audio/xx/` with exactly the same file names as in `public/audio/ger/`
   (file names are case-sensitive on the server), then run `bun run generateAudioJSON xx`.
3. If the language needs its own pictures, add `public/images/xx/` and run `bun run generateImageJSON xx`.
4. Add a row for `xx` in `src/js/languageSettings.js` (picture folder and lists).
5. Import the language file in `src/js/loadLanguage.js` and add it to `DICT`.
6. Add `<option value="xx">` to the language menu in `src/index.html`.

**Develop:** set `devmode = true` in `src/prabat.js` to skip fullscreen and log extra information.
