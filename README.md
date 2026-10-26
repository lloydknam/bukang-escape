# 부캉이 탈출작전

부산시 그물과 치킨 빌런을 피해 60초를 버티면 먼 바다로 탈출하는 미니게임이에요.

<a href="https://github.com/lloydknam"><img src="assets/brand/lockup-light.png" alt="Lloyd's Balcony Lab · with claude · GitHub(@lloydknam)" height="48"></a>

## 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 게임 전체 (GitHub Pages로 서비스) |
| `scores.json` | 랭킹 기록 (중계 서버가 자동으로 갱신) |
| `worker/` | 점수를 받아 `scores.json`에 기록하는 Cloudflare Worker |

## 설치 순서

### 1. GitHub Pages 켜기
레포 Settings → Pages → Source를 `Deploy from a branch`, Branch를 `main` / `(root)`로 두고 저장하세요.
주소는 `https://lloydknam.github.io/bukang-escape/` 예요.

### 2. GitHub 토큰 만들기
GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
- Repository access: `Only select repositories` → `bukang-escape`
- Permissions: Repository permissions → **Contents: Read and write** (이것만)
- 만료일은 길게(예: 1년) 잡으세요.

### 3. 중계 서버 배포 (Cloudflare Worker, 무료)
대시보드에서 하는 방법이 가장 쉬워요.

1. `dash.cloudflare.com` → Workers & Pages → Create → Hello World → 이름 `bukang-rank` → Deploy → Edit code
2. 기본 코드를 지우고 `worker/worker.js` 내용을 통째로 붙여넣은 뒤 Deploy
3. Settings → Variables and Secrets → Add → 종류 **Secret**, 이름 `GH_TOKEN`, 값은 2번에서 만든 토큰 → 저장 후 Deploy

`REPO`, `FILE`, `ALLOWED_ORIGINS`는 코드에 기본값이 들어 있어서 따로 넣지 않아도 돼요.
(레포 이름이나 Pages 주소가 다르면 같은 이름의 변수로 덮어쓰세요.)

터미널로 하려면:

```bash
cd worker
npx wrangler login
npx wrangler deploy
npx wrangler secret put GH_TOKEN   # 2번에서 만든 토큰을 붙여넣기
```

배포가 끝나면 `https://bukang-rank.<계정>.workers.dev` 같은 주소가 나와요.

### 4. 게임에 서버 주소 넣기
`index.html` 위쪽의 `window.RANK_API=""` 따옴표 안에 3번에서 나온 주소를 넣고 커밋하세요(끝에 `/` 없이).

```html
window.RANK_API="https://bukang-rank.<계정>.workers.dev";
```

## 참고
- 주소를 비워 두면 랭킹은 각자 기기에만 저장돼요.
- 중계 서버는 최대 점수 규칙에 어긋나는 값(시간·하트로 계산한 상한 초과)을 거절해요. 브라우저에서 보내는 값이라 마음먹고 조작하면 막기 어려워요.
- 커스텀 도메인을 쓰면 `ALLOWED_ORIGINS`에 그 주소를 쉼표로 추가하세요.
- 토큰은 절대 `index.html`이나 레포에 넣지 마세요.
