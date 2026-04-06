from dotenv import load_dotenv
from pathlib import Path
import json
import os
import logging
import bcrypt
import jwt
import uuid
import threading
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DATA_DIR = ROOT_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)

JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-change-me')
JWT_ALGORITHM = "HS256"
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

_lock = threading.Lock()

# ─── File-based DB ────────────────────────────────────────────────
def _path(name): return DATA_DIR / f"{name}.json"

def load_collection(name):
    p = _path(name)
    if not p.exists():
        return []
    with open(p, 'r') as f:
        return json.load(f)

def save_collection(name, data):
    with _lock:
        with open(_path(name), 'w') as f:
            json.dump(data, f, indent=2)

def find_one(name, key, value):
    for item in load_collection(name):
        if item.get(key) == value:
            return item
    return None

def find_one_multi(name, conditions):
    for item in load_collection(name):
        if all(item.get(k) == v for k, v in conditions.items()):
            return item
    return None

def find_one_or(name, pairs):
    for item in load_collection(name):
        if any(item.get(k) == v for k, v in pairs):
            return item
    return None

def insert(name, doc):
    if 'id' not in doc:
        doc['id'] = str(uuid.uuid4())
    items = load_collection(name)
    items.append(doc)
    save_collection(name, items)
    return doc

def update_one(name, key, value, updates):
    items = load_collection(name)
    for item in items:
        if item.get(key) == value:
            item.update(updates)
            break
    save_collection(name, items)

def new_id(): return str(uuid.uuid4())

# ─── Auth Helpers ─────────────────────────────────────────────────
def hash_password(pw): return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
def verify_password(pw, hashed): return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id, username):
    return jwt.encode({"sub": user_id, "username": username, "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = find_one("users", "id", payload["sub"])
        if not user:
            raise HTTPException(401, "User not found")
        safe = {k: v for k, v in user.items() if k != "password_hash"}
        return safe
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")

def serialize_user(u):
    return {
        "id": u.get("id", ""), "username": u.get("username", ""),
        "email": u.get("email", ""), "display_name": u.get("display_name", u.get("username", "")),
        "bio": u.get("bio", ""), "avatar_url": u.get("avatar_url", ""),
        "followers": u.get("followers", []), "following": u.get("following", []),
        "created_at": u.get("created_at", "")
    }

# ─── Models ───────────────────────────────────────────────────────
class RegisterInput(BaseModel):
    username: str; email: str; password: str; display_name: Optional[str] = None
class LoginInput(BaseModel):
    identifier: str; password: str
class CreatePostInput(BaseModel):
    content: str; image: Optional[str] = None
class CreateStoryInput(BaseModel):
    image: str
class SendMessageInput(BaseModel):
    recipient_id: str; content: str
class CreateConversationInput(BaseModel):
    recipient_id: str
class AIChatInput(BaseModel):
    message: str; session_id: Optional[str] = None
class CommentInput(BaseModel):
    content: str
class UpdateProfileInput(BaseModel):
    display_name: Optional[str] = None; bio: Optional[str] = None; avatar_url: Optional[str] = None

# ─── Auth Routes ──────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: RegisterInput):
    username = data.username.lower().strip()
    email = data.email.lower().strip()
    if len(username) < 3: raise HTTPException(400, "Username must be at least 3 characters")
    if len(data.password) < 6: raise HTTPException(400, "Password must be at least 6 characters")
    if find_one("users", "username", username): raise HTTPException(400, "Username already taken")
    if find_one("users", "email", email): raise HTTPException(400, "Email already registered")
    user = insert("users", {"username": username, "email": email, "password_hash": hash_password(data.password),
        "display_name": data.display_name or username, "bio": "", "avatar_url": "",
        "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()})
    return {"token": create_token(user["id"], username), "user": serialize_user(user)}

@api_router.post("/auth/login")
async def login(data: LoginInput):
    ident = data.identifier.lower().strip()
    user = find_one_or("users", [("username", ident), ("email", ident)])
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(user["id"], user["username"]), "user": serialize_user(user)}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return serialize_user(user)

# ─── User Routes ──────────────────────────────────────────────────
@api_router.get("/users/profile/{username}")
async def get_profile(username: str):
    profile = find_one("users", "username", username.lower())
    if not profile: raise HTTPException(404, "User not found")
    posts = [p for p in load_collection("posts") if p.get("user_id") == profile["id"]]
    r = serialize_user(profile)
    r["post_count"] = len(posts)
    r["follower_count"] = len(profile.get("followers", []))
    r["following_count"] = len(profile.get("following", []))
    return r

@api_router.get("/users/search")
async def search_users(q: str, user=Depends(get_current_user)):
    results = [serialize_user(u) for u in load_collection("users") if q.lower() in u.get("username", "") and u["id"] != user["id"]]
    return results[:20]

@api_router.get("/users/suggestions")
async def get_suggestions(user=Depends(get_current_user)):
    following = set(user.get("following", []))
    following.add(user["id"])
    return [serialize_user(u) for u in load_collection("users") if u["id"] not in following][:10]

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["id"]: raise HTTPException(400, "Cannot follow yourself")
    target = find_one("users", "id", user_id)
    if not target: raise HTTPException(404, "User not found")
    users = load_collection("users")
    for u in users:
        if u["id"] == user["id"] and user_id not in u.get("following", []):
            u.setdefault("following", []).append(user_id)
        if u["id"] == user_id and user["id"] not in u.get("followers", []):
            u.setdefault("followers", []).append(user["id"])
    save_collection("users", users)
    return {"status": "followed"}

@api_router.post("/users/{user_id}/unfollow")
async def unfollow_user(user_id: str, user=Depends(get_current_user)):
    users = load_collection("users")
    for u in users:
        if u["id"] == user["id"]: u["following"] = [f for f in u.get("following", []) if f != user_id]
        if u["id"] == user_id: u["followers"] = [f for f in u.get("followers", []) if f != user["id"]]
    save_collection("users", users)
    return {"status": "unfollowed"}

@api_router.put("/users/profile")
async def update_profile(data: UpdateProfileInput, user=Depends(get_current_user)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if updates: update_one("users", "id", user["id"], updates)
    return serialize_user(find_one("users", "id", user["id"]))

# ─── Post Routes ──────────────────────────────────────────────────
@api_router.post("/posts")
async def create_post(data: CreatePostInput, user=Depends(get_current_user)):
    post = insert("posts", {"user_id": user["id"], "username": user["username"],
        "display_name": user.get("display_name", user["username"]), "avatar_url": user.get("avatar_url", ""),
        "content": data.content, "image": data.image, "likes": [], "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()})
    return post

@api_router.get("/posts/feed")
async def get_feed(user=Depends(get_current_user), skip: int = 0, limit: int = 20):
    following = set(user.get("following", []))
    following.add(user["id"])
    all_posts = sorted(load_collection("posts"), key=lambda p: p.get("created_at", ""), reverse=True)
    feed = [p for p in all_posts if p.get("user_id") in following]
    if len(feed) < limit:
        seen = {p["id"] for p in feed}
        feed.extend(p for p in all_posts if p["id"] not in seen)
    return feed[skip:skip+limit]

@api_router.get("/posts/user/{username}")
async def get_user_posts(username: str, skip: int = 0, limit: int = 20):
    target = find_one("users", "username", username.lower())
    if not target: raise HTTPException(404, "User not found")
    posts = sorted([p for p in load_collection("posts") if p.get("user_id") == target["id"]], key=lambda p: p.get("created_at", ""), reverse=True)
    return posts[skip:skip+limit]

@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    posts = load_collection("posts")
    for p in posts:
        if p["id"] == post_id:
            likes = p.get("likes", [])
            if user["id"] in likes:
                likes.remove(user["id"]); save_collection("posts", posts)
                return {"liked": False, "count": len(likes)}
            else:
                likes.append(user["id"]); save_collection("posts", posts)
                return {"liked": True, "count": len(likes)}
    raise HTTPException(404, "Post not found")

@api_router.post("/posts/{post_id}/comment")
async def add_comment(post_id: str, data: CommentInput, user=Depends(get_current_user)):
    comment = {"id": new_id(), "user_id": user["id"], "username": user["username"],
        "display_name": user.get("display_name", user["username"]), "avatar_url": user.get("avatar_url", ""),
        "content": data.content, "created_at": datetime.now(timezone.utc).isoformat()}
    posts = load_collection("posts")
    for p in posts:
        if p["id"] == post_id:
            p.setdefault("comments", []).append(comment); save_collection("posts", posts)
            return comment
    raise HTTPException(404, "Post not found")

# ─── Story Routes ─────────────────────────────────────────────────
@api_router.post("/stories")
async def create_story(data: CreateStoryInput, user=Depends(get_current_user)):
    story = insert("stories", {"user_id": user["id"], "username": user["username"],
        "display_name": user.get("display_name", user["username"]), "avatar_url": user.get("avatar_url", ""),
        "image": data.image, "viewers": [], "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()})
    return story

@api_router.get("/stories")
async def get_stories(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    following = set(user.get("following", []))
    following.add(user["id"])
    active = [s for s in load_collection("stories") if s.get("expires_at", "") > now]
    stories = [s for s in active if s.get("user_id") in following] or active[:20]
    groups = {}
    for s in sorted(stories, key=lambda x: x.get("created_at", ""), reverse=True):
        uid = s["user_id"]
        if uid not in groups:
            groups[uid] = {"user_id": uid, "username": s["username"],
                "display_name": s.get("display_name", s["username"]), "avatar_url": s.get("avatar_url", ""), "stories": []}
        groups[uid]["stories"].append(s)
    return list(groups.values())

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, user=Depends(get_current_user)):
    stories = load_collection("stories")
    for s in stories:
        if s["id"] == story_id and user["id"] not in s.get("viewers", []):
            s.setdefault("viewers", []).append(user["id"])
    save_collection("stories", stories)
    return {"status": "viewed"}

# ─── Message Routes ───────────────────────────────────────────────
@api_router.get("/messages/conversations")
async def get_conversations(user=Depends(get_current_user)):
    convos = [c for c in load_collection("conversations") if user["id"] in c.get("participants", [])]
    convos.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    result = []
    for c in convos:
        other_id = [p for p in c["participants"] if p != user["id"]]
        other = find_one("users", "id", other_id[0]) if other_id else None
        result.append({"id": c["id"], "other_user": serialize_user(other) if other else None,
            "last_message": c.get("last_message", ""), "updated_at": c.get("updated_at", ""), "is_encrypted": True})
    return result

@api_router.post("/messages/conversation")
async def create_or_get_conversation(data: CreateConversationInput, user=Depends(get_current_user)):
    for c in load_collection("conversations"):
        if set(c.get("participants", [])) == {user["id"], data.recipient_id}:
            other = find_one("users", "id", data.recipient_id)
            return {"id": c["id"], "other_user": serialize_user(other) if other else None, "is_encrypted": True}
    convo = insert("conversations", {"participants": [user["id"], data.recipient_id],
        "last_message": "", "updated_at": datetime.now(timezone.utc).isoformat(), "is_encrypted": True})
    other = find_one("users", "id", data.recipient_id)
    return {"id": convo["id"], "other_user": serialize_user(other) if other else None, "is_encrypted": True}

@api_router.get("/messages/{conversation_id}")
async def get_messages(conversation_id: str, user=Depends(get_current_user)):
    convo = find_one("conversations", "id", conversation_id)
    if not convo or user["id"] not in convo.get("participants", []):
        raise HTTPException(403, "Not a participant")
    msgs = sorted([m for m in load_collection("messages") if m.get("conversation_id") == conversation_id],
        key=lambda m: m.get("created_at", ""))
    return msgs

@api_router.post("/messages/send")
async def send_message(data: SendMessageInput, user=Depends(get_current_user)):
    convo = None
    for c in load_collection("conversations"):
        if set(c.get("participants", [])) == {user["id"], data.recipient_id}:
            convo = c; break
    if not convo:
        convo = insert("conversations", {"participants": [user["id"], data.recipient_id],
            "last_message": "[Encrypted]", "updated_at": datetime.now(timezone.utc).isoformat(), "is_encrypted": True})
    msg = insert("messages", {"conversation_id": convo["id"], "sender_id": user["id"],
        "sender_username": user["username"], "content": data.content, "is_encrypted": True,
        "created_at": datetime.now(timezone.utc).isoformat()})
    update_one("conversations", "id", convo["id"], {"last_message": "[Encrypted]", "updated_at": msg["created_at"]})
    return msg

# ─── AI Routes ────────────────────────────────────────────────────
ai_chat_sessions = {}

@api_router.post("/ai/chat")
async def ai_chat(data: AIChatInput, user=Depends(get_current_user)):
    session_id = data.session_id or f"{user['id']}_default"
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        if session_id not in ai_chat_sessions:
            chat = LlmChat(api_key=EMERGENT_KEY, session_id=session_id,
                system_message="You are T.P AI, the intelligent assistant for Totally Private. You're helpful, witty, and privacy-conscious. Keep responses concise.")
            chat.with_model("openai", "gpt-4o")
            ai_chat_sessions[session_id] = chat
        chat = ai_chat_sessions[session_id]
        response = await chat.send_message(UserMessage(text=data.message))
    except ImportError:
        try:
            from openai import AsyncOpenAI
            client_ai = AsyncOpenAI(api_key=EMERGENT_KEY)
            history = [m for m in load_collection("ai_messages") if m.get("session_id") == session_id]
            messages = [{"role": "system", "content": "You are T.P AI, the intelligent assistant for Totally Private. You're helpful, witty, and privacy-conscious."}]
            for m in history:
                messages.append({"role": "user", "content": m["user_message"]})
                messages.append({"role": "assistant", "content": m["ai_response"]})
            messages.append({"role": "user", "content": data.message})
            resp = await client_ai.chat.completions.create(model="gpt-4o", messages=messages)
            response = resp.choices[0].message.content
        except Exception as e:
            logger.error(f"AI error: {e}")
            raise HTTPException(500, f"AI service unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(500, f"AI error: {str(e)}")
    insert("ai_messages", {"session_id": session_id, "user_id": user["id"],
        "user_message": data.message, "ai_response": response,
        "created_at": datetime.now(timezone.utc).isoformat()})
    return {"response": response, "session_id": session_id}

@api_router.get("/ai/history")
async def get_ai_history(session_id: str = None, user=Depends(get_current_user)):
    sid = session_id or f"{user['id']}_default"
    msgs = sorted([m for m in load_collection("ai_messages") if m.get("session_id") == sid and m.get("user_id") == user["id"]],
        key=lambda m: m.get("created_at", ""))
    result = []
    for m in msgs:
        result.append({"role": "user", "content": m["user_message"], "created_at": m["created_at"]})
        result.append({"role": "assistant", "content": m["ai_response"], "created_at": m["created_at"]})
    return result

# ─── Seed Demo Data ───────────────────────────────────────────────
def seed_demo_data():
    if load_collection("users"):
        return
    users = [
        {"id": new_id(), "username": "alice", "email": "alice@tp.com", "password_hash": hash_password("password123"),
         "display_name": "Alice Chen", "bio": "Privacy advocate. Digital rights activist.",
         "avatar_url": "https://images.unsplash.com/photo-1611111082664-534b2cd71d6f?w=150&h=150&fit=crop&crop=face",
         "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": new_id(), "username": "marcus", "email": "marcus@tp.com", "password_hash": hash_password("password123"),
         "display_name": "Marcus Webb", "bio": "Photographer. Exploring light and shadow.",
         "avatar_url": "https://images.unsplash.com/photo-1639834561750-1f0f02134d63?w=150&h=150&fit=crop&crop=face",
         "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": new_id(), "username": "nova", "email": "nova@tp.com", "password_hash": hash_password("password123"),
         "display_name": "Nova Reyes", "bio": "Architect of digital futures.",
         "avatar_url": "https://images.unsplash.com/photo-1551678663-b18770239cf0?w=150&h=150&fit=crop&crop=face",
         "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    users[0]["following"] = [users[1]["id"], users[2]["id"]]
    users[1]["followers"] = [users[0]["id"]]; users[1]["following"] = [users[2]["id"]]
    users[2]["followers"] = [users[0]["id"], users[1]["id"]]
    save_collection("users", users)

    posts = [
        {"id": new_id(), "user_id": users[0]["id"], "username": "alice", "display_name": "Alice Chen",
         "avatar_url": users[0]["avatar_url"], "content": "Privacy is not about having something to hide. It's about having something to protect.",
         "image": None, "likes": [users[1]["id"]], "comments": [],
         "created_at": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()},
        {"id": new_id(), "user_id": users[1]["id"], "username": "marcus", "display_name": "Marcus Webb",
         "avatar_url": users[1]["avatar_url"], "content": "Light finds its way through every structure. New series dropping soon.",
         "image": "https://images.unsplash.com/photo-1625239881160-cf0a59a28578?w=800&q=80",
         "likes": [users[0]["id"], users[2]["id"]],
         "comments": [{"id": new_id(), "user_id": users[0]["id"], "username": "alice", "display_name": "Alice Chen",
            "avatar_url": users[0]["avatar_url"], "content": "Stunning work!",
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()}],
         "created_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()},
        {"id": new_id(), "user_id": users[2]["id"], "username": "nova", "display_name": "Nova Reyes",
         "avatar_url": users[2]["avatar_url"], "content": "The future of social media is encrypted. Welcome to the revolution.",
         "image": "https://images.unsplash.com/photo-1608400024869-d9f3fa50f98e?w=800&q=80",
         "likes": [users[0]["id"]], "comments": [],
         "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
    ]
    save_collection("posts", posts)

    stories = [
        {"id": new_id(), "user_id": users[0]["id"], "username": "alice", "display_name": "Alice Chen",
         "avatar_url": users[0]["avatar_url"], "image": "https://images.unsplash.com/photo-1607429126980-5e59cecb6a12?w=600&q=80",
         "viewers": [], "created_at": datetime.now(timezone.utc).isoformat(),
         "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()},
        {"id": new_id(), "user_id": users[1]["id"], "username": "marcus", "display_name": "Marcus Webb",
         "avatar_url": users[1]["avatar_url"], "image": "https://images.unsplash.com/photo-1713029932378-ebda8662d0b1?w=600&q=80",
         "viewers": [], "created_at": datetime.now(timezone.utc).isoformat(),
         "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()},
    ]
    save_collection("stories", stories)
    logger.info("Demo data seeded")

seed_demo_data()

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

logger.info("T.P Backend started (file-based storage)")
