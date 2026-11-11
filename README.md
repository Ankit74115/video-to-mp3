# Trackbay

Trackbay is an event-driven microservice application: upload a video, a worker extracts the
audio with ffmpeg, and you get an MP3 back (plus an email when it is ready).
Built to practise microservice patterns: an API gateway, a dedicated auth
service, asynchronous work over RabbitMQ, object storage in MongoDB GridFS,
and a React frontend, all containerised and deployable to Kubernetes.

```
 browser ──► frontend (nginx, React) ──/api──► gateway (Flask)
                                                 │   │
                                     login/validate   upload / jobs / download
                                                 │   │
                                              auth ──► MySQL (bcrypt users, JWT)
                                                     │
                                                     ├──► MongoDB GridFS (videos, mp3s) + jobs collection
                                                     │
                                                     └──► RabbitMQ  "video" queue
                                                               │
                                                          converter (ffmpeg) ──► GridFS mp3 ──► "mp3" queue
                                                                                                   │
                                                                                            notification ──► SMTP email
```

## Services

| Service | Stack | Role |
|---|---|---|
| `frontend/` | React, Vite, Tailwind v4, nginx | Sign in, drag-and-drop upload, live job list, download. nginx proxies `/api` to the gateway. |
| `src/gateway` | Flask, gunicorn | Public API. Validates JWTs via auth, stores uploads in GridFS, records jobs, publishes to RabbitMQ, serves downloads. |
| `src/auth` | Flask, gunicorn, PyMySQL, bcrypt | Login (HTTP Basic) and JWT issue/validate. Creates its table and seeds a demo user on startup. |
| `src/converter` | Python, pika, ffmpeg | Consumes `video` queue, extracts audio to MP3, updates job status, publishes to `mp3` queue. |
| `src/notification` | Python, pika, smtplib | Consumes `mp3` queue, emails the user. Logs instead if SMTP is not configured. |
| MongoDB, MySQL, RabbitMQ | official images | Storage, users, messaging. |

### API (gateway)

All responses are JSON. Authenticated routes need `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness, checks MongoDB. |
| `POST` | `/login` | HTTP Basic credentials, returns `{"token": "..."}`. |
| `POST` | `/register` | JSON `{"email", "password"}` (8+ chars). Creates the account and returns `{"token": "..."}`; `409` if the email exists. |
| `POST` | `/upload` | Multipart field `file`. Returns `{"job_id", "video_fid", "filename", "status"}`. `400` if empty, `413` if over `MAX_UPLOAD_MB`, `415` if the content is a web page or plain text rather than media. |
| `GET` | `/jobs` | The caller's jobs, newest first. Status is `queued`, `processing`, `done` or `failed`. |
| `GET` | `/jobs/<id>` | One job. |
| `GET` | `/download?fid=<mp3_fid>` | The MP3 as an attachment. Only the owner can download. |

## Run locally

Requirements: Docker Desktop (with Compose v2).

```bash
cp .env.example .env
# edit .env: set MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, JWT_SECRET, DEMO_USER_PASSWORD
# optionally SMTP_USER / SMTP_PASSWORD (Gmail app password) for email

docker compose up --build -d
docker compose ps
```

| What | URL |
|---|---|
| App | http://localhost:3000 |
| Gateway API | http://localhost:8080 |
| RabbitMQ management | http://localhost:15672 (RABBITMQ_USER / RABBITMQ_PASSWORD) |

Sign in with `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` from your `.env`.

### End-to-end smoke test

Generate a small test video (3 seconds, tone plus colour) using the ffmpeg inside the converter image, then run the test script:

```bash
docker compose run --rm --no-deps -v "$PWD/scripts:/out" converter \
  ffmpeg -y -f lavfi -i "sine=frequency=440:duration=3" -f lavfi -i "color=c=teal:s=320x240:d=3" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac /out/sample.mp4

python scripts/smoke_test.py scripts/sample.mp4
```

The script logs in, uploads, polls the job until `done`, downloads the MP3 and saves it next to the input.

### Frontend development

```bash
cd frontend
cp .env.example .env        # GATEWAY_URL=http://localhost:8080
npm install
npm run dev                 # http://localhost:3000, /api proxied to the gateway
```

### Logs and troubleshooting

```bash
docker compose logs -f gateway converter notification auth
docker compose exec mongodb mongosh mp3converter --eval "db.jobs.find().sort({created_at:-1}).limit(5)"
```

- Every service waits for its dependencies at startup and retries, so a slow database is not an error.
- Queues are declared durable by both producers and consumers; nothing needs to be created by hand in RabbitMQ.
- A message that cannot be processed is rejected without requeue (and the job is marked `failed`) so it cannot loop forever.

## Configuration

Each service documents its environment variables in `src/<service>/.env.example`.
The root `.env.example` feeds `docker-compose.yml`. Nothing secret is committed:
the demo user is seeded from env and stored bcrypt-hashed, and the JWT secret
must be at least 16 characters.

## Deploying

Kubernetes manifests live under `src/*/manifests`. The target for the public
demo is a single-node k3s cluster on an Oracle Cloud Always Free ARM VM, with
Traefik ingress, cert-manager for TLS and images built for arm64 by GitHub
Actions. See the deployment notes once that work lands.

## Design notes

- **Why a jobs collection?** The original design only told the user about a finished MP3 by email. Recording each job in MongoDB lets the UI poll status and gives downloads an ownership check.
- **Why ffmpeg directly instead of moviepy?** moviepy pulled in numpy, Pillow and imageio and loaded whole videos through Python. Calling ffmpeg as a subprocess is faster, uses a fraction of the memory, and shrinks the image considerably.
- **Why one RabbitMQ connection per publish in the gateway?** The gateway runs several gunicorn workers and sees sparse traffic. A shared long-lived connection dies quietly on missed heartbeats, which was the main source of failed uploads. Short connections are simpler and reliable at this scale.
