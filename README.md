# 🐍 Snake Neon

Uma reinterpretação moderna e completa do clássico jogo da cobrinha — **100% front-end puro**, sem dependências e sem build. Feito com HTML, CSS e JavaScript (Canvas + Web Audio API).

> Pontuação com **combos temporais**, **gemas** e **turbos**, **obstáculos**, **biomas** que mudam a cada 5 níveis, trilha sonora **procedural** e uma direção de arte neon com **starfield em parallax**.

![Trilha: progressão em Dó menor · Visual: starfield + nebulosa por bioma]()

## ✨ Funcionalidades

- **Combos temporais** — janela de 2,4s entre comidas; multiplicador de até **×3**, com chip de combo e barra de tempo no HUD.
- **Comidas especiais**
  - 🍎 **Maçã** (+10) — a clássica, com caule, folha e aura neon.
  - 💎 **Gema dourada** (+30) — estrela girando com lens-flare.
  - ⚡ **Raio** (+5) — ativa o **turbo** (velocidade +28% por 4,5s).
  - As gemas **expira em 6s** — ou você pega, ou vira maçã.
- **Obstáculos** — blocos de aço com bevel 3D que aparecem a partir do nível 3 (sempre células pares, fora da zona central).
- **Biomas** — a cada 5 níveis o cenário muda (Abismo Violeta, Gelo Profundo, Cinzas Âmbar, Vulcão Carmesim) e tudo acompanha a nova paleta.
- **Game feel** — slow-motion na morte, hit-stop no level-up, contagem 3·2·1 ao retomar, squash na mordida, pupilas que contraem perto do perigo e onda de energia percorrendo o corpo.
- **Áudio procedural** — trilha ambiente gerada ao vivo com Web Audio (acordes em Dó menor + sinos pentatônicos) e SFX sintetizados para cada ação.
- **Estatísticas e conquistas** — dados salvos em `localStorage`: totais de partidas, recorde, maior combo, nível, tamanho, tempo, maçãs, gemas e turbos + 7 conquistas.
- **Recorde ao vivo** — metas e celebração em tempo real durante a partida.

## 🎮 Controles

| Ação | Teclado | Touch |
|---|---|---|
| Mover | `W A S D` ou setas | D-pad ou **swipe** no tabuleiro |
| Pausar / retomar | `Espaço` ou `Esc` | Botão de pausa |
| Iniciar / jogar de novo | `Enter` | Botão **Jogar** |

A partida **pausa automaticamente** se a aba ou janela perder o foco.

## 🚀 Como rodar

Não precisa instalar nada — é um site estático:

1. Baixe/clone o repositório.
2. Abra o `index.html` em qualquer navegador moderno.

Ou sirva com um servidor simples:

```bash
npx serve .
```

## 🧪 Testes

30 testes unitários cobrindo mecânicas e regras (rodam em Node, sem dependências):

```bash
node test.js
```

```text
30 passed, 0 failed
```

## 📁 Estrutura

```text
cobrinha/
├─ index.html      # estrutura, HUD, telas, configurações
├─ style.css       # tema escuro neon + animações (responsivo)
├─ script.js       # toda a lógica do jogo (IIFE, ~2200 linhas)
├─ test.js         # suíte de 30 testes (node test.js)
├─ README.md
└─ generated_documents/  # documentação (Word + PDF)
```

## ♿ Acessibilidade

- Modo de **movimento reduzido** (toggle + `prefers-reduced-motion`).
- Foco visível (`focus-visible`) em todos os controles e `aria-label`/`aria-live`.
- Sem bloqueio de zoom (`user-scalable` não é desabilitado) e `theme-color` nativo.
- Layout responsivo centrado no tabuleiro + safe-area insets.

## 🛠 Tecnologias

HTML5 · CSS3 · JavaScript (Canvas 2D · Web Audio API) — zero dependências.

## 🗺 Roadmap

- Publicação no GitHub Pages.
- Ranking online, temas de cobra, desafio diário e i18n.

---

Feito com 💚 em JavaScript puro.