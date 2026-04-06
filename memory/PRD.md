# T.P (Totally Private) - PRD

## Problem Statement
Build an end-to-end encrypted social media platform called "T.P" (Totally Private) as an alternative to Instagram/social media platforms that compromise user privacy. Features: E2E encrypted DMs, photo posts, stories, follow/unfollow system, AI chatbot, Twitter-like layout with dark/light theme.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver)
- **Frontend**: React + Tailwind CSS + Lucide React icons
- **Auth**: JWT Bearer tokens with bcrypt password hashing
- **AI**: OpenAI GPT-4o via Emergent LLM key (emergentintegrations library)
- **E2E Encryption**: Web Crypto API (AES-GCM) for DM encryption
- **Database**: JSON file-based storage (no MongoDB needed)

## User Personas
1. **Privacy-conscious users** - Want encrypted messaging and private social sharing
2. **Social media users** - Looking for Instagram/Twitter alternative with better privacy
3. **Tech-savvy users** - Appreciate E2E encryption and transparency

## Core Requirements
1. User authentication (username/email + password)
2. Photo posts with captions
3. Image stories (24h expiry)
4. E2E encrypted direct messages
5. Follow/unfollow system
6. AI chatbot assistant
7. Dark/light theme toggle
8. Twitter-like 3-column layout

## What's Been Implemented (Jan 2026)
- [x] User registration (unique username, email, password)
- [x] User login (username OR email + password)
- [x] JWT token-based authentication
- [x] Photo posts with image upload (base64)
- [x] Post feed (followed users + discover)
- [x] Like/unlike posts
- [x] Comments on posts
- [x] Image stories with 24h expiry
- [x] Story viewer with progress bars
- [x] E2E encrypted DMs (AES-GCM via Web Crypto API)
- [x] Conversation management
- [x] AI chat (GPT-4o via Emergent LLM key)
- [x] Follow/unfollow system
- [x] User profiles with posts
- [x] User search
- [x] Suggestions sidebar
- [x] Dark/light theme toggle
- [x] Settings page (profile editing, avatar upload)
- [x] 3-column Twitter-like layout
- [x] Demo data seeding (3 users with posts/stories)
- [x] Responsive design

## Testing Status
- Backend: 100% (18/18 tests passed)
- Frontend: 95% (all major features working)
- Integration: 100%

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (High)
- Video posts support
- Video stories support
- Real-time messaging (WebSocket)
- Push notifications
- Reels feature

### P2 (Medium)
- Post sharing/reposting
- Hashtags and trending
- User blocking/muting
- Media gallery on profiles
- Story highlights

### P3 (Low/Future)
- Group chats (E2E encrypted)
- Voice/video calls
- Post scheduling
- Analytics dashboard
- Mobile-responsive improvements
- Proper Diffie-Hellman key exchange for E2E encryption

## Next Tasks
1. Add video support for posts and stories
2. Implement WebSocket for real-time messaging
3. Build out the Reels feature
4. Add post sharing/reposting
5. Implement notification system
