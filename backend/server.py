from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import List, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Config
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

ai_chat_sessions = {}

# ─── Auth Helpers ─────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_user(user: dict) -> dict:
    uid = user.get("_id", "")
    return {
        "id": str(uid) if isinstance(uid, ObjectId) else uid,
        "username": user.get("username", ""),
        "email": user.get("email", ""),
        "display_name": user.get("display_name", user.get("username", "")),
        "bio": user.get("bio", ""),
        "avatar_url": user.get("avatar_url", ""),
        "followers": [str(f) for f in user.get("followers", [])],
        "following": [str(f) for f in user.get("following", [])],
        "created_at": user.get("created_at", "")
    }

# ─── Models ───────────────────────────────────────────────────────
class RegisterInput(BaseModel):
    username: str
    email: str
    password: str
    display_name: Optional[str] = None

class LoginInput(BaseModel):
    identifier: str
    password: str

class CreatePostInput(BaseModel):
    content: str
    image: Optional[str] = None

class CreateStoryInput(BaseModel):
    image: str

class SendMessageInput(BaseModel):
    recipient_id: str
    content: str

class CreateConversationInput(BaseModel):
    recipient_id: str

class AIChatInput(BaseModel):
    message: str
    session_id: Optional[str] = None

class CommentInput(BaseModel):
    content: str

class UpdateProfileInput(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

# ─── Auth Routes ──────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: RegisterInput):
    username = data.username.lower().strip()
    email = data.email.lower().strip()
    if len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await db.users.find_one({"username": username}):
        raise HTTPException(400, "Username already taken")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")

    user_doc = {
        "username": username,
        "email": email,
        "password_hash": hash_password(data.password),
        "display_name": data.display_name or username,
        "bio": "",
        "avatar_url": "",
        "followers": [],
        "following": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_token(user_id, username)
    user_doc["_id"] = user_id
    return {"token": token, "user": serialize_user(user_doc)}

@api_router.post("/auth/login")
async def login(data: LoginInput):
    identifier = data.identifier.lower().strip()
    user = await db.users.find_one({"$or": [{"username": identifier}, {"email": identifier}]})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    user_id = str(user["_id"])
    token = create_token(user_id, user["username"])
    return {"token": token, "user": serialize_user(user)}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return serialize_user(user)

# ─── User Routes ──────────────────────────────────────────────────
@api_router.get("/users/profile/{username}")
async def get_profile(username: str):
    profile = await db.users.find_one({"username": username.lower()})
    if not profile:
        raise HTTPException(404, "User not found")
    post_count = await db.posts.count_documents({"user_id": str(profile["_id"])})
    result = serialize_user(profile)
    result["post_count"] = post_count
    result["follower_count"] = len(profile.get("followers", []))
    result["following_count"] = len(profile.get("following", []))
    return result

@api_router.get("/users/search")
async def search_users(q: str, user=Depends(get_current_user)):
    users = await db.users.find({
        "username": {"$regex": q.lower(), "$options": "i"},
        "_id": {"$ne": ObjectId(user["_id"])}
    }).limit(20).to_list(20)
    return [serialize_user(u) for u in users]

@api_router.get("/users/suggestions")
async def get_suggestions(user=Depends(get_current_user)):
    following_ids = [ObjectId(f) for f in user.get("following", [])]
    following_ids.append(ObjectId(user["_id"]))
    users = await db.users.find({"_id": {"$nin": following_ids}}).limit(10).to_list(10)
    return [serialize_user(u) for u in users]

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["_id"]:
        raise HTTPException(400, "Cannot follow yourself")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$addToSet": {"following": user_id}})
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$addToSet": {"followers": user["_id"]}})
    return {"status": "followed"}

@api_router.post("/users/{user_id}/unfollow")
async def unfollow_user(user_id: str, user=Depends(get_current_user)):
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$pull": {"following": user_id}})
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$pull": {"followers": user["_id"]}})
    return {"status": "unfollowed"}

@api_router.put("/users/profile")
async def update_profile(data: UpdateProfileInput, user=Depends(get_current_user)):
    update = {}
    if data.display_name is not None:
        update["display_name"] = data.display_name
    if data.bio is not None:
        update["bio"] = data.bio
    if data.avatar_url is not None:
        update["avatar_url"] = data.avatar_url
    if update:
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return serialize_user(updated)

# ─── Post Routes ──────────────────────────────────────────────────
@api_router.post("/posts")
async def create_post(data: CreatePostInput, user=Depends(get_current_user)):
    post_doc = {
        "user_id": user["_id"],
        "username": user["username"],
        "display_name": user.get("display_name", user["username"]),
        "avatar_url": user.get("avatar_url", ""),
        "content": data.content,
        "image": data.image,
        "likes": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.posts.insert_one(post_doc)
    post_doc["id"] = str(result.inserted_id)
    post_doc.pop("_id", None)
    return post_doc

@api_router.get("/posts/feed")
async def get_feed(user=Depends(get_current_user), skip: int = 0, limit: int = 20):
    following = user.get("following", [])
    user_ids = following + [user["_id"]]
    posts = await db.posts.find({"user_id": {"$in": user_ids}}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    if len(posts) < limit:
        remaining = limit - len(posts)
        existing_ids = [p["_id"] for p in posts]
        discover = await db.posts.find({"_id": {"$nin": existing_ids}}).sort("created_at", -1).limit(remaining).to_list(remaining)
        posts.extend(discover)
    for p in posts:
        p["id"] = str(p["_id"])
        del p["_id"]
    return posts

@api_router.get("/posts/user/{username}")
async def get_user_posts(username: str, skip: int = 0, limit: int = 20):
    target = await db.users.find_one({"username": username.lower()})
    if not target:
        raise HTTPException(404, "User not found")
    posts = await db.posts.find({"user_id": str(target["_id"])}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for p in posts:
        p["id"] = str(p["_id"])
        del p["_id"]
    return posts

@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    user_id = user["_id"]
    if user_id in post.get("likes", []):
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$pull": {"likes": user_id}})
        return {"liked": False, "count": len(post["likes"]) - 1}
    else:
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$addToSet": {"likes": user_id}})
        return {"liked": True, "count": len(post["likes"]) + 1}

@api_router.post("/posts/{post_id}/comment")
async def add_comment(post_id: str, data: CommentInput, user=Depends(get_current_user)):
    comment = {
        "id": str(ObjectId()),
        "user_id": user["_id"],
        "username": user["username"],
        "display_name": user.get("display_name", user["username"]),
        "avatar_url": user.get("avatar_url", ""),
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.posts.update_one({"_id": ObjectId(post_id)}, {"$push": {"comments": comment}})
    return comment

# ─── Story Routes ─────────────────────────────────────────────────
@api_router.post("/stories")
async def create_story(data: CreateStoryInput, user=Depends(get_current_user)):
    story_doc = {
        "user_id": user["_id"],
        "username": user["username"],
        "display_name": user.get("display_name", user["username"]),
        "avatar_url": user.get("avatar_url", ""),
        "image": data.image,
        "viewers": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    }
    result = await db.stories.insert_one(story_doc)
    story_doc["id"] = str(result.inserted_id)
    story_doc.pop("_id", None)
    return story_doc

@api_router.get("/stories")
async def get_stories(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    following = user.get("following", [])
    user_ids = following + [user["_id"]]
    stories = await db.stories.find({"user_id": {"$in": user_ids}, "expires_at": {"$gt": now}}).sort("created_at", -1).to_list(100)
    if not stories:
        stories = await db.stories.find({"expires_at": {"$gt": now}}).sort("created_at", -1).limit(20).to_list(20)
    user_stories = {}
    for s in stories:
        s["id"] = str(s["_id"])
        del s["_id"]
        uid = s["user_id"]
        if uid not in user_stories:
            user_stories[uid] = {
                "user_id": uid, "username": s["username"],
                "display_name": s.get("display_name", s["username"]),
                "avatar_url": s.get("avatar_url", ""), "stories": []
            }
        user_stories[uid]["stories"].append(s)
    return list(user_stories.values())

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, user=Depends(get_current_user)):
    await db.stories.update_one({"_id": ObjectId(story_id)}, {"$addToSet": {"viewers": user["_id"]}})
    return {"status": "viewed"}

# ─── Message Routes ───────────────────────────────────────────────
@api_router.get("/messages/conversations")
async def get_conversations(user=Depends(get_current_user)):
    convos = await db.conversations.find({"participants": user["_id"]}).sort("updated_at", -1).to_list(50)
    result = []
    for c in convos:
        other_id = [p for p in c["participants"] if p != user["_id"]]
        other_user = None
        if other_id:
            other_user = await db.users.find_one({"_id": ObjectId(other_id[0])})
        result.append({
            "id": str(c["_id"]),
            "other_user": serialize_user(other_user) if other_user else None,
            "last_message": c.get("last_message", ""),
            "updated_at": c.get("updated_at", ""),
            "is_encrypted": True
        })
    return result

@api_router.post("/messages/conversation")
async def create_or_get_conversation(data: CreateConversationInput, user=Depends(get_current_user)):
    existing = await db.conversations.find_one({"participants": {"$all": [user["_id"], data.recipient_id]}})
    if existing:
        other_user = await db.users.find_one({"_id": ObjectId(data.recipient_id)})
        return {"id": str(existing["_id"]), "other_user": serialize_user(other_user) if other_user else None, "is_encrypted": True}
    convo = {
        "participants": [user["_id"], data.recipient_id],
        "last_message": "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "is_encrypted": True
    }
    result = await db.conversations.insert_one(convo)
    other_user = await db.users.find_one({"_id": ObjectId(data.recipient_id)})
    return {"id": str(result.inserted_id), "other_user": serialize_user(other_user) if other_user else None, "is_encrypted": True}

@api_router.get("/messages/{conversation_id}")
async def get_messages(conversation_id: str, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
    if not convo or user["_id"] not in convo["participants"]:
        raise HTTPException(403, "Not a participant")
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1).to_list(200)
    for m in messages:
        m["id"] = str(m["_id"])
        del m["_id"]
    return messages

@api_router.post("/messages/send")
async def send_message(data: SendMessageInput, user=Depends(get_current_user)):
    convo = await db.conversations.find_one({"participants": {"$all": [user["_id"], data.recipient_id]}})
    if not convo:
        convo_doc = {
            "participants": [user["_id"], data.recipient_id],
            "last_message": "[Encrypted]",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_encrypted": True
        }
        result = await db.conversations.insert_one(convo_doc)
        conversation_id = str(result.inserted_id)
    else:
        conversation_id = str(convo["_id"])
    msg_doc = {
        "conversation_id": conversation_id,
        "sender_id": user["_id"],
        "sender_username": user["username"],
        "content": data.content,
        "is_encrypted": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.messages.insert_one(msg_doc)
    await db.conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"last_message": "[Encrypted]", "updated_at": msg_doc["created_at"]}}
    )
    msg_doc["id"] = str(result.inserted_id)
    msg_doc.pop("_id", None)
    msg_doc["conversation_id"] = conversation_id
    return msg_doc

# ─── AI Routes ────────────────────────────────────────────────────
@api_router.post("/ai/chat")
async def ai_chat(data: AIChatInput, user=Depends(get_current_user)):
    session_id = data.session_id or f"{user['_id']}_default"
    if session_id not in ai_chat_sessions:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=session_id,
            system_message="You are T.P AI, the intelligent assistant for Totally Private - an end-to-end encrypted social media platform. You're helpful, witty, and privacy-conscious. Help users with anything they need. Keep responses concise."
        )
        chat.with_model("openai", "gpt-4o")
        ai_chat_sessions[session_id] = chat
    chat = ai_chat_sessions[session_id]
    try:
        response = await chat.send_message(UserMessage(text=data.message))
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(500, f"AI service error: {str(e)}")
    await db.ai_messages.insert_one({
        "session_id": session_id,
        "user_id": user["_id"],
        "user_message": data.message,
        "ai_response": response,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"response": response, "session_id": session_id}

@api_router.get("/ai/history")
async def get_ai_history(session_id: str = None, user=Depends(get_current_user)):
    sid = session_id or f"{user['_id']}_default"
    messages = await db.ai_messages.find({"session_id": sid, "user_id": user["_id"]}).sort("created_at", 1).to_list(100)
    result = []
    for m in messages:
        result.append({"role": "user", "content": m["user_message"], "created_at": m["created_at"]})
        result.append({"role": "assistant", "content": m["ai_response"], "created_at": m["created_at"]})
    return result

# ─── Startup ──────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True)
    await db.posts.create_index([("created_at", -1)])
    await db.posts.create_index("user_id")
    await db.stories.create_index([("expires_at", 1)])
    await db.conversations.create_index("participants")
    await db.messages.create_index("conversation_id")
    await db.ai_messages.create_index("session_id")
    await seed_demo_data()
    logger.info("T.P Backend started")

async def seed_demo_data():
    if await db.users.count_documents({}) > 0:
        return
    demo_users = [
        {"username": "alice", "email": "alice@tp.com", "password_hash": hash_password("password123"),
         "display_name": "Alice Chen", "bio": "Privacy advocate. Digital rights activist.",
         "avatar_url": "https://images.unsplash.com/photo-1611111082664-534b2cd71d6f?w=150&h=150&fit=crop&crop=face",
         "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()},
        {"username": "marcus", "email": "marcus@tp.com", "password_hash": hash_password("password123"),
         "display_name": "Marcus Webb", "bio": "Photographer. Exploring light and shadow.",
         "avatar_url": "https://images.unsplash.com/photo-1639834561750-1f0f02134d63?w=150&h=150&fit=crop&crop=face",
         "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()},
        {"username": "nova", "email": "nova@tp.com", "password_hash": hash_password("password123"),
         "display_name": "Nova Reyes", "bio": "Architect of digital futures.",
         "avatar_url": "https://images.unsplash.com/photo-1551678663-b18770239cf0?w=150&h=150&fit=crop&crop=face",
         "followers": [], "following": [], "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    user_ids = []
    for u in demo_users:
        result = await db.users.insert_one(u)
        user_ids.append(str(result.inserted_id))

    await db.users.update_one({"username": "alice"}, {"$set": {"following": [user_ids[1], user_ids[2]]}})
    await db.users.update_one({"username": "marcus"}, {"$set": {"followers": [user_ids[0]], "following": [user_ids[2]]}})
    await db.users.update_one({"username": "nova"}, {"$set": {"followers": [user_ids[0], user_ids[1]]}})

    demo_posts = [
        {"user_id": user_ids[0], "username": "alice", "display_name": "Alice Chen",
         "avatar_url": demo_users[0]["avatar_url"],
         "content": "Privacy is not about having something to hide. It's about having something to protect.",
         "image": None, "likes": [user_ids[1]], "comments": [],
         "created_at": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()},
        {"user_id": user_ids[1], "username": "marcus", "display_name": "Marcus Webb",
         "avatar_url": demo_users[1]["avatar_url"],
         "content": "Light finds its way through every structure. New series dropping soon.",
         "image": "https://images.unsplash.com/photo-1625239881160-cf0a59a28578?w=800&q=80",
         "likes": [user_ids[0], user_ids[2]],
         "comments": [{"id": str(ObjectId()), "user_id": user_ids[0], "username": "alice",
                        "display_name": "Alice Chen", "avatar_url": demo_users[0]["avatar_url"],
                        "content": "Stunning work!", "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()}],
         "created_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()},
        {"user_id": user_ids[2], "username": "nova", "display_name": "Nova Reyes",
         "avatar_url": demo_users[2]["avatar_url"],
         "content": "The future of social media is encrypted. Welcome to the revolution.",
         "image": "https://images.unsplash.com/photo-1608400024869-d9f3fa50f98e?w=800&q=80",
         "likes": [user_ids[0]], "comments": [],
         "created_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
    ]
    for p in demo_posts:
        await db.posts.insert_one(p)

    demo_stories = [
        {"user_id": user_ids[0], "username": "alice", "display_name": "Alice Chen",
         "avatar_url": demo_users[0]["avatar_url"],
         "image": "https://images.unsplash.com/photo-1607429126980-5e59cecb6a12?w=600&q=80",
         "viewers": [], "created_at": datetime.now(timezone.utc).isoformat(),
         "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()},
        {"user_id": user_ids[1], "username": "marcus", "display_name": "Marcus Webb",
         "avatar_url": demo_users[1]["avatar_url"],
         "image": "https://images.unsplash.com/photo-1713029932378-ebda8662d0b1?w=600&q=80",
         "viewers": [], "created_at": datetime.now(timezone.utc).isoformat(),
         "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()},
    ]
    for s in demo_stories:
        await db.stories.insert_one(s)
    logger.info("Demo data seeded")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
