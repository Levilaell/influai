# Imagem do WORKER (Railway). ffmpeg + fonte Lato (legendas ASS) + pnpm + tsx.
# A web NÃO usa isto (roda no Vercel).
FROM node:22-slim

# ffmpeg (montagem/legendas), fonte Lato Black (estilo das legendas), fontconfig
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-lato fontconfig ca-certificates \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false

# storage temp do R2 (ffmpeg trabalha aqui; o final sobe pro R2)
ENV STORAGE_DIR=/data/storage
RUN mkdir -p /data/storage

CMD ["pnpm", "--filter", "@influa/worker", "start"]
