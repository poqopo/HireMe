# HireMe deployment

## Client Web

`app/client-web`은 독립 정적 웹이다. `VITE_SUPABASE_URL`과
`VITE_SUPABASE_ANON_KEY`만 build-time public configuration으로 사용한다.

```bash
npm run client:build
```

Vercel output은 `app/client-web/dist`다.

## Designer App

`app/designer-app`에서 Electron DMG를 만든다. build 시 `hireme-agent/cli`,
`runtime`, `examples`를 `resources/runtime/hireme-agent`로 포함한다.

```bash
npm run designer:dist
```

배포용 빌드는 Supabase public configuration, macOS signing, notarization이 필요하다.
Private Harness와 provider credential은 패키지나 Supabase에 포함하지 않는다.

## Supabase

```bash
cd app/supabase
npm run deploy:worker
npm run deploy:maintenance
```

`migrations/` 적용 후 closed pilot 사용자를 `pilot_members`에 등록하고 maintenance
function을 cron으로 호출한다.
