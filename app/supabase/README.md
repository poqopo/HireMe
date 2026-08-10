# HireMe Supabase control plane

클라이언트 웹과 디자이너 앱 사이에서 인증, 공개 Agent catalog, 프로젝트 입력,
Creator Worker queue, 승인된 결과 전달을 관리한다. Private Harness와 디자이너의
AI credential은 저장하지 않는다.

```text
functions/
├── creator-worker/              # Client·Worker command API
├── creator-worker-maintenance/  # lease·retention maintenance
└── _shared/                     # CORS, validation, stable serialization
migrations/                      # database, RLS, storage, queue contracts
```

## Run

```bash
npm install
npm start
npm run functions:serve
```
