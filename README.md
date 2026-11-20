# Matcha

A browser game about making a bowl of thin matcha (usucha) the proper way. Twelve steps, each one real, in the order a tea maker does them. Built like the Sushi and Ramen games: three.js, every model made in code, no downloaded assets, no Japanese text.

## Run it

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8130/. (From the repo root, the `matcha` entry in `.claude/launch.json` does the same.)

## The procedure

| # | Step | What you do | Why it matters |
|---|------|-------------|----------------|
| 1 | Warm the bowl | Hold the kettle, pour about 90-160 ml of hot water in | A warm bowl keeps the tea hot and the foam steady |
| 2 | Rinse the whisk | Pick up the whisk, swirl it in the hot water | Softens the bamboo tines so they do not snap |
| 3 | Rest the whisk | Stand it tines-down on the holder | Keeps the tines in shape |
| 4 | Empty the bowl | Hold the bowl to tip the water into the waste bowl | |
| 5 | Dry the bowl | Wipe the inside with the cloth | Water left behind thins the tea |
| 6 | Set the sieve | Rest the sieve on the bowl | |
| 7 | Open the tin | Lift the lid | |
| 8 | Measure | Two scoops of the bamboo scoop, about 2 g | |
| 9 | Sift | Press the powder through with the back of the scoop | Removes lumps |
| 10 | Add water | Pour about 70 ml at about 80 C (the kettle cools, with a reheat button) | Too hot turns the tea bitter |
| 11 | Whisk | Dissolve gently, froth with a quick W from the wrist, slow right down, lift out | Fine foam, smooth texture |
| 12 | Serve | Turn the bowl so its front (gold streak) faces the guest | |

Scoring: water amount, water temperature, whisk technique, bowl alignment and a small penalty per wrong tap, shown as a five-star rating.

Sources used for the method: standard usucha guides from Hibiki-an, Tezumi, Mizuba and Just One Cookbook (2 g powder, about 70 ml water, 75-80 C, sift, W-shaped whisking, serve within minutes).

## Look

The scene follows the reference render: a seamless light-grey studio, mottled gunmetal glazed bowls with throwing rings and a gold streak, a bamboo whisk of about 150 curled tines, a dark glazed whisk holder, a bamboo scoop, soft contact shadows. The UI is a quiet grey plate system with mono "Fig." labels, matching the Anatomy-style plates in the other games.

## Files

- `index.html`, `css/style.css`: screens, HUD and plates
- `js/stage.js`: renderer, lights, camera rig, tweens, picking
- `js/models.js`: bowl, whisk, holder, scoop, tin, sieve, cloth, kettle, particles
- `js/textures.js`: canvas-painted glaze, bamboo, matcha, foam
- `js/world.js`: table layout
- `js/game.js`: the twelve steps, hints, scoring, results
- `js/audio.js`: WebAudio sounds (no files)
- `vendor/three/`: three.js 0.160.0 (local copy)
- `js/scan.js`: MindAR card recognition and the camera backdrop
- `target.png`, `targets.mind`: the printable card and its compiled tracking data
- `tools/make-target.html`, `tools/serve.ps1`: redraw and recompile the card, local server

## AR card

`target.png` is the card to print (about 18 cm wide, matte paper). `targets.mind` is its compiled MindAR data (mind-ar 1.2.5 with three 0.160.0, the same pins as the Sushi, Ramen and Noh games).

1. Open the page on a phone over https (camera access needs it) and tap **Scan the card**.
2. Point the back camera at the printed card. When it is recognised, the scanner shuts down and the tea table plays over the live camera feed.
3. **Play on screen** skips the card, and the game also falls back to it when no camera is available.

To redraw or recompile the card: run `tools/serve.ps1`, open `http://localhost:8130/tools/make-target.html?build=1`, and it rewrites `target.png` and `targets.mind`.
