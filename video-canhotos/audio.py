import json, numpy as np, soundfile as sf
SR=48000
tl=json.load(open('timeline.json'))
D=tl['duration']; N=int(D*SR); t=np.arange(N)/SR
rng=np.random.default_rng(3)
first={}
for c in tl['chunks']: first.setdefault(c['scene'],c['start'])
order=['hook','pain1','pain2','pain3','pain4','turn','step1','step2','step3','alert','result','cta']
A={s:(0 if i==0 else first[s]-0.35) for i,s in enumerate(order)}
TURN=A['turn']
def lp(x,a):  # one-pole lowpass
    y=np.empty_like(x); acc=0.0
    for i in range(len(x)): acc+=a*(x[i]-acc); y[i]=acc
    return y
def note(f): return 440*2**((f-69)/12)
def env(n,a,r):
    e=np.ones(n); na=int(a*SR); nr=int(r*SR)
    e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
mus=np.zeros(N)
BPM=96; beat=60/BPM; bar=4*beat
# ---- pad: tenso (Am / Fmaj7 / Dm / E) antes da virada; aberto (C / G / Am / F) depois
tense=[[57,60,64,69],[53,57,60,64],[50,53,57,62],[52,56,59,64]]
bright=[[48,55,60,64,67],[55,59,62,67,71],[57,60,64,69,72],[53,57,60,65,69]]
pos=0.0; k=0
while pos<D:
    ch=(tense if pos<TURN-0.01 else bright)[k%4]
    dur=min(bar*(1 if pos<TURN else 1), D-pos)
    if pos<TURN and pos+dur>TURN: dur=TURN-pos
    n=int(dur*SR); i0=int(pos*SR); tt=np.arange(n)/SR
    sig=np.zeros(n)
    for m in ch:
        for det in (-0.07,0.07):
            f=note(m+det)
            sig+=np.sin(2*np.pi*f*tt)+0.3*np.sin(2*np.pi*2*f*tt)+0.12*np.sin(2*np.pi*3*f*tt)
    sig*=env(n,min(.4,dur/3),min(.5,dur/3))/len(ch)
    mus[i0:i0+n]+=sig*0.16
    # baixo
    bf=note(ch[0]-12)
    for b in range(int(dur/(beat/2))):
        s0=i0+int(b*beat/2*SR); L=int(beat/2*SR*0.9)
        if s0+L>N: break
        tb=np.arange(L)/SR
        mus[s0:s0+L]+=np.sin(2*np.pi*bf*tb)*np.exp(-tb*7)*(0.22 if pos>=TURN else 0.13)
    pos+=dur; k+=1
    if abs(pos-TURN)<1e-6: k=0
# ---- percussão (kick em todos os tempos depois da virada; antes, pulso de "relógio")
def kick(at,g=1.0):
    L=int(.35*SR); s0=int(at*SR)
    if s0+L>N: return
    tb=np.arange(L)/SR; f=50+90*np.exp(-tb*30)
    mus[s0:s0+L]+=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tb*9)*0.55*g
def hat(at,g=1.0):
    L=int(.06*SR); s0=int(at*SR)
    if s0+L>N: return
    x=rng.standard_normal(L); x=x-lp(x,0.5)
    mus[s0:s0+L]+=x*np.exp(-np.arange(L)/SR*70)*0.09*g
def tick(at,g=1.0):
    L=int(.03*SR); s0=int(at*SR)
    if s0+L>N: return
    tb=np.arange(L)/SR; mus[s0:s0+L]+=np.sin(2*np.pi*2200*tb)*np.exp(-tb*200)*0.08*g
b=0.0
while b<D-1.5:
    if b<TURN-1.2: 
        tick(b); 
        if int(round(b/beat))%2==0: kick(b,0.45)
    elif b>=TURN:
        kick(b); hat(b+beat/2)
        if int(round((b-TURN)/beat))%4==2: hat(b,0.6)
    b+=beat
# ---- riser antes da virada + impacto
L=int(2.0*SR); s0=int((TURN-2.0)*SR)
x=rng.standard_normal(L); ramp=np.linspace(0,1,L)**2
y=np.zeros(L); acc=0.0
for i in range(L):
    a=0.01+0.25*ramp[i]; acc+=a*(x[i]-acc); y[i]=acc
mus[s0:s0+L]+=y*ramp*1.2
L=int(1.5*SR); s0=int(TURN*SR); tb=np.arange(L)/SR
mus[s0:s0+L]+=(np.sin(2*np.pi*45*tb)*0.8+lp(rng.standard_normal(L),0.08)*0.5)*np.exp(-tb*3.5)
# fade final
fo=int(2.5*SR); mus[-fo:]*=np.linspace(1,0,fo)**1.5
# ---- SFX
sfx=np.zeros(N)
def put(at,x,g=1.0):
    s0=int(at*SR); e=min(N,s0+len(x)); 
    if s0<N: sfx[s0:e]+=x[:e-s0]*g
def whoosh(d=.45):
    L=int(d*SR); x=rng.standard_normal(L); env_=np.sin(np.linspace(0,np.pi,L))**2
    y=np.zeros(L); acc=0.0
    for i in range(L): a=0.03+0.25*env_[i]; acc+=a*(x[i]-acc); y[i]=acc
    return y*env_*1.4
def pop(f=900):
    L=int(.12*SR); tb=np.arange(L)/SR; return np.sin(2*np.pi*(f+f*2*np.exp(-tb*60))*tb)*np.exp(-tb*35)*0.5
def chime(fs=(1046.5,1568)):
    L=int(1.2*SR); tb=np.arange(L)/SR; y=np.zeros(L)
    for j,f in enumerate(fs):
        d=int(j*.09*SR); tt=tb[:L-d]; y[d:]+=(np.sin(2*np.pi*f*tt)+.3*np.sin(2*np.pi*2*f*tt))*np.exp(-tt*4)
    return y*0.32
def shutter():
    L=int(.15*SR); x=rng.standard_normal(L); tb=np.arange(L)/SR
    return (x*np.exp(-tb*40)+np.roll(x,int(.05*SR))*np.exp(-np.maximum(tb-.05,0)*60)*(tb>.05))*0.4
def thud():
    L=int(.4*SR); tb=np.arange(L)/SR; return np.sin(2*np.pi*(60+60*np.exp(-tb*25))*tb)*np.exp(-tb*10)*0.9
def buzz():
    L=int(.35*SR); tb=np.arange(L)/SR; return np.sign(np.sin(2*np.pi*140*tb))*np.exp(-tb*6)*0.12
def alert():
    y=np.zeros(int(.7*SR))
    for j,f in enumerate((880,660)):
        L=int(.25*SR); tb=np.arange(L)/SR; d=int(j*.22*SR); y[d:d+L]+=np.sin(2*np.pi*f*tb)*np.exp(-tb*9)*0.4
    return y
def typing(d):
    L=int(d*SR); y=np.zeros(L); p=0
    while p<L-2000:
        x=rng.standard_normal(600)*np.exp(-np.arange(600)/80); y[p:p+600]+=x*0.12; p+=int(SR*(0.045+rng.random()*0.05))
    return y
# transições
for s in order[1:]: put(A[s]-0.05, whoosh(), 0.55)
# hook: cartões caindo
for i in range(9): put(0.05+i*0.17+0.3, thud(), 0.35)
put(0.55+0.2, pop(500), 0.8)
# pain1
put(A['pain1']+1.6, thud(), 0.9); put(A['pain1']+1.6, buzz(), 1.0)
gone=[c for c in tl['chunks'] if c['caption'].startswith('…ou')][0]['start']
put(gone, whoosh(.5), 0.9)
# pain2 digitação
put(A['pain2']+0.4, typing(2.6), 1.0)
# pain3
put(A['pain3']+0.05, pop(700), 0.8); put(A['pain3']+1.0, typing(0.7), 1.0); put(A['pain3']+2.1, buzz(), 1.3)
# pain4
put(A['pain4']+0.5, thud(), 1.0); put(A['pain4']+0.9, thud(), 1.0)
# turn: nós do fluxo
for i in range(3): put(A['turn']+.8+i*.45+.15, pop(800+i*200), 0.7)
# step1
put(A['step1']+1.25, shutter(), 1.0); put(A['step1']+1.5, pop(1000), 0.6); put(A['step1']+2.6, pop(1300), 0.6)
# step2 checks
for i,tt in enumerate([1.0,1.75,2.55,3.4]): put(A['step2']+tt+.2, pop(1100+i*150), 0.7)
put(A['step2']+0.35, whoosh(1.1), 0.25)
# step3
put(A['step3']+1.0, pop(1200), 0.7); put(A['step3']+1.9, chime(), 1.0)
# alerta
put(A['alert']+0.3, alert(), 1.0)
# result
put(A['result']+1.0, pop(1200), .6)
r=[c for c in tl['chunks'] if c['scene']=='result']; rs=r[1]['start']-A['result']
for tt in [1.3,rs+.1,rs+1.6]: put(A['result']+tt+.2, pop(1000), .6)
# cta
put(A['cta']+5.4+.2, chime((784,1046.5,1568)), 1.0)
# ---- voz + ducking
v,vsr=sf.read('voice.wav'); 
vi=np.interp(np.arange(N)*vsr/SR, np.arange(len(v)), v)[:N]
envv=np.abs(vi); envv=lp(envv,0.0015); envv/=envv.max()+1e-9
duck=1-0.6*np.clip(envv*5,0,1)
mix=vi*1.0 + mus*0.2*duck + sfx*0.22*(0.5+0.5*duck)
mix/=np.max(np.abs(mix))/0.95
sf.write('mix.wav', mix.astype(np.float32), SR)
sf.write('music_only.wav', (mus*0.55+sfx*0.5).astype(np.float32)/max(1e-9,np.max(np.abs(mus*0.55+sfx*0.5)))*0.9, SR)
print('ok', D)
