# Generates public/obs/*.html (served at https://www.trongateslegacy.com/obs/) from one shared template. Edit this file, then run:  python3 obs/build-scenes.py
# (The scenes are plain HTML; generating them just keeps the shared head/background identical.)
import pathlib
OUT = pathlib.Path(__file__).parent.parent / 'public' / 'obs'

HEAD = '''<!doctype html>
<html lang="en"{html_attr}><head><meta charset="utf-8"><title>{title} · Trongates Legacy OBS</title>
<meta name="robots" content="noindex">
<!-- OBS browser source (Local file, or https://www.trongateslegacy.com/obs/{name}), 1920x1080, 30 FPS. See obs/README.md.
     Paths are relative so the folder works both hosted and as local files. -->
<link rel="stylesheet" href="shared/overlay.css">
<script src="shared/theme.js"></script>
<style>{css}</style>
</head>
<body class="{body_class}">
<script src="shared/icons.js"></script>
'''
FOOT = '''<script src="shared/scene.js"></script>
</body></html>
'''
BG = '''<div class="grid"></div>
<div class="glow" style="background:{glow}"></div>
<div class="floor"></div><div class="horizon"></div>
<canvas id="trails" data-riders="{riders}"></canvas>
'''
def ring(): return '''<div class="halo"></div>
  <div class="ring"><svg class="r1" viewBox="0 0 200 200"><circle cx="100" cy="100" r="98"/></svg><svg class="r2" viewBox="0 0 200 200"><circle cx="100" cy="100" r="86"/></svg><svg class="r3" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92"/></svg></div>
  <div class="pad"></div>'''
def stage(x, y, w, h, label='PNGtuber: veadotube (Spout)'):
    # a space for the veadotube (Spout) source: Game and Just chatting only
    return f'<div class="stage" data-slot="{label}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">\n  {ring()}\n</div>\n'
def art_stage(x, y, w, h):
    # the current form's character art (no veadotube on these scenes); follows the form, hidden with ?art=0
    return f'<div class="stage art-stage" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">\n  {ring()}\n  <div class="art"><img data-form-art alt=""></div>\n</div>\n'
def frame(x, y, w, h, tab, icon, slot, extra=''):
    # the Botrix widget goes in the inner box (data-slot); the frame itself is drawn by the overlay
    return f'''<div class="frame {extra}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">
  <div class="tab"><svg class="i"><use href="#i-{icon}"/></svg>{tab}</div>
  <div data-slot="{slot}" style="position:absolute;left:18px;right:18px;top:52px;bottom:18px"></div>
</div>
'''
def np(x, y, w, h):
    # now playing (SMTC Bridge): built into the scene, not an OBS source; filled and shown by scene.js
    return f'<div class="np" data-np style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"></div>\n'
ITEMS = [('kick','kick.com/trongateslegacy'),('discord','Lulu Gang Discord · type <b class="cmd">!discord</b>'),('web','trongateslegacy.com'),
         ('youtube','@trongateslegacy'),('tiktok','@trongateslegacy'),('instagram','@trongateslegacy'),('club','club.com/trongateslegacy')]
def ticker(skip=()):
    # the scrolling strip of socials; skip=('discord',) where the scene already features the Discord
    items=''.join(f'<span class="item {k}"><svg class="i"><use href="#i-{k}"/></svg>{t}</span>' for k,t in ITEMS if k not in skip)
    return f'<div class="ticker"><div class="track">{items}{items}</div></div>\n'
def gang(compact=False):
    # the Lulu Gang Discord block: logos, 'Join the Discord', the !discord command and the QR code.
    # Same block on Starting soon, Be right back and Ending; compact=True fits BRB's narrower column.
    return f'''<div class="gang{' compact' if compact else ''}"><span class="logos"><img class="lulu" src="assets/lulu.webp" alt=""><img class="gng" src="assets/gang.webp" alt=""></span>
    <span><small>Hang out between streams</small><b><svg class="i"><use href="#i-discord"/></svg>Join the Discord</b><em>Scan the code or type <b>!discord</b> in chat</em></span>
    <span class="qr"><img src="assets/discord-qr.svg" alt="QR code for the Lulu Gang Discord"></span></div>'''
GANG = gang()

SOCIALS = '''<div class="socials">
      <span class="kick"><svg class="i"><use href="#i-kick"/></svg>kick.com/trongateslegacy</span>
      <span><svg class="i"><use href="#i-youtube"/></svg>@trongateslegacy</span>
      <span><svg class="i"><use href="#i-tiktok"/></svg>@trongateslegacy</span>
      <span><svg class="i"><use href="#i-instagram"/></svg>@trongateslegacy</span>
    </div>'''
GLOW_RIGHT = 'radial-gradient(34% 50% at 75% 50%, var(--a20), transparent 70%), radial-gradient(40% 60% at 20% 30%, var(--a10), transparent 70%)'

scenes = {}

# Scenes with cycle=True show character art that cycles the forms (no veadotube on them).

# ---- STARTING SOON: title and countdown on the left, the PNGtuber on the right -------------------------
scenes['starting'] = dict(title='Starting soon', cycle=True, body_class='', riders=7, glow=GLOW_RIGHT, css='''
.copy { position: absolute; left: 120px; top: 96px; width: 1010px; display: grid; gap: 26px; justify-items: start; }
.copy .title { font-size: 116px; }''', body=f'''
<div class="copy" data-quiet>
  <div class="eyebrow">CEO of the Lulu Gang</div>
  <div class="title glitch" data-t="Trongates Legacy"><span class="o">Trongates</span><span class="s">Legacy</span></div>
  <div class="status">Stream starting soon <span class="dots"><i></i><i></i><i></i></span></div>
  <div class="sub">Grab a drink and <b>say hi in chat</b>.</div>
  {GANG}
  {SOCIALS}
</div>
{np(1220, 22, 560, 100)}{art_stage(1180, 130, 620, 820)}{ticker(skip=('discord',))}''')

# ---- BE RIGHT BACK: title left, PNGtuber centre, chat and goal framed on the right -----------------------
scenes['brb'] = dict(title='Be right back', cycle=True, body_class='', riders=6, glow='radial-gradient(30% 46% at 55% 55%, var(--a20), transparent 70%), radial-gradient(40% 60% at 15% 30%, var(--a10), transparent 70%)', css='''
.copy { position: absolute; left: 90px; top: 150px; width: 740px; display: grid; gap: 30px; justify-items: start; }
.copy .title { font-size: 108px; }''', body=f'''
<div class="copy" data-quiet>
  <div class="eyebrow">Back in a moment</div>
  <div class="title glitch" data-t="Be right back"><span class="o">Be right</span><span class="s">Back</span></div>
  <div class="sub">Grabbing snacks. <b>Keep chat alive.</b></div>
  {gang(compact=True)}
</div>
{np(800, 40, 500, 100)}{art_stage(860, 300, 440, 650)}{frame(1330, 40, 530, 798, 'Chat', 'kick', 'Botrix chat')}{frame(1330, 858, 530, 134, 'Goal', 'kick', 'Botrix follower goal')}{ticker(skip=('discord',))}''')

# ---- JUST CHATTING: chat + goal on the left, big PNGtuber stage on the right ---------------------------------------
scenes['chatting'] = dict(title='Just chatting', body_class='', riders=5, glow='radial-gradient(36% 56% at 64% 52%, var(--a20), transparent 70%)', css='''
.head { position: absolute; right: 60px; top: 44px; display: flex; align-items: center; gap: 22px; font: 900 30px/1 Orbitron; letter-spacing: .06em; text-transform: uppercase; }
.head .o { color: transparent; -webkit-text-stroke: 1.4px var(--accent); } .head .s { color: var(--text); }
.head .sep { width: 2px; height: 30px; background: var(--a40); }
.head .topic { font: 600 26px/1 "Chakra Petch", sans-serif; letter-spacing: .08em; color: var(--accent); text-transform: uppercase; }''', body=f'''
<div class="head" data-quiet><span><span class="o">Trongates</span> <span class="s">Legacy</span></span><span class="sep" hidden></span><span class="topic" id="topic" hidden></span></div>
{frame(40, 44, 590, 794, 'Chat', 'kick', 'Botrix chat')}{frame(40, 858, 590, 134, 'Goal', 'kick', 'Botrix follower goal')}{np(690, 4, 560, 100)}{stage(760, 110, 980, 880)}{ticker()}
<script>{{ const t = new URLSearchParams(location.search).get('topic'); if (t) {{ const el = document.getElementById('topic'); el.textContent = t; el.hidden = false; el.previousElementSibling.hidden = false; }} }}</script>''')

# ---- GAME (loading backdrop): shown behind the full-screen game capture, for the moments before the game
# appears. Chat on the left, big "loading" text centred in the rest; the PNGtuber sits over the far
# bottom-right corner (no space reserved for it).
scenes['game'] = dict(title='Game', body_class='', riders=6, glow='radial-gradient(34% 52% at 64% 46%, var(--a20), transparent 70%)', css="""
.head { position: absolute; left: 60px; top: 44px; display: flex; align-items: center; gap: 22px; font: 900 30px/1 Orbitron; letter-spacing: .06em; text-transform: uppercase; }
.head .o { color: transparent; -webkit-text-stroke: 1.4px var(--accent); } .head .s { color: var(--text); }
.head .sep { width: 2px; height: 30px; background: var(--a40); }
.head .topic { font: 600 26px/1 "Chakra Petch", sans-serif; letter-spacing: .08em; color: var(--accent); text-transform: uppercase; }
.copy { position: absolute; left: 550px; right: 0; top: 0; bottom: 0; align-content: center; display: grid; gap: 30px; justify-items: center; text-align: center; }
.copy .eyebrow::after { content: ""; width: 60px; height: 2px; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
.copy .title { font-size: 120px; }
.bar { position: relative; width: 560px; height: 10px; overflow: hidden; background: rgba(255,255,255,.08); clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%); }
.bar i { position: absolute; top: 0; bottom: 0; width: 35%; background: linear-gradient(90deg, transparent, var(--accent), #fff); box-shadow: 0 0 16px var(--accent); animation: load 1.6s cubic-bezier(.5,0,.5,1) infinite; }
@keyframes load { from { transform: translateX(-100%); } to { transform: translateX(290%); } }""", body=f'''
<div class="head" data-quiet><span><span class="o">Trongates</span> <span class="s">Legacy</span></span><span class="sep"></span><span class="topic" id="topic">Game time</span></div>
<div class="copy" data-quiet>
  <div class="eyebrow">Hang tight</div>
  <div class="title glitch" data-t="Loading the game"><span class="o">Loading</span><span class="s">The game</span></div>
  <div class="bar"><i></i></div>
  <div class="sub">The game will pop up <b>any second now</b>.</div>
</div>
{frame(50, 140, 500, 694, 'Chat', 'kick', 'Botrix chat')}{frame(50, 856, 500, 134, 'Goal', 'kick', 'Botrix follower goal')}{ticker()}
<script>document.getElementById('topic').textContent = new URLSearchParams(location.search).get('topic') || 'Game time';</script>''')

# ---- ENDING: thanks, socials and the Discord, PNGtuber on the right -----------------------------------
scenes['ending'] = dict(title='Ending', cycle=True, body_class='', riders=7, glow=GLOW_RIGHT, css='''
.copy { position: absolute; left: 120px; top: 130px; width: 1000px; display: grid; gap: 28px; justify-items: start; }
.copy .title { font-size: 116px; }''', body=f'''
<div class="copy" data-quiet>
  <div class="eyebrow">That's a wrap</div>
  <div class="title glitch" data-t="Thanks for watching"><span class="o">Thanks for</span><span class="s">Watching</span></div>
  <div class="sub"><b>GGs, Lulu Gang.</b> Catch the next one on Kick.</div>
  {GANG}
  {SOCIALS}
</div>
{np(1220, 22, 560, 100)}{art_stage(1180, 130, 620, 820)}{ticker(skip=('discord',))}''')

for name, s in scenes.items():
    # the socials ticker runs along the top (the bottom gets covered by video players' controls); everything
    # else sits in .content, which starts below it, so positions in the scenes are measured from under the ticker
    body, tick = s['body'].split('<div class="ticker">')
    body = f'<div class="content">\n{body}</div>\n<div class="ticker">{tick}'
    html = HEAD.format(name=name, html_attr=' data-cycle' if s.get('cycle') else '', **s) + BG.format(**s) + body + '\n' + FOOT
    (OUT / f'{name}.html').write_text(html)
    print('wrote', f'public/obs/{name}.html')

# ---- the Botrix frames on their own, for when a widget is wanted as its own OBS browser source (e.g. on top of
# the game, or in a scene of your own). Transparent page; the frame fills whatever size the source is given, so
# set the size in OBS (suggested: chat 500x800, goal 500x134; the goal needs at least ~464 wide). Same URL
# options as the scenes for the widget (key=, chat=/goal=, demo=1) and the colour (form=, veadotube, the dock).
WIDGET_HEAD = HEAD.replace('1920x1080, 30 FPS', '{size} suggested (any size works), 30 FPS')
widgets = {
    'chat': dict(title='Chat box', size='500x800', tab='Chat', slot='Botrix chat'),
    'goal': dict(title='Follower goal', size='500x134', tab='Goal', slot='Botrix follower goal'),
    'music': dict(title='Now playing', size='560x100'),
}
for name, w in widgets.items():
    css = """
html, body { width: 100%; height: 100%; }
.frame, .np { inset: 0; }"""
    body = '<div class="np" data-np></div>\n' if name == 'music' else f'''<div class="frame">
  <div class="tab"><svg class="i"><use href="#i-kick"/></svg>{w['tab']}</div>
  <div data-slot="{w['slot']}" style="position:absolute;left:18px;right:18px;top:52px;bottom:18px"></div>
</div>
'''
    html = WIDGET_HEAD.format(name=name, html_attr='', title=w['title'], size=w['size'], css=css, body_class='transparent') + body + FOOT
    (OUT / f'{name}.html').write_text(html)
    print('wrote', f'public/obs/{name}.html')
