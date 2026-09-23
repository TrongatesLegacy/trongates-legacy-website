# Generates public/obs/*.html (served at https://www.trongateslegacy.com/obs/) from one shared template. Edit this file, then run:  python3 obs/build-scenes.py
# (The scenes are plain HTML; generating them just keeps the shared head/background identical.)
import pathlib
OUT = pathlib.Path(__file__).parent.parent / 'public' / 'obs'

HEAD = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{title} · Trongates Legacy OBS</title>
<meta name="robots" content="noindex">
<!-- OBS browser source (Local file, or https://www.trongateslegacy.com/obs/{name}.html), 1920x1080, 30 FPS. See obs/README.md.
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
    return f'<div class="stage" data-slot="{label}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">\n  {ring()}\n</div>\n'
def frame(x, y, w, h, tab, icon, slot, extra=''):
    # the Botrix widget goes in the inner box (data-slot); the frame itself is drawn by the overlay
    return f'''<div class="frame {extra}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">
  <div class="tab"><svg class="i"><use href="#i-{icon}"/></svg>{tab}</div>
  <div data-slot="{slot}" style="position:absolute;left:18px;right:18px;top:52px;bottom:18px"></div>
</div>
'''
ITEMS = [('kick','kick.com/trongateslegacy'),('discord','Lulu Gang Discord · discord.gg/FUKz6Dxk8W'),('web','trongateslegacy.com'),
         ('youtube','@trongateslegacy'),('tiktok','@trongateslegacy'),('instagram','@trongateslegacy'),('club','club.com/trongateslegacy')]
def ticker():
    items=''.join(f'<span class="item {k}"><svg class="i"><use href="#i-{k}"/></svg>{t}</span>' for k,t in ITEMS)
    return f'<div class="ticker"><div class="track">{items}{items}</div></div>\n'
SOCIALS = '''<div class="socials">
      <span class="kick"><svg class="i"><use href="#i-kick"/></svg>kick.com/trongateslegacy</span>
      <span class="discord"><svg class="i"><use href="#i-discord"/></svg>discord.gg/FUKz6Dxk8W</span>
      <span><svg class="i"><use href="#i-youtube"/></svg>@trongateslegacy</span>
      <span><svg class="i"><use href="#i-tiktok"/></svg>@trongateslegacy</span>
    </div>'''
GLOW_RIGHT = 'radial-gradient(34% 50% at 75% 50%, var(--a20), transparent 70%), radial-gradient(40% 60% at 20% 30%, var(--a10), transparent 70%)'

scenes = {}

# ---- STARTING SOON: title and countdown on the left, the PNGtuber on the right -------------------------
scenes['starting'] = dict(title='Starting soon', body_class='', riders=7, glow=GLOW_RIGHT, css='''
.copy { position: absolute; left: 120px; top: 150px; width: 1010px; display: grid; gap: 30px; justify-items: start; }''', body=f'''
<div class="copy" data-quiet>
  <div class="eyebrow">CEO of the Lulu Gang</div>
  <div class="title glitch" data-t="Trongates Legacy"><span class="o">Trongates</span><span class="s">Legacy</span></div>
  <div class="status">Stream starting soon <span class="dots"><i></i><i></i><i></i></span></div>
  <div class="timer" data-countdown hidden></div>
  <div class="sub">Grab a drink and <b>say hi in chat</b>.</div>
  {SOCIALS}
</div>
{stage(1180, 130, 620, 820)}{ticker()}''')

# ---- BE RIGHT BACK: title left, PNGtuber centre, chat framed on the right ------------------------------
scenes['brb'] = dict(title='Be right back', body_class='', riders=6, glow='radial-gradient(30% 46% at 55% 55%, var(--a20), transparent 70%), radial-gradient(40% 60% at 15% 30%, var(--a10), transparent 70%)', css='''
.copy { position: absolute; left: 120px; top: 190px; width: 660px; display: grid; gap: 30px; justify-items: start; }
.copy .title { font-size: 108px; }''', body=f'''
<div class="copy" data-quiet>
  <div class="eyebrow">Back in a moment</div>
  <div class="title glitch" data-t="Be right back"><span class="o">Be right</span><span class="s">Back</span></div>
  <div class="timer" data-elapsed></div>
  <div class="sub">Grabbing snacks. <b>Keep chat alive.</b></div>
</div>
{stage(830, 300, 440, 650)}{frame(1330, 70, 530, 870, 'Chat', 'kick', 'Botrix chat')}{ticker()}''')

# ---- JUST CHATTING: big PNGtuber stage, chat + goal on the right ---------------------------------------
scenes['chatting'] = dict(title='Just chatting', body_class='', riders=5, glow='radial-gradient(36% 56% at 36% 52%, var(--a20), transparent 70%)', css='''
.head { position: absolute; left: 60px; top: 44px; display: flex; align-items: center; gap: 22px; font: 900 30px/1 Orbitron; letter-spacing: .06em; text-transform: uppercase; }
.head .o { color: transparent; -webkit-text-stroke: 1.4px var(--accent); } .head .s { color: var(--text); }
.head .sep { width: 2px; height: 30px; background: var(--a40); }
.head .topic { font: 600 26px/1 "Chakra Petch", sans-serif; letter-spacing: .08em; color: var(--accent); text-transform: uppercase; }''', body=f'''
<div class="head" data-quiet><span><span class="o">Trongates</span> <span class="s">Legacy</span></span><span class="sep"></span><span class="topic" id="topic">Just chatting</span></div>
{stage(180, 110, 980, 880)}{frame(1290, 44, 590, 800, 'Chat', 'kick', 'Botrix chat')}{frame(1290, 864, 590, 128, 'Goal', 'kick', 'Botrix follower goal')}{ticker()}
<script>document.getElementById('topic').textContent = new URLSearchParams(location.search).get('topic') || 'Just chatting';</script>''')

# ---- GAME: transparent frame over the game capture ----------------------------------------------------
scenes['game'] = dict(title='Game', body_class='transparent', riders=0, glow='none', css='''
.grid, .floor, .horizon, #trails { display: none; }
.brand { position: absolute; left: 44px; top: 40px; display: flex; align-items: center; gap: 14px; padding: 10px 18px 10px 14px; font: 900 20px/1 Orbitron; letter-spacing: .08em; text-transform: uppercase;
  background: rgba(5,10,20,.72); border: 1px solid var(--a40); clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
.brand .o { color: transparent; -webkit-text-stroke: 1px var(--accent); } .brand .k { display: inline-flex; align-items: center; gap: 8px; font: 700 16px/1 Orbitron; color: var(--kick); letter-spacing: .14em; }
.brand .k .i { width: 18px; height: 18px; }
.stage .halo { opacity: .7; }
.alerts { position: absolute; left: 660px; top: 60px; width: 600px; height: 300px; }
.chat-off .chat { display: none; } .goal-off .goal { display: none; }''', body=f'''
<div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
<div class="brand"><span class="o">Trongates</span> Legacy <span class="k"><svg class="i"><use href="#i-kick"/></svg>Live</span></div>
<div class="alerts" data-slot="Botrix alerts (full-screen source; alerts show here)"></div>
{stage(1500, 560, 380, 480)}{frame(40, 250, 430, 540, 'Chat', 'kick', 'Botrix chat (hide with ?chat=0)', 'chat')}{frame(40, 930, 430, 110, 'Goal', 'kick', 'Botrix follower goal (hide with ?goal=0)', 'goal')}
<script>const q = new URLSearchParams(location.search); if (q.get('chat') === '0') document.body.classList.add('chat-off'); if (q.get('goal') === '0') document.body.classList.add('goal-off');</script>''')

# ---- ENDING: thanks, socials and the Discord, PNGtuber on the right -----------------------------------
scenes['ending'] = dict(title='Ending', body_class='', riders=7, glow=GLOW_RIGHT, css='''
.copy { position: absolute; left: 120px; top: 130px; width: 1000px; display: grid; gap: 28px; justify-items: start; }
.copy .title { font-size: 116px; }
.gang { display: flex; align-items: center; gap: 22px; padding: 16px 30px 16px 18px; border: 1px solid rgba(255,99,184,.45); border-radius: 22px;
  background: linear-gradient(100deg, rgba(255,99,184,.18), rgba(88,101,242,.16)); }
.gang .logos { position: relative; width: 190px; height: 96px; }
.gang .logos img { position: absolute; } .gang .lulu { left: 0; top: -14px; width: 136px; transform: rotate(-6deg); } .gang .gng { right: 0; bottom: 0; width: 124px; transform: rotate(-3deg); }
.gang small { display: block; font-size: 18px; font-weight: 600; letter-spacing: .24em; text-transform: uppercase; color: #cfb6d8; }
.gang b { display: flex; align-items: center; gap: 12px; margin-top: 6px; font: 700 30px/1.1 Orbitron; letter-spacing: .06em; text-transform: uppercase; }
.gang b .i { width: 32px; height: 32px; color: #8c9bff; }''', body=f'''
<div class="copy" data-quiet>
  <div class="eyebrow">That's a wrap</div>
  <div class="title glitch" data-t="Thanks for watching"><span class="o">Thanks for</span><span class="s">Watching</span></div>
  <div class="sub"><b>GGs, Lulu Gang.</b> Catch the next one on Kick.</div>
  <div class="gang"><span class="logos"><img class="lulu" src="assets/lulu.webp" alt=""><img class="gng" src="assets/gang.webp" alt=""></span>
    <span><small>Hang out between streams</small><b><svg class="i"><use href="#i-discord"/></svg>discord.gg/FUKz6Dxk8W</b></span></div>
  {SOCIALS}
</div>
{stage(1180, 130, 620, 820)}{ticker()}''')

for name, s in scenes.items():
    html = HEAD.format(name=name, **s) + BG.format(**s) + s['body'] + '\n' + FOOT
    (OUT / f'{name}.html').write_text(html)
    print('wrote', f'public/obs/{name}.html')
