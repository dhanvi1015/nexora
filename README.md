# NEXORA — The Mystery Begins

**A multiplayer cooperative mystery and social deduction game.**

NEXORA brings players together to investigate a mysterious disappearance. Each player receives private information, discovers clues, shares evidence, discusses theories and submits accusations. But in Deception Mode, one player has a secret objective.

## Game Modes

### 1. The Collective
Work together as a team of detectives. Each player receives different private evidence, encouraging communication and collaboration to solve the case.

### 2. The Deception
One player is secretly assigned the role of the Deceiver. Everyone else investigates while the Deceiver attempts to mislead the group without changing or fabricating evidence.

## Features

- Multiplayer rooms with unique room codes
- Support for 3–6 players
- Private evidence assigned to individual players
- Evidence sharing and a shared case file
- Real-time multiplayer chat
- Collaborative case board and theory connections
- Private accusations before the final reveal
- Secret Deceiver role and private role instructions
- Final culprit, motive, method and timeline reveal
- Deception Mode winner calculation
- Real-time room updates across player sessions

## The First Mystery: The Missing Guest

A guest disappears from a luxury hotel at midnight. The hotel claims the guest checked out, but the available evidence tells a different story.

Players investigate four suspects, examine evidence and reconstruct the events of the night.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** Tailwind CSS
- **Backend and Database:** Supabase
- **Authentication:** Supabase Anonymous Authentication
- **Real-time Features:** Supabase Realtime
- **Deployment:** Vercel

## Run Locally

### Prerequisites
- Node.js
- npm
- A Supabase project configured with the NEXORA database schema, policies and RPC functions

### Installation

Clone the repository:

```bash
git clone https://github.com/dhanvi1015/nexora.git
cd nexora
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Enable anonymous sign-ins in Supabase Authentication and configure the required database tables, Row Level Security policies and RPC functions.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```text
nexora/
├── app/
│   ├── accusation/
│   ├── board/
│   ├── game/
│   ├── lobby/
│   ├── play/
│   ├── reveal/
│   └── suspects/
├── lib/
│   ├── auth.ts
│   ├── rooms.ts
│   └── supabase.ts
├── public/
├── .env.local
└── README.md
```

## Security

NEXORA uses Supabase Row Level Security and server-side database functions to protect private evidence, secret roles and unrevealed accusations. Sensitive game information is intended to become visible only at the appropriate stage of the investigation.

Never commit `.env.local` or private credentials to the repository.

## Live Demo

[Play NEXORA](https://nexora-mystery.vercel.app/)

## Repository

[GitHub — dhanvi1015/nexora](https://github.com/dhanvi1015/nexora)

---

*Built for the OpenAI × Handshake Multiplayer Game Challenge.*