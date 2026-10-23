# Contributing to Wander

Thank you for your interest in improving Wander! Wander is built on the philosophy of being **practical, genuinely useful, lightweight, and easy to install**, avoiding unnecessary abstractions and pointless complexity.

---

## 🛠️ Development Setup

### Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0

### Setup
```bash
git clone https://github.com/ItzPhantomm/wander.git
cd wander
npm install
npm run build
npm test
```

---

## 🔌 Adding a Search Provider

All search providers implement `BaseProvider` located in `src/providers/base.ts`:

1. Create `src/providers/myprovider.ts`:
```typescript
import { BaseProvider } from "./base.js";
import { SearchResult, SearchOptions, ProviderCapability } from "../core/types.js";
import { safeFetch } from "../utils/http.js";

export class MyProvider extends BaseProvider {
  readonly name = "myprovider";
  readonly displayName = "My Provider";
  readonly category = "general" as const;
  readonly capabilities: ProviderCapability = {
    supportsFreshness: false,
    supportsCategories: false,
    requiresKey: false,
    rateLimitPerMin: 60,
    category: "general"
  };

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // 1. Fetch data with safeFetch()
    // 2. Parse results
    // 3. Return SearchResult[]
  }
}
```

2. Register your provider in `src/providers/index.ts`.
3. Add a unit test in `test/providers.test.ts`.

---

## 🧪 Testing & Validation

Before submitting a Pull Request, ensure:
1. `npm run lint` passes without TypeScript errors.
2. `npm test` passes all unit and integration tests.
3. `wander doctor` confirms provider health.
4. Keep dependencies minimal—avoid adding heavy dependencies unless strictly necessary.

---

## 📜 Code of Conduct & License

Wander is licensed under the [MIT License](LICENSE).
Contributions must respect provider terms of service, robots.txt, and rate limits.
