# 🚀 Guide de Déploiement Rapide

Ce jeu peut être déployé gratuitement sur plusieurs plateformes cloud en quelques minutes !

## Option 1 : Render (Le plus simple) ⭐

**Avantages** : 100% gratuit, déploiement automatique, SSL gratuit

**Étapes** :
1. Va sur [render.com](https://render.com) et créé un compte (gratuit)
2. Clique sur **"New +"** → **"Web Service"**
3. Connecte ton compte GitHub
4. Sélectionne le repo `morgannito/zombie-jeu`
5. Sélectionne la branche `claude/zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA`
6. Render détectera automatiquement le fichier `render.yaml`
7. Clique sur **"Create Web Service"**
8. Attends 2-3 minutes ⏱️
9. **C'est en ligne !** 🎉

Tu recevras une URL du type : `https://zombie-game-xxxx.onrender.com`

**Note** : Le plan gratuit met l'app en veille après 15 min d'inactivité. Le premier chargement peut prendre 30 secondes.

---

## Option 2 : Railway ⚡

**Avantages** : Très rapide, généreux sur le plan gratuit

**Étapes** :
1. Va sur [railway.app](https://railway.app)
2. Clique sur **"Start a New Project"**
3. Sélectionne **"Deploy from GitHub repo"**
4. Choisis `morgannito/zombie-jeu` et la branche Claude
5. Railway va détecter le Dockerfile automatiquement
6. Attends la fin du build (~2 min)
7. Va dans **Settings** → **Networking** → **Generate Domain**
8. **Ton jeu est accessible** via l'URL générée ! 🎮

Plan gratuit : 500 heures/mois (largement suffisant pour tester)

---

## Option 3 : Fly.io (Pour les geeks) 🪰

**Avantages** : Très performant, datacenter proche de l'Europe

**Prérequis** : Avoir installé `flyctl` (CLI)

**Étapes** :
```bash
# Installation de flyctl (Linux/Mac)
curl -L https://fly.io/install.sh | sh

# Ou avec Homebrew (Mac)
brew install flyctl

# Se connecter
fly auth login

# Depuis le dossier du projet
cd zombie-jeu

# Déployer (le fly.toml est déjà configuré)
fly launch --config fly.toml
fly deploy

# Ouvrir dans le navigateur
fly open
```

Plan gratuit : 3 machines, 160GB de transfert/mois

---

## Option 4 : Docker Compose (Local/Serveur perso) 🐳

Si tu as un VPS ou un serveur local :

```bash
git clone https://github.com/morgannito/zombie-jeu.git
cd zombie-jeu
git checkout claude/zombie-browser-game-01LsByqwV5Bu53dYRWW7nWbA
docker-compose up -d
```

Le jeu sera accessible sur `http://votre-ip:3000`

---

## 📊 Comparaison

| Service  | Gratuit | Setup | Performance | URL Custom |
|----------|---------|-------|-------------|------------|
| Render   | ✅      | ⭐⭐⭐  | ⭐⭐         | ✅         |
| Railway  | ✅      | ⭐⭐⭐  | ⭐⭐⭐        | ✅         |
| Fly.io   | ✅      | ⭐⭐   | ⭐⭐⭐        | ✅         |
| Docker   | ✅      | ⭐     | ⭐⭐⭐        | ❌         |

---

## 🎮 Après le déploiement

1. **Partage l'URL** avec tes amis pour jouer en multijoueur
2. **Ouvre plusieurs onglets** pour tester le mode coopératif
3. **Attention** : Les upgrades permanents ne sont PAS sauvegardés en base de données (seulement en mémoire)

---

## ❓ Problèmes courants

**Le jeu ne se charge pas** :
- Attends 30 secondes (cold start sur plan gratuit)
- Vérifie que le port 3000 est bien exposé
- Regarde les logs de déploiement

**Latence élevée** :
- Choisis un datacenter proche (EU pour l'Europe)
- Render : `europe-west` region
- Fly.io : `cdg` (Paris) ou `fra` (Frankfurt)

**Le jeu se déconnecte** :
- Les WebSockets doivent être supportés (tous les services mentionnés le supportent)
- Vérifie les logs serveur

---

**Bon jeu !** 🧟‍♂️💀🎮
