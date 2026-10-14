# Ringside Board · 설정 안내

나(owner)와 흠이(staff)가 각자 이메일·비밀번호로 로그인하는 보드예요.

- **Supabase**: 로그인과 데이터 저장. 흠이 계정은 자기 데일리, 채널 숫자, 자기 루틴만 읽고 쓸 수 있어요. 서버에서 막아요.
- **Vercel**: 웹사이트 호스팅과 구글 시트 자동 기록(`/api/sync`).
- **Google 서비스 계정**: 시트에 대신 써주는 로봇 계정이에요. 시트는 이 로봇에게만 공유하고, 흠이에게는 공유하지 않아요.

지금 `index.html`은 **설정 점검 화면**이에요. 모든 항목이 초록색이 되면 Claude가 실제 보드 화면으로 바꿔드려요.

---

## 1. Supabase (약 20분)

1. https://supabase.com 에 가입하고 **New project**를 만들어요.
   - Region: **Northeast Asia (Seoul)**
   - Database password는 따로 저장해두세요. 이 작업에는 다시 쓰지 않아요.
2. 왼쪽 **SQL Editor** → **New query**에 `supabase/1_schema.sql` 내용을 전부 붙여넣고 **Run**.
3. 새 쿼리에 `supabase/2_seed.sql`을 붙여넣고 **Run**. 마지막에 brands 9, tasks 17 같은 숫자가 보이면 성공이에요.
4. **Authentication → Users → Add user → Create new user**로 두 계정을 만들어요.
   - 내 계정: daylight.korea@gmail.com
   - 흠이 계정: 흠이 이메일
   - 둘 다 **Auto Confirm User**를 체크하세요. 비밀번호는 각자 정해서 흠이에게 따로 전달해요.
5. `supabase/3_users.sql`에서 `흠이_이메일@example.com`을 흠이의 실제 이메일로 바꾸고 **Run**. 마지막 표에 두 줄이 보이면 성공이에요.
6. **Authentication → Sign In / Providers**(또는 Settings)에서 **Allow new users to sign up**을 꺼요. 이제 아무나 가입할 수 없어요.
7. **Project Settings → API**(또는 API Keys)에서 아래 3개를 복사해 메모장에 둬요.
   - Project URL
   - `anon` / public 키
   - `service_role` / secret 키 · **절대 채팅이나 GitHub에 올리지 마세요**

## 2. Google 서비스 계정 (약 20~30분)

1. https://console.cloud.google.com 에서 상단 프로젝트 선택 → **새 프로젝트**(예: ringside).

2. **API 및 서비스 → 라이브러리**에서 **Google Sheets API**를 검색해 **사용**을 눌러요.


3. **IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기**. 이름은 ringside 정도로 하고, 역할은 비워둔 채 **완료**.


4. 만든 서비스 계정을 누르고 **키 → 키 추가 → 새 키 만들기 → JSON**. 파일이 다운로드돼요. 이 파일도 **절대 공유 금지**예요.
5. JSON 파일을 메모장으로 열어 아래 두 값을 찾아요.
   - `client_email` (예: ringside@….iam.gserviceaccount.com) 
nar-145@studionar-dashboard.iam.gserviceaccount.com
   - `private_key` (`-----BEGIN PRIVATE KEY-----`로 시작하는 긴 값, 따옴표 안 전체)
9b30fa3ca5378ae337bfbc4545a36a4fb4d60e31
6. 구글 시트 두 개를 열고 오른쪽 위 **공유**에서 `client_email` 주소를 **편집자**로 추가해요.
   - NaR 작업표 (파이프라인 + 흠이 데일리 + 흠이 주간 탭)
   - 채널 성장 기록 시트



## 3. GitHub (약 10분)

1. https://github.com 에서 **New repository** → 이름 `ringside-board` → **Private** → Create.
2. **uploading an existing file**을 눌러 이 폴더의 파일과 폴더(`api`, `lib`, `supabase`, `index.html`, `package.json`, `.gitignore`, `README.md`, `.env.example`)를 끌어다 놓고 **Commit**.

## 4. Vercel (약 10분)

1. https://vercel.com 에 GitHub로 로그인 → **Add New → Project** → `ringside-board` **Import**.
2. **Environment Variables**에 5개를 넣어요. 이름은 `.env.example`과 똑같이 써야 해요.

   | 이름 | 값 |
   |---|---|
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_ANON_KEY` | anon / public 키 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret 키 |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON의 `client_email` |
   | `GOOGLE_PRIVATE_KEY` | JSON의 `private_key` 값 전체 (`\n`이 들어간 그대로 붙여넣기) |

3. **Deploy**를 눌러요. 나중에 환경변수를 고치면 **Deployments → … → Redeploy**를 해야 반영돼요.

## 5. 점검

배포된 주소(예: `ringside-board.vercel.app`)를 열면 점검 화면이 나와요.

- 모든 항목이 초록 ✓이면 Claude에게 **"점검 통과"**라고 알려주세요.
- 빨간 항목은 옆에 쓰인 안내대로 고치고 **다시 점검**을 누르세요.

> 키 값은 Claude에게 보낼 필요가 없어요. 보드 화면은 주소의 `/api/config`에서 공개용 값만 읽어가요.

---

## 폴더 구조

```
api/config.js    브라우저 로그인에 필요한 공개 값 (URL, anon 키)
api/health.js    설정 점검
api/sync.js      구글 시트 자동 기록 (로그인한 사람만, 흠이는 데일리·채널 숫자만)
lib/rows.js      시트에 쓰는 한 줄 모양
lib/server.js    Supabase · Google 연결
supabase/        데이터베이스 설정 SQL 3개 (순서대로 실행)
index.html       지금은 점검 화면 → 다음 단계에서 실제 보드로 교체
```
