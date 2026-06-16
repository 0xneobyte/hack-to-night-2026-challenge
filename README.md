# HTN26 Challenge

## Getting started

**prerequisites**

- docker (with [wsl2 backend](https://docs.docker.com/desktop/features/wsl) on windows)


## Setting up 

```bash
git clone https://github.com/fossnsbm/hack-to-night-2026-challenge.git
cd hack-to-night-2026-challenge
```

Set your environment variables accordingly in `env.local`
```bash
cp .env.example .env.local
```

## Running dev server 
```bash
docker compose up --build --watch
```
