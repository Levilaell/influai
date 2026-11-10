import json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("models/kokoro-v1.0.onnx", "models/voices-v1.0.bin")
VOICE = "pm_alex"
# (cena, texto falado, legenda exibida)
CHUNKS = [
 ("hook",   "Quantos canhotos se perderam na sua operação esse mês?", "Quantos canhotos se perderam na sua operação esse mês?"),
 ("pain1",  "O motorista volta com o papel amassado, ilegível...", "O motorista volta com o papel amassado, ilegível…"),
 ("pain1",  "ou nem volta.", "…ou nem volta."),
 ("pain2",  "Alguém passa horas digitando tudo na mão.", "Alguém passa horas digitando tudo na mão."),
 ("pain3",  "E quando o cliente contesta a entrega, ninguém acha o comprovante.", "E quando o cliente contesta a entrega, ninguém acha o comprovante."),
 ("pain4",  "Resultado: faturamento travado e cobrança atrasada.", "Resultado: faturamento travado e cobrança atrasada."),
 ("turn",   "A gente automatiza isso, de ponta a ponta.", "A gente automatiza isso, de ponta a ponta."),
 ("step1",  "O motorista só tira uma foto do canhoto, pelo uótsapi.", "O motorista só tira uma foto do canhoto, pelo WhatsApp."),
 ("step2",  "A inteligência artificial lê o número da nota, a data, quem recebeu, e confere a assinatura.", "A IA lê o número da nota, a data, quem recebeu, e confere a assinatura."),
 ("step3",  "Cruza com a nota fiscal, e já dá baixa no seu sistema.", "Cruza com a nota fiscal e já dá baixa no seu sistema."),
 ("alert",  "Se algo não bate, o seu time é avisado na hora.", "Se algo não bate, seu time é avisado na hora."),
 ("result", "Canhoto digital, encontrado em segundos.", "Canhoto digital, encontrado em segundos."),
 ("result", "Entrega comprovada no mesmo dia, e faturamento sem travar.", "Entrega comprovada no mesmo dia e faturamento sem travar."),
 ("cta",    "Feito sob medida pra sua distribuidora ou transportadora, integrado ao que você já usa.", "Feito sob medida pra sua distribuidora ou transportadora, integrado ao que você já usa."),
 ("cta",    "Chama a gente no uótsapi, e veja funcionando.", "Chama a gente no WhatsApp e veja funcionando."),
]
GAP_SAME, GAP_SCENE, LEAD = 0.18, 0.45, 0.6
out, t, timeline = [np.zeros(int(24000*LEAD), dtype=np.float32)], LEAD, []
prev = None
for i,(scene, spoken, cap) in enumerate(CHUNKS):
    if prev is not None:
        g = GAP_SAME if scene == prev else GAP_SCENE
        out.append(np.zeros(int(24000*g), dtype=np.float32)); t += g
    s, sr = k.create(spoken, voice=VOICE, speed=1.08, lang="pt-br")
    # corta silêncio nas pontas
    idx = np.where(np.abs(s) > 0.01)[0]; s = s[max(0,idx[0]-240): idx[-1]+480]
    d = len(s)/sr
    timeline.append({"scene": scene, "caption": cap, "start": round(t,3), "end": round(t+d,3)})
    out.append(s.astype(np.float32)); t += d; prev = scene
out.append(np.zeros(int(24000*2.2), dtype=np.float32)); t += 2.2
sf.write("voice.wav", np.concatenate(out), 24000)
json.dump({"duration": round(t,3), "chunks": timeline}, open("timeline.json","w"), ensure_ascii=False, indent=1)
print(round(t,2)); [print(c["scene"], c["start"], c["end"]) for c in timeline]
